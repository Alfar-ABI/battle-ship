import { BOARD_SIZE, BoardState, SHIP_DEFS, cellKey, isSunk, shipCells, shipAt } from "./types";

export type Difficulty = "easy" | "medium" | "hard";

interface AIMemory {
  // squares queued for medium AI (around hits)
  queue: Array<{ x: number; y: number }>;
  hits: Array<{ x: number; y: number }>; // unsunk hits
}

export function createAI(): AIMemory {
  return { queue: [], hits: [] };
}

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function untried(shots: Record<string, unknown>, x: number, y: number) {
  return inBounds(x, y) && !shots[cellKey(x, y)];
}

function randomMove(shots: Record<string, unknown>) {
  const choices: { x: number; y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y++)
    for (let x = 0; x < BOARD_SIZE; x++)
      if (!shots[cellKey(x, y)]) choices.push({ x, y });
  return choices[Math.floor(Math.random() * choices.length)];
}

/** Probability density: count placements of remaining ships through each cell. */
function probabilityMove(playerBoard: BoardState) {
  const shots = playerBoard.shots;
  const remaining = SHIP_DEFS.filter((def) => {
    const ship = playerBoard.ships.find((s) => s.id === def.id);
    return !ship || !isSunk(ship);
  });
  const grid = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
  // hits known but not part of sunk ships
  const knownHits: { x: number; y: number }[] = [];
  for (const [k, v] of Object.entries(shots)) {
    if (v !== "hit") continue;
    const [x, y] = k.split(",").map(Number);
    const ship = shipAt(playerBoard, x, y);
    if (ship && isSunk(ship)) continue;
    knownHits.push({ x, y });
  }

  for (const def of remaining) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        for (const orientation of ["h", "v"] as const) {
          const cells: { x: number; y: number }[] = [];
          let ok = true;
          for (let i = 0; i < def.size; i++) {
            const cx = orientation === "h" ? x + i : x;
            const cy = orientation === "v" ? y + i : y;
            if (!inBounds(cx, cy)) { ok = false; break; }
            const k = cellKey(cx, cy);
            if (shots[k] === "miss") { ok = false; break; }
            // can overlap a known hit (we don't know ship locations)
            cells.push({ x: cx, y: cy });
          }
          if (!ok) continue;
          // weight: cells covering a known unsunk hit get a big boost
          const overlap = cells.filter((c) => shots[cellKey(c.x, c.y)] === "hit").length;
          const weight = 1 + overlap * 8;
          for (const c of cells) {
            if (!shots[cellKey(c.x, c.y)]) grid[c.y][c.x] += weight;
          }
        }
      }
    }
  }

  // Pick max
  let best = -1;
  let pick = { x: 0, y: 0 };
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (shots[cellKey(x, y)]) continue;
      // checkerboard preference when no hits to chase
      const parityBonus = knownHits.length === 0 && (x + y) % 2 === 0 ? 0.5 : 0;
      const v = grid[y][x] + parityBonus;
      if (v > best) { best = v; pick = { x, y }; }
    }
  }
  return pick;
}

/** Compute next move for the AI vs the player's board. Returns coords. */
export function aiMove(
  difficulty: Difficulty,
  playerBoard: BoardState,
  mem: AIMemory
): { x: number; y: number } {
  const shots = playerBoard.shots;

  if (difficulty === "easy") return randomMove(shots);

  if (difficulty === "medium") {
    // dequeue valid targets first
    while (mem.queue.length) {
      const c = mem.queue.shift()!;
      if (untried(shots, c.x, c.y)) return c;
    }
    return randomMove(shots);
  }

  // hard
  return probabilityMove(playerBoard);
}

/** Update AI memory after a shot's outcome. */
export function aiPostShot(
  mem: AIMemory,
  x: number,
  y: number,
  outcome: "miss" | "hit" | "sunk",
  playerBoard: BoardState
) {
  if (outcome === "hit") {
    mem.hits.push({ x, y });
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      mem.queue.push({ x: x + dx, y: y + dy });
    }
  } else if (outcome === "sunk") {
    // clear queue & hits for that ship
    const ship = shipAt(playerBoard, x, y);
    if (ship) {
      const cells = new Set(shipCells(ship).map((c) => cellKey(c.x, c.y)));
      mem.hits = mem.hits.filter((h) => !cells.has(cellKey(h.x, h.y)));
      mem.queue = [];
    }
  }
}
