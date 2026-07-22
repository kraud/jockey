import "./styles/design-tokens.css";
import "./styles/global.css";
import { render } from "solid-js/web";
import App from "./App";
// ── main.tsx — SPA entry point; renders App into #root. ──
// Depends on: ./App, ./styles/design-tokens.css, ./styles/global.css.
// Used by: (HTML host page).


const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

render(() => <App />, root);
