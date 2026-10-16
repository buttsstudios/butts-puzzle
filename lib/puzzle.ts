// Sliding Numbers: board model, generator, solver and hints.
// A board is an array of length n*n; tiles[i] is the tile sitting at cell i. Tile value n*n-1 is the blank.
// Solved when tiles[i] === i for every i.

export type Board = number[];

// ---------- seeded RNG (mulberry32) ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function solvedBoard(n: number): Board {
  return Array.from({ length: n * n }, (_, i) => i);
}

export function isSolved(b: Board) {
  for (let i = 0; i < b.length; i++) if (b[i] !== i) return false;
  return true;
}

export function neighbors(i: number, n: number) {
  const r = Math.floor(i / n), c = i % n, out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

export function isSolvable(b: Board, n: number) {
  const blank = n * n - 1;
  let inv = 0;
  const t = b.filter((v) => v !== blank);
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = n - Math.floor(b.indexOf(blank) / n); // 1-based
  return (inv % 2 === 0) === (rowFromBottom % 2 === 1);
}

// ---------- heuristic: Manhattan distance + linear conflicts (admissible) ----------
export function heuristic(b: Board, n: number) {
  const blank = n * n - 1;
  let h = 0;
  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    if (v === blank) continue;
    h += Math.abs(Math.floor(i / n) - Math.floor(v / n)) + Math.abs((i % n) - (v % n));
  }
  // linear conflicts in rows
  for (let r = 0; r < n; r++) {
    for (let a = 0; a < n; a++) {
      const va = b[r * n + a];
      if (va === blank || Math.floor(va / n) !== r) continue;
      for (let c = a + 1; c < n; c++) {
        const vc = b[r * n + c];
        if (vc !== blank && Math.floor(vc / n) === r && vc < va) h += 2;
      }
    }
  }
  // linear conflicts in columns
  for (let col = 0; col < n; col++) {
    for (let a = 0; a < n; a++) {
      const va = b[a * n + col];
      if (va === blank || va % n !== col) continue;
      for (let c = a + 1; c < n; c++) {
        const vc = b[c * n + col];
        if (vc !== blank && vc % n === col && vc < va) h += 2;
      }
    }
  }
  return h;
}

// ---------- 3x3: exact distances for every state (BFS from the goal, built once) ----------
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];
function rank9(b: Board) {
  let r = 0;
  for (let i = 0; i < 9; i++) {
    let less = 0;
    for (let j = i + 1; j < 9; j++) if (b[j] < b[i]) less++;
    r += less * FACT[8 - i];
  }
  return r;
}
let table3: Uint8Array | null = null;
function buildTable3() {
  if (table3) return table3;
  const t = new Uint8Array(362880).fill(255);
  const start = solvedBoard(3);
  t[rank9(start)] = 0;
  let frontier: Board[] = [start];
  let d = 0;
  while (frontier.length) {
    const next: Board[] = [];
    for (const b of frontier) {
      const e = b.indexOf(8);
      for (const k of neighbors(e, 3)) {
        const c = b.slice();
        c[e] = c[k]; c[k] = 8;
        const r = rank9(c);
        if (t[r] === 255) { t[r] = d + 1; next.push(c); }
      }
    }
    frontier = next; d++;
  }
  table3 = t;
  return t;
}
export function exactDistance3(b: Board) {
  return buildTable3()[rank9(b)];
}

// ---------- weighted A* for 4x4 / 5x5 (fast, near-optimal lines) ----------
class Heap<T> {
  a: { k: number; v: T }[] = [];
  push(k: number, v: T) {
    const a = this.a; a.push({ k, v });
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].k <= a[i].k) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].k < a[m].k) m = l;
        if (r < a.length && a[r].k < a[m].k) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

/** Returns the list of cells to move (each is the index of the tile that slides into the blank). */
export function solve(b: Board, n: number, budget = 120000): number[] | null {
  if (isSolved(b)) return [];
  if (n === 3) return solve3(b);
  for (const w of n === 4 ? [1.4, 2, 3.5] : [4, 7, 12]) {
    const r = weightedAStar(b, n, w, budget);
    if (r) return r;
  }
  return null;
}

function solve3(b: Board): number[] {
  const t = buildTable3();
  const path: number[] = [];
  let cur = b.slice();
  while (!isSolved(cur)) {
    const e = cur.indexOf(8);
    const d = t[rank9(cur)];
    for (const k of neighbors(e, 3)) {
      const c = cur.slice(); c[e] = c[k]; c[k] = 8;
      if (t[rank9(c)] === d - 1) { path.push(k); cur = c; break; }
    }
  }
  return path;
}

function weightedAStar(start: Board, n: number, w: number, budget: number): number[] | null {
  const blank = n * n - 1;
  type Node = { b: Board; g: number; e: number; parent: Node | null; move: number };
  const seen = new Map<string, number>();
  const open = new Heap<Node>();
  const s: Node = { b: start, g: 0, e: start.indexOf(blank), parent: null, move: -1 };
  open.push(w * heuristic(start, n), s);
  seen.set(start.join(','), 0);
  let expanded = 0;
  while (open.size) {
    const { v: cur } = open.pop();
    if (isSolved(cur.b)) {
      const moves: number[] = [];
      for (let x: Node | null = cur; x && x.parent; x = x.parent) moves.push(x.move);
      return moves.reverse();
    }
    if (++expanded > budget) return null;
    for (const k of neighbors(cur.e, n)) {
      if (cur.parent && k === cur.parent.e) continue;
      const c = cur.b.slice(); c[cur.e] = c[k]; c[k] = blank;
      const key = c.join(','), g = cur.g + 1;
      const prev = seen.get(key);
      if (prev !== undefined && prev <= g) continue;
      seen.set(key, g);
      open.push(g + w * heuristic(c, n), { b: c, g, e: k, parent: cur, move: k });
    }
  }
  return null;
}

// ---------- generator ----------
// Uniformly random solvable boards (not random walks, which leave easy, lumpy boards),
// filtered to a target difficulty band so every board is a real puzzle.
const MIN_DIFFICULTY: Record<number, number> = { 3: 18, 4: 34, 5: 70 };
export function generate(n: number, rand: () => number = Math.random): Board {
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = solvedBoard(n);
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    if (!isSolvable(b, n)) {
      // swap two non-blank tiles to flip parity
      const blank = n * n - 1;
      const idx = b.map((v, i) => (v === blank ? -1 : i)).filter((i) => i >= 0);
      [b[idx[0]], b[idx[1]]] = [b[idx[1]], b[idx[0]]];
    }
    const diff = n === 3 ? exactDistance3(b) : heuristic(b, n);
    if (!isSolved(b) && diff >= MIN_DIFFICULTY[n]) return b;
  }
  const b = solvedBoard(n);
  return b;
}

/** Par = the shortest line the solver finds (exact on 3x3). */
export function par(b: Board, n: number): number | null {
  if (n === 3) return exactDistance3(b);
  const s = solve(b, n, 200000);
  return s ? s.length : null;
}

export function dailySeed(key = todayKey()) {
  return parseInt(key.replace(/-/g, ''), 10) * 7 + 4;
}
