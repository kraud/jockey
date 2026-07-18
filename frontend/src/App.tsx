import { Router, Route } from "@solidjs/router";
import HomeView from "./views/HomeView";
import RoomView from "./views/RoomView";
// ── frontend/src/App.tsx — @solidjs/router Router with two routes: / → HomeView, /room/:code → RoomView. ──
// Depends on: @solidjs/router, ./views/HomeView, ./views/RoomView.
// Used by: main.tsx.


export default function App() {
  return (
    <Router>
      <Route path="/" component={HomeView} />
      <Route path="/room/:code" component={RoomView} />
    </Router>
  );
}
