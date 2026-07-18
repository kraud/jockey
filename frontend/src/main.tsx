import { render } from "solid-js/web";
import App from "./App";
// ── frontend/src/main.tsx — SPA entry point; render(() => <App />, root) into #root. ──
// Depends on: ./App.
// Used by: (HTML host page).


const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

render(() => <App />, root);
