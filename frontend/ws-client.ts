/**
 * Thin WebSocket wrapper with exponential-backoff reconnect.
 */

export type WsCallbacks = {
  onMessage: (data: string) => void;
  onClose: (reason: string) => void;
};

export function connectWs(
  url: string,
  callbacks: WsCallbacks,
  maxRetries: number = 10,
): { ws: WebSocket; close: () => void } {
  let retries = 0;
  let closed = false;
  let ws: WebSocket;

  function create(): WebSocket {
    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      callbacks.onMessage(event.data as string);
    };

    socket.onclose = () => {
      if (closed) return;
      if (retries < maxRetries) {
        const delay = Math.min(5000, 500 * Math.pow(2, retries));
        retries++;
        setTimeout(() => {
          if (!closed) ws = create();
        }, delay);
      } else {
        callbacks.onClose("Max reconnection attempts reached");
      }
    };

    socket.onerror = () => {
      // onclose will fire after this
    };

    return socket;
  }

  ws = create();

  return {
    get ws() { return ws; },
    close: () => {
      closed = true;
      ws.close();
    },
  };
}

export function sendWs(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
