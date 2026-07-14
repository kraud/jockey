import { Router, Route } from "@solidjs/router";
import HomeView from "./views/HomeView";
import RoomView from "./views/RoomView";

export default function App() {
  return (
    <Router>
      <Route path="/" component={HomeView} />
      <Route path="/room/:code" component={RoomView} />
    </Router>
  );
}
