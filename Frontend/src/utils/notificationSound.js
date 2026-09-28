const LAST_PLAYED_KEY = "acc-sound-played";

let context = null;

const audioContext = () => {
  if (context) return context;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  context = new AudioCtx();
  return context;
};

export function unlockNotificationSound() {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

const claimTurn = () => {
  try {
    const last = Number(localStorage.getItem(LAST_PLAYED_KEY)) || 0;
    if (Date.now() - last < 3000) return false;
    localStorage.setItem(LAST_PLAYED_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
};

export function playNotificationSound({ shared = true } = {}) {
  if (shared && !claimTurn()) return;

  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const start = ctx.currentTime + 0.02;
  [
    [880, 0],
    [1318.5, 0.13],
  ].forEach(([frequency, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.16, start + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + delay);
    osc.stop(start + delay + 0.45);
  });
}
