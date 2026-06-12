"use client";

/**
 * One-shot, pure-CSS confetti burst for an exact-score call: 14 small brand-
 * palette squares and dots launch from the card's middle on mount, spinning and
 * fading out over ~1.2s (`confetti-burst` in globals.css). `animation-fill:
 * forwards` parks every piece at opacity 0, so nothing lingers and no JS timer
 * is needed. Purely decorative: aria-hidden, pointer-events-none, and hidden
 * wholesale under prefers-reduced-motion (also in globals.css).
 *
 * Trajectories are deterministic per piece (no Math.random) so server and
 * client markup always agree.
 */

const PALETTE = ["#ffd23f", "#ff5a36", "#6b2fb3", "#1e8fd5", "#0b8a3e"];

const PIECES = Array.from({ length: 14 }, (_, i) => {
  // Cheap deterministic jitter from the piece index (0..1).
  const r = ((i * 73 + 29) % 97) / 97;
  const angle = (i / 14) * Math.PI * 2;
  return {
    color: PALETTE[i % PALETTE.length],
    round: i % 3 === 0,
    dx: Math.round(Math.cos(angle) * (52 + r * 64)),
    // Upward bias so the burst pops over the score rather than raining down.
    dy: Math.round(Math.sin(angle) * (30 + r * 36) - 56),
    rot: Math.round(160 + r * 420) * (i % 2 === 0 ? 1 : -1),
    delay: (i % 5) * 55,
  };
});

export function Confetti() {
  return (
    <div
      aria-hidden
      className="confetti pointer-events-none absolute inset-0 overflow-hidden"
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              backgroundColor: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
