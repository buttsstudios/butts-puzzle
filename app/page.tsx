'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { savePuzzleScore, getPuzzleLeaderboard } from '@/lib/firebase';
import {
  login as saveName,
  getPlayerName,
  isPremium,
  getDailyTries,
  canPlay,
  canAccess5x5,
  setPremium,
  decrementTries,
} from '@/lib/auth';
import {
  Board, generate, isSolved, neighbors, solve, par as computePar, rng, dailySeed, todayKey, solvedBoard,
} from '@/lib/puzzle';
import HowToPlay from './how-to-play';

interface Score { id: string; playerName: string; moves: number; time: number; gridSize: number; }
type Mode = 'practice' | 'daily';
type Dir = 'up' | 'down' | 'left' | 'right';

const DAILY_SIZE = 4;
const LS = {
  get(k: string, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function dailyStreak(): number {
  let solved: Record<string, unknown> = {};
  try { solved = JSON.parse(LS.get('sliding_numbers_daily', '{}')); } catch { /* ignore */ }
  let n = 0;
  const d = new Date();
  if (!solved[todayKey(d)]) d.setDate(d.getDate() - 1); // a streak stays alive until today's is missed
  while (solved[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const OUT_OF_TRIES = 'That is all five of today’s practice games. Today’s daily puzzle is still open, or unlock the full game for unlimited play.';

export default function SlidingNumbers() {
  const [n, setN] = useState(3);
  const [mode, setMode] = useState<Mode>('practice');
  const [tiles, setTiles] = useState<Board>(solvedBoard(3));
  const [start, setStart] = useState<Board>(solvedBoard(3));
  const [history, setHistory] = useState<number[]>([]); // blank position before each move (for undo)
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [parMoves, setParMoves] = useState<number | null>(null);
  const [hintCell, setHintCell] = useState<number | null>(null);
  const [hints, setHints] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [premium, setPremiumState] = useState(false);
  const [tries, setTries] = useState(5);
  const [name, setName] = useState('');
  const [posted, setPosted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [modal, setModal] = useState<'none' | 'paywall' | 'upgrade' | 'help' | 'win'>('none');
  const [paywallMsg, setPaywallMsg] = useState('');
  const [announce, setAnnounce] = useState('');
  const [toast, setToast] = useState('');
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState<{ moves?: number; time?: number }>({});

  const t0 = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const solution = useRef<{ key: string; path: number[] } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

  // ---------- new game ----------
  const newGame = useCallback((size: number, m: Mode) => {
    if (m === 'practice' && size === 5 && !canAccess5x5()) { setPaywallMsg('The 5x5 board comes with the full game.'); setModal('paywall'); return; }
    stopTimer();
    t0.current = null;
    const board = m === 'daily' ? generate(DAILY_SIZE, rng(dailySeed())) : generate(size, Math.random);
    const s = m === 'daily' ? DAILY_SIZE : size;
    setN(s); setMode(m); setTiles(board); setStart(board); setHistory([]); setMoves(0); setElapsed(0);
    setStarted(false); setWon(false); setHints(0); setHintCell(null); setPosted(false);
    solution.current = null;
    setParMoves(null);
    if (s <= 4) setTimeout(() => setParMoves(computePar(board, s)), 30); // exact on 3x3; solver line on 4x4
    setAnnounce(m === 'daily' ? `Daily puzzle for ${todayKey()}, ${s} by ${s}.` : `New ${s} by ${s} board.`);
    setModal((cur) => (cur === 'help' ? cur : 'none'));
  }, []);

  // ---------- boot: verified purchase + saved state ----------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      fetch(`/api/verify-purchase?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((d) => { if (d && d.premium === true) { setPremium(true); setPremiumState(true); setToast('Full game unlocked in this browser.'); } })
        .catch(() => {});
    }
    setName(getPlayerName());
    setPremiumState(isPremium());
    setTries(getDailyTries());
    setStreak(dailyStreak());
    newGame(3, 'practice');
    if (!LS.get('sliding_numbers_seen_help')) { setModal('help'); LS.set('sliding_numbers_seen_help', '1'); }
    return () => stopTimer();
  }, [newGame]);

  useEffect(() => {
    getPuzzleLeaderboard(n).then((s) => setLeaderboard(s as Score[]));
    try { setBest(JSON.parse(LS.get(`sliding_numbers_best_${n}`, '{}'))); } catch { setBest({}); }
  }, [n]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);

  const restart = () => {
    stopTimer(); t0.current = null;
    setTiles(start); setHistory([]); setMoves(0); setElapsed(0); setStarted(false); setWon(false); setHintCell(null);
    solution.current = null;
  };

  // ---------- moving ----------
  /** Returns false when the move must not happen (practice games used up). */
  const firstMove = () => {
    if (started) return true;
    if (mode === 'practice' && !premium) {
      if (!canPlay()) { setPaywallMsg(OUT_OF_TRIES); setModal('paywall'); return false; }
      decrementTries(); setTries(getDailyTries());
    }
    setStarted(true);
    t0.current = Date.now();
    timer.current = setInterval(() => { if (t0.current) setElapsed(Math.floor((Date.now() - t0.current) / 1000)); }, 250);
    return true;
  };

  const applyMoves = (cells: number[], fromUndo = false) => {
    if (won || cells.length === 0) return;
    if (!firstMove()) return;
    const b = tiles.slice();
    const blank = n * n - 1;
    const hist = history.slice();
    let done = 0;
    for (const k of cells) {
      const e = b.indexOf(blank);
      if (!neighbors(e, n).includes(k)) break;
      if (!fromUndo) hist.push(e);
      b[e] = b[k]; b[k] = blank; done++;
    }
    if (!done) return;
    setTiles(b);
    setHistory(fromUndo ? hist.slice(0, Math.max(0, hist.length - done)) : hist);
    const total = moves + done;
    setMoves(total);
    setHintCell(null);
    if (isSolved(b)) onWin(total);
  };

  // tap: slide every tile between the tapped tile and the gap (same row or column)
  const clickCell = (i: number) => {
    const e = tiles.indexOf(n * n - 1);
    if (i === e) return;
    const re = Math.floor(e / n), ce = e % n, ri = Math.floor(i / n), ci = i % n;
    const path: number[] = [];
    if (re === ri) { const s = ci > ce ? 1 : -1; for (let c = ce + s; c !== ci + s; c += s) path.push(re * n + c); }
    else if (ce === ci) { const s = ri > re ? 1 : -1; for (let r = re + s; r !== ri + s; r += s) path.push(r * n + ce); }
    else { setAnnounce('That tile is not in line with the gap.'); return; }
    applyMoves(path);
  };

  // arrows/swipe: the tile moves in the direction pushed
  const moveDir = (d: Dir) => {
    const e = tiles.indexOf(n * n - 1), r = Math.floor(e / n), c = e % n;
    const from = d === 'left' ? (c < n - 1 ? e + 1 : -1) : d === 'right' ? (c > 0 ? e - 1 : -1) : d === 'up' ? (r < n - 1 ? e + n : -1) : (r > 0 ? e - n : -1);
    if (from >= 0) applyMoves([from]);
  };

  const undo = () => {
    if (won || history.length === 0) return;
    applyMoves([history[history.length - 1]], true);
  };

  // ---------- hints ----------
  const showHint = (path: number[]) => {
    const cell = path[0];
    setHintCell(cell);
    setHints((h) => h + 1);
    // keep the rest of the line so the next hint is instant if they follow it
    const b = tiles.slice(), blank = n * n - 1, e = b.indexOf(blank);
    b[e] = b[cell]; b[cell] = blank;
    solution.current = { key: b.join(','), path: path.slice(1) };
    setAnnounce(`Hint: move tile ${tiles[cell] + 1}.`);
  };
  const hint = () => {
    if (won || thinking) return;
    const key = tiles.join(',');
    const cached = solution.current;
    if (cached && cached.key === key && cached.path.length) { showHint(cached.path); return; }
    setThinking(true);
    setTimeout(() => {
      const path = solve(tiles, n, n === 5 ? 60000 : 120000);
      setThinking(false);
      if (!path || !path.length) { setToast('No hint found for this board. Try a few moves and ask again.'); return; }
      showHint(path);
    }, 30);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (modal !== 'none') { if (ev.key === 'Escape') setModal('none'); return; }
      const t = ev.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      if (map[ev.key]) { ev.preventDefault(); moveDir(map[ev.key]); }
      else if (ev.key === 'z' || ev.key === 'u') undo();
      else if (ev.key === 'h') hint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- win ----------
  const onWin = (total: number) => {
    stopTimer();
    const time = t0.current ? Math.max(1, Math.floor((Date.now() - t0.current) / 1000)) : elapsed;
    setElapsed(time);
    setWon(true);
    setAnnounce(`Solved in ${total} moves and ${fmt(time)}.`);
    const bk = `sliding_numbers_best_${n}`;
    let b: { moves?: number; time?: number } = {};
    try { b = JSON.parse(LS.get(bk, '{}')); } catch { /* ignore */ }
    if (hints === 0) {
      const nb = { moves: Math.min(b.moves ?? Infinity, total), time: Math.min(b.time ?? Infinity, time) };
      LS.set(bk, JSON.stringify(nb)); setBest(nb);
    }
    if (mode === 'daily') {
      let solved: Record<string, unknown> = {};
      try { solved = JSON.parse(LS.get('sliding_numbers_daily', '{}')); } catch { /* ignore */ }
      const prev = solved[todayKey()] as { moves: number } | undefined;
      if (!prev || total < prev.moves) solved[todayKey()] = { moves: total, time, hints };
      LS.set('sliding_numbers_daily', JSON.stringify(solved));
      setStreak(dailyStreak());
    }
    setTimeout(() => setModal('win'), 700); // let the last slide and the solve ripple land
  };

  const stars = (() => {
    if (!parMoves) return null;
    if (moves <= parMoves) return 3;
    if (moves <= Math.round(parMoves * 1.5)) return 2;
    return 1;
  })();

  const shareText = () => {
    const head = mode === 'daily' ? `Sliding Numbers daily ${todayKey()} (${n}x${n})` : `Sliding Numbers ${n}x${n}`;
    const parTxt = parMoves ? ` (par ${parMoves})` : '';
    const st = stars ? ' ' + '■'.repeat(stars) + '□'.repeat(3 - stars) : '';
    return `${head}\n${moves} moves${parTxt} · ${fmt(elapsed)} · ${hints ? hints + ' hints' : 'no hints'}${st}\nhttps://puzzle.buttsstudios.com`;
  };
  const share = async () => {
    const text = shareText();
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); setToast('Result copied.'); } catch { setToast('Could not copy the result.'); }
  };

  const post = async () => {
    const nm = name.trim().slice(0, 24);
    if (!nm || hints > 0 || posted) return;
    saveName(nm);
    setPosted(true);
    await savePuzzleScore(nm, moves, elapsed, n);
    getPuzzleLeaderboard(n).then((s) => setLeaderboard(s as Score[]));
  };

  // ---------- touch swipe ----------
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null; if (!s) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // a tap; the click handler takes it
    e.preventDefault();
    moveDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };

  const blank = n * n - 1;
  const inPlace = tiles.filter((v, i) => v === i && v !== blank).length;

  return (
    <main className="sn">
      <div className="sn-head">
        <div>
          <div className="sn-eyebrow">Butts Studios · Games · 03</div>
          <h1>Sliding<br />Numbers<span className="accent">.</span></h1>
          <p className="sn-lede">Put them back in order. One new board every day.</p>
        </div>
        <div className="sn-tools">
          {premium ? <span className="tag">Full game</span> : <button className="tool gold" onClick={() => setModal('upgrade')}>Full game · $3</button>}
          <button className="tool" onClick={() => setModal('help')}>How to play</button>
        </div>
      </div>

      <div className="modes" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={mode === 'daily'} className={mode === 'daily' ? 'on' : ''} onClick={() => newGame(DAILY_SIZE, 'daily')}>
          Daily <small>{todayKey()}{streak > 0 ? ` · ${streak}-day streak` : ' · 4x4'}</small>
        </button>
        {[3, 4, 5].map((s) => (
          <button key={s} role="tab" aria-selected={mode === 'practice' && n === s} className={mode === 'practice' && n === s ? 'on' : ''} onClick={() => newGame(s, 'practice')}>
            {s}x{s} <small>{s === 3 ? 'warm-up' : s === 4 ? 'classic' : premium ? 'expert' : 'full game'}</small>
          </button>
        ))}
      </div>

      <div className="stats" aria-hidden="true">
        <div><span className="k">Moves</span><span className="v">{moves}</span></div>
        <div><span className="k">Time</span><span className="v">{fmt(elapsed)}</span></div>
        <div><span className="k">Par</span><span className="v">{parMoves ?? (n === 5 ? '-' : '…')}</span></div>
        <div><span className="k">In place</span><span className="v">{inPlace}/{blank}</span></div>
      </div>

      <div
        className={`board n${n}${won ? ' won' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="group"
        aria-label={`${n} by ${n} sliding puzzle`}
      >
        {tiles.map((v, i) => {
          if (v === blank) return null;
          const r = Math.floor(i / n), c = i % n;
          const home = v === i;
          return (
            <button
              key={v}
              className={`tile${home ? ' home' : ''}${hintCell === i ? ' hint' : ''}`}
              style={{ width: `${100 / n}%`, height: `${100 / n}%`, transform: `translate(${c * 100}%, ${r * 100}%)`, '--d': `${(r + c) * 45}ms` } as React.CSSProperties}
              onClick={() => clickCell(i)}
              aria-label={`Tile ${v + 1}, row ${r + 1}, column ${c + 1}${home ? ', in place' : ''}`}
            >
              <span>{v + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={undo} disabled={!history.length || won}>Undo</button>
        <button className="btn ghost" onClick={hint} disabled={won || thinking}>{thinking ? 'Thinking…' : 'Hint'}</button>
        <button className="btn ghost" onClick={restart} disabled={!started || won}>Restart</button>
        <button className="btn" onClick={() => newGame(mode === 'daily' ? 4 : n, 'practice')}>New board</button>
      </div>
      <p className="note">
        {mode === 'daily' ? 'Same board for everyone today. Replays keep your best.' : premium ? 'Unlimited play.' : `${tries} of 5 practice games left today. The daily puzzle is always open.`}
        {hints > 0 ? ` Hints used: ${hints}.` : ''}
        {best.moves ? ` Your best on ${n}x${n}: ${best.moves} moves, ${fmt(best.time || 0)}.` : ''}
      </p>

      <div className="sn-foot"><span>In the browser · tap, swipe or keys</span><span>Full game $3 one-time</span></div>

      <section className="htp" id="how-to-play" aria-labelledby="htp-title">
        <h2 id="htp-title">How to play</h2>
        <HowToPlay about />
      </section>

      <section className="lb">
        <h2>Leaderboard · {n}x{n}</h2>
        {leaderboard.length === 0 ? (
          <p className="muted">No times posted on this board yet.</p>
        ) : (
          <ol>
            {leaderboard.map((e) => (
              <li key={e.id}><span>{e.playerName}</span><span>{e.moves} moves · {fmt(e.time)}</span></li>
            ))}
          </ol>
        )}
        <p className="muted small">Fastest times, solved without hints.</p>
      </section>

      <div className="sr" aria-live="polite">{announce}</div>
      {toast && <div className="toast" role="status">{toast}</div>}

      {modal === 'win' && (
        <div className="overlay" onClick={() => setModal('none')}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Solved" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">{mode === 'daily' ? `Daily · ${todayKey()}` : `${n}x${n}`}</div>
            <h2>Solved</h2>
            <div className="result">
              <div><span className="k">Moves</span><span className="v">{moves}</span></div>
              <div><span className="k">Time</span><span className="v">{fmt(elapsed)}</span></div>
              <div><span className="k">Par</span><span className="v">{parMoves ?? '-'}</span></div>
            </div>
            {stars && <div className="stars" role="img" aria-label={`${stars} of 3`}>{[0, 1, 2].map((i) => <i key={i} className={i < stars ? 'on' : ''} />)}</div>}
            <p className="muted small">
              {parMoves ? (moves <= parMoves ? 'At or under par.' : `${moves - parMoves} over par.`) : ''}
              {n === 3 ? ' Par on 3x3 is the shortest possible solution.' : n === 4 ? ' Par is the shortest line our solver found.' : ''}
              {hints > 0 ? ` ${hints} hint${hints > 1 ? 's' : ''} used.` : ''}
            </p>
            {hints === 0 && !posted && (
              <form className="post" onSubmit={(e) => { e.preventDefault(); post(); }}>
                <input aria-label="Name for the leaderboard" placeholder="Name for the leaderboard" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
                <button className="btn ghost" type="submit" disabled={!name.trim()}>Post</button>
              </form>
            )}
            {posted && <p className="muted small">Posted.</p>}
            <div className="row">
              <button className="btn" onClick={share}>Share result</button>
              <button className="btn ghost" onClick={() => newGame(mode === 'daily' ? 4 : n, 'practice')}>Next board</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'paywall' && (
        <div className="overlay" onClick={() => setModal('none')}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Full game</h2>
            <p>{paywallMsg}</p>
            <div className="row">
              <button className="btn" onClick={() => setModal('upgrade')}>See the full game</button>
              <button className="btn ghost" onClick={() => newGame(DAILY_SIZE, 'daily')}>Play the daily</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'upgrade' && (
        <div className="overlay" onClick={() => setModal('none')}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>The full game</h2>
            <ul className="feat">
              <li>Unlimited practice games every day</li>
              <li>The 5x5 board</li>
              <li>One-time purchase, unlocked in this browser</li>
            </ul>
            <p className="price">$3</p>
            <button className="btn wide" onClick={() => window.open('__NEW_PAYMENT_LINK_PUZZLE_3__', '_blank')}>Unlock now</button>
          </div>
        </div>
      )}

      {modal === 'help' && (
        <div className="overlay" onClick={() => setModal('none')}>
          <div className="dialog help" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
            <h2>How to play</h2>
            <HowToPlay />
            <button className="btn wide" onClick={() => setModal('none')}>Play</button>
          </div>
        </div>
      )}
    </main>
  );
}
