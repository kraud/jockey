import { describe, expect, test } from "bun:test";
import { parseClientMessage, WsProtocolError } from "../src/ws/messages";

describe("parseClientMessage", () => {
  test("create_room", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "create_room" }));
    expect(msg.type).toBe("create_room");
  });

  test("join_room valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "join_room",
      roomCode: "AB12",
      playerName: "Alice",
    }));
    expect(msg.type).toBe("join_room");
    if (msg.type === "join_room") {
      expect(msg.roomCode).toBe("AB12");
      expect(msg.playerName).toBe("Alice");
    }
  });

  test("join_room trims playerName", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "join_room",
      roomCode: "XY99",
      playerName: "  Bob  ",
    }));
    if (msg.type === "join_room") {
      expect(msg.playerName).toBe("Bob");
    }
  });

  test("host_lock_room", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "host_lock_room",
      locked: true,
    }));
    if (msg.type === "host_lock_room") {
      expect(msg.locked).toBe(true);
    }
  });

  test("host_kick_player", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "host_kick_player",
      playerId: "p1",
    }));
    if (msg.type === "host_kick_player") {
      expect(msg.playerId).toBe("p1");
    }
  });

  test("host_add_hosted_player", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "host_add_hosted_player",
      playerName: "Charlie",
    }));
    if (msg.type === "host_add_hosted_player") {
      expect(msg.playerName).toBe("Charlie");
    }
  });

  test("host_start_race", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "host_start_race" }));
    expect(msg.type).toBe("host_start_race");
  });

  test("place_bid valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "place_bid",
      suit: "Coins",
      amount: 3,
    }));
    if (msg.type === "place_bid") {
      expect(msg.suit).toBe("Coins");
      expect(msg.amount).toBe(3);
    }
  });

  test("host_place_bid valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "host_place_bid",
      playerId: "p2",
      suit: "Cups",
      amount: 5,
    }));
    if (msg.type === "host_place_bid") {
      expect(msg.playerId).toBe("p2");
      expect(msg.suit).toBe("Cups");
      expect(msg.amount).toBe(5);
    }
  });

  test("host_advance_phase", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "host_advance_phase" }));
    expect(msg.type).toBe("host_advance_phase");
  });

  test("assign_drink valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "assign_drink",
      to: "p3",
      amount: 2,
    }));
    if (msg.type === "assign_drink") {
      expect(msg.to).toBe("p3");
      expect(msg.amount).toBe(2);
    }
  });

  test("ready valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "ready",
      ready: true,
    }));
    if (msg.type === "ready") {
      expect(msg.ready).toBe(true);
    }
  });

  test("host_set_ready valid", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "host_set_ready",
      playerId: "p4",
      ready: false,
    }));
    if (msg.type === "host_set_ready") {
      expect(msg.playerId).toBe("p4");
      expect(msg.ready).toBe(false);
    }
  });

  // ── Rejection cases ──────────────────────────────────────────────

  test("rejects invalid JSON", () => {
    expect(() => parseClientMessage("not json")).toThrow(WsProtocolError);
    try { parseClientMessage("{"); } catch (e) {
      expect((e as WsProtocolError).code).toBe("PARSE_ERROR");
    }
  });

  test("rejects non-object", () => {
    expect(() => parseClientMessage("42")).toThrow(WsProtocolError);
  });

  test("rejects missing type", () => {
    expect(() => parseClientMessage(JSON.stringify({ foo: "bar" }))).toThrow(WsProtocolError);
  });

  test("rejects unknown type", () => {
    expect(() => parseClientMessage(JSON.stringify({ type: "garbage" }))).toThrow(WsProtocolError);
  });

  test("rejects bad roomCode", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "join_room", roomCode: "ab", playerName: "A",
    }))).toThrow(WsProtocolError);
  });

  test("rejects bad playerName (empty)", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "join_room", roomCode: "ABCD", playerName: "",
    }))).toThrow(WsProtocolError);
  });

  test("rejects bad playerName (too long)", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "join_room", roomCode: "ABCD", playerName: "A".repeat(25),
    }))).toThrow(WsProtocolError);
  });

  test("rejects bad suit", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "place_bid", suit: "Hearts", amount: 3,
    }))).toThrow(WsProtocolError);
  });

  test("rejects bid amount out of range", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "place_bid", suit: "Coins", amount: 0,
    }))).toThrow(WsProtocolError);

    expect(() => parseClientMessage(JSON.stringify({
      type: "place_bid", suit: "Coins", amount: 6,
    }))).toThrow(WsProtocolError);

    expect(() => parseClientMessage(JSON.stringify({
      type: "place_bid", suit: "Coins", amount: 1.5,
    }))).toThrow(WsProtocolError);
  });

  test("rejects missing field in place_bid", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "place_bid", suit: "Coins",
    }))).toThrow(WsProtocolError);
  });

  test("rejects assign_drink with zero amount", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "assign_drink", to: "p1", amount: 0,
    }))).toThrow(WsProtocolError);
  });

  test("rejects assign_drink with missing to", () => {
    expect(() => parseClientMessage(JSON.stringify({
      type: "assign_drink", amount: 1,
    }))).toThrow(WsProtocolError);
  });

  test("accepts all four suits for place_bid", () => {
    for (const suit of ["Coins", "Cups", "Swords", "Clubs"]) {
      const msg = parseClientMessage(JSON.stringify({
        type: "place_bid", suit, amount: 1,
      }));
      if (msg.type === "place_bid") {
        expect(msg.suit).toBe(suit);
      }
    }
  });
});
