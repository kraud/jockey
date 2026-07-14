import { connectWs, sendWs } from "./ws-client.js";

// ── Config ────────────────────────────────────────────────────────────

const WORKER_ORIGIN = "http://localhost:8787";

// ── Types (duplicated from src/ws/messages.ts for frontend independence) ─

type Suit = "Coins" | "Cups" | "Swords" | "Clubs";
const SUITS: Suit[] = ["Coins", "Cups", "Swords", "Clubs"];

type Phase = "LOBBY" | "BIDDING" | "SETUP" | "RACING" | "SETTLEMENT" | "DISTRIBUTION" | "READY";

interface Player {
  id: string; name: string; type: "independent" | "hosted";
  isConnected: boolean;
  drinks: { give: number; take: number; consume: number; isReady: boolean };
}

interface Bid { playerId: string; suit: Suit; amount: number; submittedAt: number; }

interface Horse { suit: Suit; position: number; isFinished: boolean; placement: number; }

interface Room {
  id: string; roomCode: string; hostId: string; isLocked: boolean;
  players: Player[]; trackLength: number; state: Phase; createdAt: number;
  horses: Horse[];
  bids: Record<string, Bid>; raceLog: RaceLogEvent[];
}

type RaceLogEvent =
  | { type: "DECK_DRAW"; card: { rank: number; suit: Suit }; suit: Suit; ignored: boolean }
  | { type: "HORSE_MOVE"; suit: Suit; from: number; to: number; reason: string }
  | { type: "TRACK_FLIP"; index: number; suit: Suit; ignored: boolean }
  | { type: "HORSE_FINISH"; suit: Suit; placement: number }
  | { type: "RACE_END"; placements: { suit: Suit; placement: number }[] }
  | { type: "SETTLEMENT"; playerId: string; drinksGive: number; drinksTake: number }
  | { type: "DRINK_GIVE"; from: string; to: string; amount: number }
  | { type: "DRINK_AUTO"; to: string; amount: number }
  | { type: "PLAYER_READY"; playerId: string };

type ServerMessage =
  | { type: "room_joined"; playerId: string; room: Room }
  | { type: "player_joined"; player: Player }
  | { type: "player_left"; playerId: string }
  | { type: "room_locked"; locked: boolean }
  | { type: "phase_changed"; phase: Phase }
  | { type: "bids_updated"; bids: Bid[] }
  | { type: "race_log"; events: RaceLogEvent[] }
  | { type: "race_ended"; placements: { suit: Suit; placement: number }[]; settlement: { playerId: string; drinksGive: number; drinksTake: number }[] }
  | { type: "drinks_updated"; drinks: { playerId: string; give: number; take: number; consume: number }[] }
  | { type: "player_ready"; playerId: string; ready: boolean }
  | { type: "error"; code: string; message: string }
  | { type: "state_sync"; room: Room };

// ── State ─────────────────────────────────────────────────────────────

type View = "home" | "lobby" | "bidding" | "racing" | "done";

const state = {
  view: "home" as View,
  roomCode: "",
  playerId: "",
  wsConn: null as ReturnType<typeof connectWs> | null,
  room: null as Room | null,
  selectedSuit: null as Suit | null,
  selectedAmount: 0,
  bidPlaced: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────

function $(id: string): HTMLElement { return document.getElementById(id)!; }

// ── Rendering ─────────────────────────────────────────────────────────

function showView(view: View) {
  state.view = view;
  $("home-view").style.display = view === "home" ? "block" : "none";
  $("lobby-view").style.display = view === "lobby" ? "block" : "none";
  $("bidding-view").style.display = view === "bidding" ? "block" : "none";
  $("racing-view").style.display = view === "racing" ? "block" : "none";
  $("done-view").style.display = view === "done" ? "block" : "none";
}

function showError(msg: string) {
  const el = $("error-banner");
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 5000);
}

function renderLobby() {
  if (!state.room) return;
  const r = state.room;
  $("lobby-code").textContent = r.roomCode;
  $("lobby-locked").style.display = r.isLocked ? "inline" : "none";

  const isHost = state.playerId === r.hostId;
  $("host-controls").style.display = isHost ? "block" : "none";
  if (isHost) {
    ($("track-length") as HTMLInputElement).value = String(r.trackLength);
    ($("lock-btn") as HTMLButtonElement).textContent = r.isLocked ? "Unlock Room" : "Lock Room";
  }

  const list = $("player-list");
  list.innerHTML = "";
  for (const p of r.players) {
    const li = document.createElement("li");
    const status = p.isConnected ? "" : " (disconnected)";
    const hostMark = p.id === r.hostId ? " [HOST]" : "";
    const typeMark = p.type === "hosted" ? " [hosted]" : "";
    li.textContent = `${p.name}${hostMark}${typeMark}${status}`;
    list.appendChild(li);
  }
}

