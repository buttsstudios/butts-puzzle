# Sliding Numbers — design

Branch `design/next-level-2026-10-16`, built on `style/studios-sections-2026-10-16` (which carries the verified-purchase fix and the $3 price branch). Nothing deployed. `~/buttsstudios/games/puzzle` is an older clone of the same repo (static `index.html` with local edits); this branch is the canonical one.

## Teardown (before)
- **Core loop:** slide tiles until 1..N are in order. Sound, but nothing made a solve feel earned or worth repeating.
- **Broken basics:** the timer never ran (its interval closed over a null start time, so it showed 0:00 forever). The help text promised an Undo button that did not exist. "Show Solution" teleported the board to solved. The leaderboard read the top 10 of *all* sizes and then filtered, so 4x4/5x5 almost always showed "No scores yet".
- **Onboarding:** a name form blocked the game before the first tile. The name only matters for the leaderboard.
- **Generator:** a random walk of `n*100` steps. Random walks leave lumpy boards: some near-solved, some fine, no control over difficulty.
- **Feel/juice:** tiles snapped (no slide), one tile per click, no keyboard or swipe, no "in place" feedback, a generic modal on win.
- **Difficulty/progression:** three sizes, nothing to aim for (no par, no personal best, no daily).
- **Replay:** none beyond a new random board.
- **Accessibility:** tiles were `div`s (no keyboard focus, no labels); win state was colour only.
- **Mobile:** fixed 80px tiles; 5x5 (5×80 + gaps + padding) overflows a 390px screen.

## What changed (after)
- **Generator** (`lib/puzzle.ts`): uniformly random solvable permutations (parity-checked), filtered to a difficulty band (3x3 at least 18 optimal moves; 4x4/5x5 by Manhattan + linear-conflict heuristic). Every board is a real puzzle.
- **Solver:** exact BFS distance table for all 181,440 3x3 states (built once, ~100 ms); weighted A* with Manhattan + linear conflicts for 4x4 (≈50–60-move lines, close to optimal) and 5x5.
- **Par:** 3x3 par is the true optimum; 4x4 par is the solver's line (the copy says so). Three marks: at or under par, within 1.5× par, solved. 5x5 shows no par (the solver's line there is too loose to be fair).
- **Hints:** Hint (H) highlights the next tile on the solver's line, and caches the rest so following hints is instant. Hinted solves are marked and are not posted to the leaderboard or counted as bests.
- **Undo** (Z): real, unlimited, and honest (it counts as a move). "Show Solution" removed.
- **Daily:** one 4x4 board per date, the same for everyone, always open (it does not use a practice game). Replays keep your best; consecutive days build a streak. Share result posts a short text result (moves, par, time, hints, marks).
- **Feel:** tiles slide (120 ms ease-out, keyed by tile so they travel), tap any tile in the gap's row/column to slide the whole run, swipe and arrow/WASD control, a home mark on tiles in place, an "In place" counter, a diagonal ripple on solve, then the result dialog.
- **Onboarding:** play starts immediately; How to play stays closed until the player opens it from the "How to play" button by the title. The name is asked only when posting a time.
- **Timer:** starts on the first move, from a ref; stops on solve.
- **Leaderboard:** reads a wider window and filters by size, so each size shows its own top 10.
- **Accessibility:** tiles are buttons with "Tile 5, row 2, column 1, in place" labels; aria-live for new boards, hints and solves; visible focus; reduced-motion turns off slides and ripples; position is shown by a shape mark, not colour alone.
- **Mobile:** board is 100% width (max 560px) and square; tile type scales; 2-column controls under 480px; no horizontal scroll.
- **Studios visual pass:** display headline (Archivo 800, tight leading) with eyebrow and Newsreader lede as on buttsstudios.com, plate-style foot line, serif notes, display-type dialogs. Shared bar/footer unchanged; games accent; 2px corners; full even borders; the old `body` flex-centring (which laid the bar, game and footer out side by side) is now a column.
- **Paid unlock unchanged in kind:** 5 practice games a day, 5x5 and unlimited practice with the $3 one-time full game, unlocked only after `/api/verify-purchase` confirms a paid Stripe session.

## Playtest (xps, headless Chromium)
Shots and a GIF of a hinted 3x3 solve: `~/buttsstudios/staged/games_next_level/puzzle/`.
- **Before (live puzzle.buttsstudios.com):** 4 moves in, after 3 s the timer still read 0:00; a name form blocked play; mobile `scrollWidth` 427 on a 390 screen.
- **After (production build on xps):** following hints solved a 3x3 in 21 moves = par 21 (the exact optimum); timer ran; daily 4x4 par 62; six hinted moves + one undo counted 7 moves; the 5x5 gate showed for a non-buyer; mobile `scrollWidth` 390; no page errors. Solver bench on xps (heavily loaded): 4x4 lines of 50–62 moves in 50–820 ms, 5x5 in 40 ms–3 s.

## Next
- Daily leaderboard (needs a Firestore field for the date, so a server-side write rule change).
- Move the solver to a Web Worker so 5x5 hints never block the main thread on slow phones.
