// Visual rewards for finishing the daily combo. canvas-confetti is loaded on first use so it stays out of the main bundle.
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// kind: null for a normal completion, 'saved' or 'restart' for a comeback (embers rise from the bottom instead).
export async function celebrate(kind = null) {
  if (reducedMotion()) return;
  const { default: confetti } = await import('canvas-confetti');
  const base = { zIndex: 1000, disableForReducedMotion: true };

  if (kind) {
    const colors = ['#f59e0b', '#fb923c', '#fde68a', '#ef4444'];
    const rise = { ...base, colors, shapes: ['star'], origin: { x: 0.5, y: 1.05 }, angle: 90, gravity: 0.7, ticks: 260 };
    confetti({ ...rise, particleCount: 60, spread: 50, startVelocity: 62, scalar: 1.3 });
    setTimeout(() => confetti({ ...rise, particleCount: 40, spread: 90, startVelocity: 48, scalar: 1 }), 220);
    return;
  }

  confetti({ ...base, particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.35 } });
  setTimeout(() => confetti({ ...base, particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.55 } }), 160);
  setTimeout(() => confetti({ ...base, particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.55 } }), 160);
}
