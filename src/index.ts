import type { Env } from "./room";
export { Room } from "./room";

// ── src/index.ts — Worker HTTP router; POST /api/room, GET /api/room/:code/state, GET /ws?room=…; no game state. ──
// Depends on: ./room (Room class, Env type).
// Used by: wrangler.toml (entry point).

// ── Room code generation ─────────────────────────────────────────────

const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const MAX_COLLISION_RETRIES = 8;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length); // not crypto-safe, fine for codes
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

// ── Worker ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // POST /api/room — create a new room.
    if (pathname === "/api/room" && request.method === "POST") {
      for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
        const code = generateRoomCode();
        const id = env.ROOM.idFromName(code);
        const stub = env.ROOM.get(id);

        // Try to init the DO. If the DO already has in-memory state,
        // this is a collision — retry.
        const initResp = await stub.fetch("https://internal/init", {
          method: "POST",
        });

        if (initResp.ok) {
          return new Response(JSON.stringify({ roomCode: code }), {
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
            },
          });
        }
        // Collision — retry with a new code.
      }

      return new Response(
        JSON.stringify({ error: "Could not generate unique room code" }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        },
      );
    }

    // GET /api/room/:code/state — check if room exists.
    const stateMatch = pathname.match(/^\/api\/room\/([A-Z0-9]+)\/state$/);
    if (stateMatch && request.method === "GET") {
      const code = stateMatch[1]!;
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);

      const resp = await stub.fetch("https://internal/state", {
        method: "GET",
      });

      if (resp.status === 404) {
        return new Response(
          JSON.stringify({ error: "Room not found" }),
          {
            status: 404,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
            },
          },
        );
      }

      const body = await resp.json<{ room: unknown }>();
      return new Response(JSON.stringify(body), {
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    }

    // GET /ws?room=CODE — WebSocket upgrade.
    if (pathname === "/ws" && request.method === "GET") {
      const code = url.searchParams.get("room");
      if (!code) {
        return new Response("Missing room code", { status: 400 });
      }

      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);

      // Forward the upgrade request to the DO, including the room code.
      const headers = new Headers(request.headers);
      headers.set("x-room-code", code);
      const upgradeReq = new Request("https://internal/ws", {
        headers,
      });
      const resp = await stub.fetch(upgradeReq);

      // Add CORS for error responses.
      if (resp.status !== 101) {
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            ...Object.fromEntries(resp.headers),
            "access-control-allow-origin": "*",
          },
        });
      }

      return resp;
    }

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    }

    // Serve frontend static assets in dev mode.
    // In production this is handled by Pages; in wrangler dev we
    // serve the static files directly.
    if (pathname === "/" || pathname === "/index.html") {
      // For wrangler dev, we attempt to serve the frontend.
      // The frontend files are in frontend/dist/ after build.
      try {
        const { default: indexHtml } = await import("../frontend/dist/index.html");
        // We can't import .html, so just return a redirect.
      } catch {
        // Fall through to 404.
      }
    }

    return new Response("Not found", {
      status: 404,
      headers: { "access-control-allow-origin": "*" },
    });
  },
};