function renderBidding() {
  if (!state.room) return;
  const r = state.room;
  if (r.bidDeadlineMs) {
    const remaining = Math.max(0, Math.ceil((r.bidDeadlineMs - Date.now()) / 1000));
    $("bid-timer").textContent = `${remaining}s`;
  }
  if (state.bidPlaced) {
    $("bid-form").style.display = "none";
    $("bid-confirmed").style.display = "block";
  } else {
    $("bid-form").style.display = "block";
    $("bid-confirmed").style.display = "none";
    ($("submit-bid-btn") as HTMLButtonElement).disabled = !state.selectedSuit || state.selectedAmount === 0;
  }
  const list = $("bid-status-list");
  list.innerHTML = "";
  for (const p of r.players) {
    const li = document.createElement("li");
    const hasBid = !!r.bids[p.id];
    li.textContent = `${p.name}: ${hasBid ? "confirmed" : "pending"}`;
    if (hasBid) li.style.color = "#40f040";
    list.appendChild(li);
  }
}

function eventToText(e: RaceLogEvent): string {
  switch (e.type) {
    case "DECK_DRAW": return `Draw: ${e.card.rank} of ${e.suit}${e.ignored ? " (ignored)" : ""}`;
    case "HORSE_MOVE": return `${e.suit} moves ${e.from}→${e.to} (${e.reason})`;
    case "TRACK_FLIP": return `Track card ${e.index} flipped: ${e.suit}${e.ignored ? " (ignored)" : ""}`;
    case "HORSE_FINISH": return `${e.suit} finishes in place ${e.placement}!`;
    case "RACE_END": return "Race over!";
    case "SETTLEMENT": return `Player ${e.playerId}: give ${e.drinksGive}, take ${e.drinksTake}`;
    case "DRINK_GIVE": return `${e.from} gives ${e.amount} to ${e.to}`;
    case "DRINK_AUTO": return `Auto: ${e.amount} drink to ${e.to}`;
    case "PLAYER_READY": return `Player ${e.playerId} is ready`;
  }
}

function renderRacing() {
  if (!state.room) return;
  const r = state.room;
  const track = $("horse-track");
  const colors: Record<string, string> = { Coins: "#e94560", Cups: "#f0c040", Swords: "#40c0f0", Clubs: "#40f040" };
  const maxPos = r.trackLength + 1;
  track.innerHTML = "";
  for (const h of r.horses) {
    const pct = Math.min(100, Math.max(0, (h.position / maxPos) * 100));
    const dot = document.createElement("div");
    dot.className = "horse-dot";
    dot.style.cssText = `left:${pct}%;top:${SUITS.indexOf(h.suit) * 30 + 4}px;background:${colors[h.suit] || "#fff"};`;
    track.appendChild(dot);
    const label = document.createElement("div");
    label.className = "horse-label";
    label.style.cssText = `left:${pct}%;top:${SUITS.indexOf(h.suit) * 30 + 18}px;`;
    label.textContent = h.suit;
    track.appendChild(label);
    if (h.isFinished) {
      const finish = document.createElement("div");
      finish.style.cssText = `position:absolute;left:${pct}%;top:${SUITS.indexOf(h.suit) * 30 + 4}px;font-size:0.7rem;color:gold;`;
      finish.textContent = `#${h.placement}`;
      track.appendChild(finish);
    }
  }
}

