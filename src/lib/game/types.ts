export const BOARD_SIZE = 10;

export type ShipKind = "carrier" | "battleship" | "destroyer" | "submarine" | "patrol";
export type ShipId = string;
export type Orientation = "h" | "v";

export interface ShipDef { id: ShipId; name: string; size: number }
export interface ShipType { id: ShipKind; name: string; size: number }

export const SHIP_TYPES: ShipType[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "destroyer", name: "Destroyer", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "patrol", name: "Patrol Boat", size: 2 },
];

export type FleetConfig = Partial<Record<ShipKind, number>>;

export const DEFAULT_FLEET: FleetConfig = {
  carrier: 1, battleship: 1, destroyer: 1, submarine: 1, patrol: 1,
};

/** Expand a fleet config into one ShipDef per ship instance, with unique ids. */
export function expandFleet(config: FleetConfig = DEFAULT_FLEET): ShipDef[] {
  const out: ShipDef[] = [];
  for (const t of SHIP_TYPES) {
    const n = config[t.id] ?? 0;
    for (let i = 0; i < n; i++) {
      out.push({ id: n > 1 ? `${t.id}_${i}` : t.id, name: n > 1 ? `${t.name} ${i + 1}` : t.name, size: t.size });
    }
  }
  return out;
}

export function fleetTotal(config: FleetConfig): number {
  return SHIP_TYPES.reduce((s, t) => s + (config[t.id] ?? 0), 0);
}

/** Back-compat default fleet (one of each). */
export const SHIP_DEFS: ShipDef[] = expandFleet(DEFAULT_FLEET);

export interface PlacedShip {
  id: ShipId;
  name: string;
  size: number;
  x: number; // top-left col
  y: number; // top-left row
  orientation: Orientation;
  hits: number;
}

export type CellState = "empty" | "miss" | "hit" | "sunk";

export interface BoardState {
  ships: PlacedShip[];
  shots: Record<string, "miss" | "hit">; // key "x,y"
  marks?: Record<string, boolean>; // user "no-ship" guess marks
}

export const cellKey = (x: number, y: number) => `${x},${y}`;

export function shipCells(s: PlacedShip): { x: number; y: number }[] {
  const out = [];
  for (let i = 0; i < s.size; i++) {
    out.push({
      x: s.orientation === "h" ? s.x + i : s.x,
      y: s.orientation === "v" ? s.y + i : s.y,
    });
  }
  return out;
}

export function isValidPlacement(
  ships: PlacedShip[],
  candidate: PlacedShip
): boolean {
  const cells = shipCells(candidate);
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= BOARD_SIZE || c.y >= BOARD_SIZE) return false;
  }
  // Build occupied + buffer (1-cell halo) of all OTHER ships
  const blocked = new Set<string>();
  for (const s of ships) {
    if (s.id === candidate.id) continue;
    for (const c of shipCells(s)) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          blocked.add(cellKey(c.x + dx, c.y + dy));
        }
      }
    }
  }
  for (const c of cells) if (blocked.has(cellKey(c.x, c.y))) return false;
  return true;
}

export function autoPlace(): PlacedShip[] {
  const ships: PlacedShip[] = [];
  for (const def of SHIP_DEFS) {
    let tries = 0;
    while (tries++ < 500) {
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const x = Math.floor(Math.random() * BOARD_SIZE);
      const y = Math.floor(Math.random() * BOARD_SIZE);
      const s: PlacedShip = { ...def, x, y, orientation, hits: 0 };
      if (isValidPlacement(ships, s)) {
        ships.push(s);
        break;
      }
    }
  }
  return ships;
}

export function shipAt(board: BoardState, x: number, y: number): PlacedShip | null {
  for (const s of board.ships) {
    for (const c of shipCells(s)) if (c.x === x && c.y === y) return s;
  }
  return null;
}

export function isSunk(s: PlacedShip): boolean {
  return s.hits >= s.size;
}

export function allSunk(board: BoardState): boolean {
  return board.ships.every(isSunk);
}

/** returns updated board + outcome. Mutates a copy. */
export function fireAt(
  board: BoardState,
  x: number,
  y: number
): { board: BoardState; outcome: "miss" | "hit" | "sunk"; ship?: PlacedShip } {
  const k = cellKey(x, y);
  if (board.shots[k]) return { board, outcome: board.shots[k] === "hit" ? "hit" : "miss" };
  const ship = shipAt(board, x, y);
  const newShots = { ...board.shots, [k]: ship ? ("hit" as const) : ("miss" as const) };
  let newShips = board.ships;
  let outcome: "miss" | "hit" | "sunk" = ship ? "hit" : "miss";
  let hitShip: PlacedShip | undefined;
  if (ship) {
    newShips = board.ships.map((s) =>
      s.id === ship.id ? { ...s, hits: s.hits + 1 } : s
    );
    hitShip = newShips.find((s) => s.id === ship.id);
    if (hitShip && isSunk(hitShip)) outcome = "sunk";
  }
  return { board: { ships: newShips, shots: newShots }, outcome, ship: hitShip };
}
