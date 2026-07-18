import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
// ── frontend/src/views/HomeView.tsx — Landing page: name capture + create-room and join-room flows, persists name in sessionStorage. ──
// Depends on: @solidjs/router, solid-js.
// Used by: App.tsx.


export default function HomeView() {
  const navigate = useNavigate();
  const [error, setError] = createSignal("");
  const [mode, setMode] = createSignal<"name" | "room">("name");
  const [playerName, setPlayerName] = createSignal(
    sessionStorage.getItem("cdc:name") ?? ""
  );
  const [createRoomName, setCreateRoomName] = createSignal(
    sessionStorage.getItem("cdc:name") ?? ""
  );
  const [joinCode, setJoinCode] = createSignal("");
  const [joinRoomName, setJoinRoomName] = createSignal(
    sessionStorage.getItem("cdc:name") ?? ""
  );

  function captureName() {
    const name = playerName().trim();
    if (!name) { setError("Enter your name"); return; }
    setError("");
    sessionStorage.setItem("cdc:name", name);
    setCreateRoomName(name);
    setJoinRoomName(name);
    setMode("room");
  }

  async function handleCreate() {
    const name = createRoomName().trim();
    if (!name) { setError("Enter your name"); return; }
    setError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "Request failed");
        return;
      }
      const data = await res.json() as { roomCode: string };
      sessionStorage.setItem("cdc:name", name);
      navigate(`/room/${data.roomCode}?name=${encodeURIComponent(name)}`);
    } catch {
      setError("Network error");
    }
  }

  async function handleJoin() {
    const code = joinCode().trim().toUpperCase();
    const name = joinRoomName().trim();
    if (!code || !name) { setError("Enter code and name"); return; }
    setError("");
    try {
      const res = await fetch(`/api/room/${code}/state`);
      if (!res.ok) {
        setError("Room not found");
        return;
      }
      sessionStorage.setItem("cdc:name", name);
      navigate(`/room/${code}?name=${encodeURIComponent(name)}`);
    } catch {
      setError("Network error");
    }
  }

  return (
    <div class="container">
      <h1>CDC</h1>
      {error() && <div class="error-banner visible">{error()}</div>}

      <Show when={mode() === "name"}>
        <div class="card">
          <h2>Welcome</h2>
          <input
            type="text"
            placeholder="Your name"
            maxLength={24}
            value={playerName()}
            onInput={(e) => setPlayerName(e.currentTarget.value)}
          />
          <button onClick={captureName}>Continue</button>
        </div>
      </Show>

      <Show when={mode() === "room"}>
        <p style="margin:0.25rem 0;">Playing as <strong>{playerName()}</strong></p>

        <div class="card">
          <h2>Create Room</h2>
          <input
            type="text"
            placeholder="Your name"
            maxLength={24}
            value={createRoomName()}
            onInput={(e) => setCreateRoomName(e.currentTarget.value)}
          />
          <button onClick={handleCreate}>Create</button>
        </div>

        <div class="card">
          <h2>Join Room</h2>
          <input
            type="text"
            placeholder="Room code (e.g. AB12)"
            maxLength={6}
            style="text-transform:uppercase"
            value={joinCode()}
            onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
          />
          <input
            type="text"
            placeholder="Your name"
            maxLength={24}
            value={joinRoomName()}
            onInput={(e) => setJoinRoomName(e.currentTarget.value)}
          />
          <button onClick={handleJoin}>Join</button>
        </div>
      </Show>
    </div>
  );
}
