// "How to play": the fundamentals in plain sentences (Principal 2026-10-17). Closed on load, every visit; the
// "How to play" button next to the title opens and closes it. Keep it in step with page.tsx and lib/auth.ts.
import { useEffect, useRef, useState, type RefObject } from 'react';

export default function HowToPlay({ about = false }: { about?: boolean }) {
  return (
    <div className="howto">
      <h3>The goal</h3>
      <p>Slide the numbered tiles until they read in order, left to right and top to bottom, with the empty space in the bottom-right corner.</p>

      <h3>How to play</h3>
      <p>Tap or click a tile in the same row or column as the empty space. That tile, and any tiles between it and the space, slide over. You can also swipe on the board, or use the arrow keys or W, A, S and D. The tile moves the way you push.</p>
      <p>Undo (or the Z key) takes back your last move. Hint (or H) lights up the next tile to move. Restart puts the board back to how it started. New board gives you a fresh shuffle. The buttons at the top pick the Daily puzzle or a 3x3, 4x4 or 5x5 board.</p>

      <h3>What things cost</h3>
      <p>There are no coins or lives. Without the full game you get 5 practice games a day on the 3x3 and 4x4 boards. A game counts once you make your first move, and Restart or New board starts a new one. The Daily puzzle is always open and does not use a practice game.</p>
      <p>The full game is a one-time payment of $3. It gives you unlimited practice games and the 5x5 board. It unlocks in the browser you paid in.</p>

      <h3>How you earn</h3>
      <p>Each solve earns up to 3 stars. Finish in par or fewer moves for 3 stars, within one and a half times par for 2 stars, and in more moves for 1 star. Par on 3x3 is the shortest possible solution, and on 4x4 it is the shortest one our solver found. The 5x5 board has no par, so it has no stars.</p>
      <p>Solve without hints to set a personal best and post your time to the leaderboard. Solve the Daily on days in a row to build a streak. Stars and times have no cash value. You cannot win money in this game.</p>

      <h3>The challenge</h3>
      <p>Every slide moves tiles you already placed, so fixing one row can undo another. Undo also adds a move to your count. Using a hint keeps that solve off the leaderboard and out of your personal best. Bigger boards take many more moves. You cannot lose; the challenge is your move count and the clock.</p>

      <h3>Quick tip</h3>
      <p>Finish the top row first, then the left column, and work your way toward the bottom-right corner.</p>

      {about && (
        <details className="about">
          <summary>Read more about Sliding Numbers</summary>
          <p>Sliding Numbers is the classic sliding-tile puzzle. Every board is shuffled so it can always be solved. The Daily is one 4x4 board, the same for every player that day, and replays keep your best result. A small green mark means a tile is already in its home spot. Your bests and streak are saved in this browser.</p>
        </details>
      )}
    </div>
  );
}

/** Open state for the How to play panel: closed on load (opens only for an explicit #how-to-play link), Esc closes it
 *  before the game's own keys see it, and focus moves into the panel on open and back to the button on close. */
export function useHowto() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => { if (window.location.hash === '#how-to-play') setOpen(true); }, []);
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpen.current) btnRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation(); setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return { open, setOpen, btnRef, panelRef, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

export type Howto = ReturnType<typeof useHowto>;

export function HowToButton({ howto, className = 'tool' }: { howto: Howto; className?: string }) {
  return (
    <button ref={howto.btnRef} type="button" className={className} aria-expanded={howto.open} aria-controls="how-to-play" onClick={howto.toggle}>
      How to play
    </button>
  );
}

export function HowToPanel({ howto }: { howto: Howto }) {
  return (
    <section className="htp" id="how-to-play" aria-labelledby="htp-title" tabIndex={-1} hidden={!howto.open}
      ref={howto.panelRef as RefObject<HTMLElement>}>
      <div className="htp-head">
        <h2 id="htp-title">How to play</h2>
        <button type="button" className="tool" onClick={howto.close}>Hide</button>
      </div>
      <HowToPlay about />
    </section>
  );
}
