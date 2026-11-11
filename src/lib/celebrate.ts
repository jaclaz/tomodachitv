// Short (~2s) confetti burst for finishing a season or a whole series.
// Loaded lazily so it never runs during SSR.
export async function celebrate(kind: "season" | "series") {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#a78bfa", "#f472b6", "#facc15", "#34d399", "#60a5fa"];
  const base = { colors, ticks: 160, zIndex: 9999, disableForReducedMotion: true };
  if (kind === "season") {
    confetti({ ...base, particleCount: 90, spread: 75, startVelocity: 40, origin: { y: 0.7 } });
    return;
  }
  const end = Date.now() + 1600;
  const frame = () => {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  confetti({ ...base, particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.6 } });
  frame();
}