function appendRaceLog(el: HTMLElement, events: RaceLogEvent[]) {
  for (const e of events) {
    const div = document.createElement("div");
    div.textContent = eventToText(e);
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight;
}

function renderDone() {
  if (!state.room) return;
  const r = state.room;
  $("done-phase-badge").textContent = r.state;
  $("ready-btn").style.display = r.state === "READY" ? "block" : "none";
  const me = r.players.find(p => p.id === state.playerId);
  if (me) {
    $("drinks-display").innerHTML = `
      <p>Give: ${me.drinks.give} | Take: ${me.drinks.take} | Consume: ${me.drinks.consume}</p>
      ${me.drinks.isReady ? '<p style="color:#40f040;">Ready!</p>' : ""}
    `;
  }
}

// ── Message handler ──────────────────────────────────────────────────

function handleMessage(data: string) {
  const msg: ServerMessage = JSON.parse(data);
  switch (msg.type) {
    case "room_joined":
      state.playerId = msg.playerId;
      state.room = msg.room;
      state.roomCode = msg.room.roomCode;
      showView("lobby");
      renderLobby();
      break;
    case "player_joined":
      if (state.room) { state.room.players.push(msg.player); renderLobby(); }
      break;
    case "player_left":
      if (state.room) { state.room.players = state.room.players.filter(p => p.id !== msg.playerId); renderLobby(); }
      break;
    case "room_locked":
      if (state.room) { state.room.isLocked = msg.locked; renderLobby(); }
      break;
    case "phase_changed":
      if (state.room) {
        state.room.state = msg.phase;
        if (msg.phase === "BIDDING") { state.bidPlaced = false; state.selectedSuit = null; state.selectedAmount = 0; showView("bidding"); renderBidding(); }
        else if (msg.phase === "RACING") { showView("racing"); ($("race-log") as HTMLElement).innerHTML = ""; renderRacing(); }
        else if (msg.phase === "DISTRIBUTION" || msg.phase === "SETTLEMENT") { showView("done"); renderDone(); }
        else if (msg.phase === "READY") { showView("done"); renderDone(); }
        else if (msg.phase === "LOBBY") { showView("lobby"); renderLobby(); }
      }
      break;
    case "bids_updated":
      if (state.room) {
        for (const bid of msg.bids) state.room.bids[bid.playerId] = bid;
        if (state.view === "bidding") renderBidding();
      }
      break;
    case "race_log":
      if (state.view === "racing") {
        appendRaceLog($("race-log") as HTMLElement, msg.events);
        if (state.room) {
          for (const e of msg.events) {
            state.room.raceLog.push(e);
            if (e.type === "HORSE_MOVE") { const h = state.room.horses.find(h => h.suit === e.suit); if (h) h.position = e.to; }
            if (e.type === "HORSE_FINISH") { const h = state.room.horses.find(h => h.suit === e.suit); if (h) { h.isFinished = true; h.placement = e.placement; } }
          }
          renderRacing();
        }
      }
      if (state.view === "done") appendRaceLog($("done-race-log") as HTMLElement, msg.events);
      break;
    case "race_ended":
      if (state.room) {
        $("placements-display").innerHTML = "<h3>Placements</h3>" + msg.placements.map(p => `<p>${p.placement}${ordinal(p.placement)}: ${p.suit}</p>`).join("");
        $("settlement-display").innerHTML = "<h3>Settlement</h3>" + msg.settlement.map(s => {
          const player = state.room!.players.find(p => p.id === s.playerId);
          return `<p>${player?.name || s.playerId}: +${s.drinksGive} give, +${s.drinksTake} take</p>`;
        }).join("");
        showView("done"); renderDone();
      }
      break;
    case "drinks_updated":
      if (state.room) {
        for (const d of msg.drinks) { const p = state.room.players.find(pl => pl.id === d.playerId); if (p) p.drinks = { ...p.drinks, give: d.give, take: d.take, consume: d.consume }; }
        if (state.view === "done") renderDone();
      }
      break;
    case "player_ready":
      if (state.room) { const p = state.room.players.find(pl => pl.id === msg.playerId); if (p) p.drinks.isReady = msg.ready; if (state.view === "done") renderDone(); }
      break;
    case "state_sync":
      state.room = msg.room; state.roomCode = msg.room.roomCode;
      if (msg.room.state === "LOBBY") { showView("lobby"); renderLobby(); }
      else if (msg.room.state === "BIDDING") { showView("bidding"); renderBidding(); }
      else if (msg.room.state === "RACING") { showView("racing"); renderRacing(); }
      else { showView("done"); renderDone(); }
      break;
    case "error":
      showError(`[${msg.code}] ${msg.message}`);
      break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function ordinal(n: number): string { return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"; }

async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const resp = await fetch(`${WORKER_ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return resp.json();
}

function getWsUrl(roomCode: string): string {
  const wsOrigin = WORKER_ORIGIN.replace(/^http/, "ws");
  return `${wsOrigin}/ws?room=${roomCode}`;
}

// ── Event handlers ────────────────────────────────────────────────────

$("create-btn").addEventListener("click", async () => {
  const name = ($("create-name") as HTMLInputElement).value.trim();
  if (!name) { showError("Enter your name"); return; }
  try {
    const resp = await apiPost("/api/room") as { roomCode: string; error?: string };
    if (resp.error) { showError(resp.error); return; }
    state.roomCode = resp.roomCode;
    const url = getWsUrl(resp.roomCode);
    const conn = connectWs(url, { onMessage: handleMessage, onClose: (r) => showError(`Connection lost: ${r}`) });
    state.wsConn = conn;
    const checkOpen = setInterval(() => { if (conn.ws.readyState === WebSocket.OPEN) { clearInterval(checkOpen); sendWs(conn.ws, { type: "join_room", roomCode: resp.roomCode, playerName: name }); } }, 50);
  } catch { showError("Failed to create room"); }
});

$("join-btn").addEventListener("click", async () => {
  const code = ($("join-code") as HTMLInputElement).value.trim().toUpperCase();
  const name = ($("join-name") as HTMLInputElement).value.trim();
  if (!code) { showError("Enter room code"); return; }
  if (!name) { showError("Enter your name"); return; }
  try {
    const resp = await fetch(`${WORKER_ORIGIN}/api/room/${code}/state`);
    if (resp.status === 404) { showError("Room not found"); return; }
    state.roomCode = code;
    const url = getWsUrl(code);
    const conn = connectWs(url, { onMessage: handleMessage, onClose: (r) => showError(`Connection lost: ${r}`) });
    state.wsConn = conn;
    const checkOpen = setInterval(() => { if (conn.ws.readyState === WebSocket.OPEN) { clearInterval(checkOpen); sendWs(conn.ws, { type: "join_room", roomCode: code, playerName: name }); } }, 50);
  } catch { showError("Failed to join room"); }
});

$("lock-btn").addEventListener("click", () => { if (!state.wsConn || !state.room) return; sendWs(state.wsConn.ws, { type: "host_lock_room", locked: !state.room.isLocked }); });
$("start-race-btn").addEventListener("click", () => { if (!state.wsConn) return; sendWs(state.wsConn.ws, { type: "host_start_race" }); });
$("add-hosted-btn").addEventListener("click", () => { if (!state.wsConn) return; const n = ($("hosted-name") as HTMLInputElement).value.trim(); if (!n) { showError("Enter name"); return; } sendWs(state.wsConn.ws, { type: "host_add_hosted_player", playerName: n }); ($("hosted-name") as HTMLInputElement).value = ""; });
$("track-length").addEventListener("change", () => { if (!state.wsConn) return; const v = parseInt(($("track-length") as HTMLInputElement).value, 10); if (v >= 6 && v <= 20) sendWs(state.wsConn.ws, { type: "host_set_track_length", length: v }); });

function setupBidButtons() {
  const suitBtns = $("suit-btns");
  suitBtns.innerHTML = "";
  for (const suit of SUITS) {
    const btn = document.createElement("button");
    btn.textContent = suit;
    btn.addEventListener("click", () => { state.selectedSuit = suit; ($("submit-bid-btn") as HTMLButtonElement).disabled = !state.selectedSuit || state.selectedAmount === 0; suitBtns.querySelectorAll("button").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); });
    suitBtns.appendChild(btn);
  }
  const amtBtns = $("amount-btns");
  amtBtns.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = String(i);
    btn.addEventListener("click", () => { state.selectedAmount = i; ($("submit-bid-btn") as HTMLButtonElement).disabled = !state.selectedSuit || state.selectedAmount === 0; amtBtns.querySelectorAll("button").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); });
    amtBtns.appendChild(btn);
  }
}

$("submit-bid-btn").addEventListener("click", () => { if (!state.wsConn || !state.selectedSuit || state.selectedAmount === 0) return; sendWs(state.wsConn.ws, { type: "place_bid", suit: state.selectedSuit, amount: state.selectedAmount }); state.bidPlaced = true; renderBidding(); });
$("ready-btn").addEventListener("click", () => { if (!state.wsConn) return; sendWs(state.wsConn.ws, { type: "ready", ready: true }); });

setupBidButtons();
showView("home");
