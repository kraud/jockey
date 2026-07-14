import { createSignal, onCleanup } from "solid-js";
import type { RoomState } from "../ws/store";

interface Props {
  state: RoomState;
}

export default function CountdownView(props: Props) {
  const room = () => props.state.room!;
  const [now, setNow] = createSignal(Date.now());

  const interval = setInterval(() => setNow(Date.now()), 100);
  onCleanup(() => clearInterval(interval));

  const countdownMs = () => room().countdownMs;

  const display = () => {
    const target = countdownMs();
    if (target === null) return "";
    const r = target - now();
    if (r > 2000) return "3";
    if (r > 1000) return "2";
    if (r > 0) return "1";
    return "GO!";
  };

  return (
    <>
      <div class="card">
        <span class="phase-badge">COUNTDOWN</span>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:6rem;padding:2rem 0;">
          {display()}
        </div>
      </div>
    </>
  );
}
