export const BOARD_SIZE = 10; // default

export type ShipId = "carrier" | "battleship" | "destroyer" | "submarine" | "patrol";
export type Orientation = "h" | "v";

export type FleetConfig = Partial<Record<ShipId, number>>;

export const DEFAULT_FLEET: FleetConfig = {
  carrier: 1, battleship: 1, destroyer: 1, submarine: 1, patrol: 1,
};

export const SHIP_DEFS: { id: ShipId; name: string; size: number }[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "destroyer", name: "Destroyer", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "patrol", name: "Patrol Boat", size: 2 },
];

/** Expand fleet config into ordered list of ship defs with unique string IDs */
export function expandFleet(fleet: FleetConfig): { id: string; name: string; size: number }[] {
  const result: { id: string; name: string; size: number }[] = [];
  for (const def of SHIP_DEFS) {
    const count = fleet[def.id] ?? 0;
    for (let i = 0; i < count; i++) {
      result.push({
        id: count === 1 ? def.id : `${def.id}_${i}`,
        name: count === 1 ? def.name : `${def.name} ${i + 1}`,
        size: def.size,
      });
    }
  }
  return result;
}

export interface PlacedShip {
  id: string; // ShipId or "carrier_0", "carrier_1", etc.
  name: string;
  size: number;
  x: number;
  y: number;
  orientation: Orientation;
  hits: number;
}

export type CellState = "empty" | "miss" | "hit" | "sunk";

export interface BoardState {
  ships: PlacedShip[];
  shots: Record<string, "miss" | "hit">;
  marks?: Record<string, boolean>;
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
  candidate: PlacedShip,
  boardSize = BOARD_SIZE,
): boolean {
  const cells = shipCells(candidate);
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= boardSize || c.y >= boardSize) return false;
  }
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

export function autoPlace(
  fleet: FleetConfig = DEFAULT_FLEET,
  boardSize = BOARD_SIZE,
): PlacedShip[] {
  const defs = expandFleet(fleet);
  const ships: PlacedShip[] = [];
  for (const def of defs) {
    let tries = 0;
    while (tries++ < 500) {
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const x = Math.floor(Math.random() * boardSize);
      const y = Math.floor(Math.random() * boardSize);
      const s: PlacedShip = { ...def, x, y, orientation, hits: 0 };
      if (isValidPlacement(ships, s, boardSize)) {
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

export function fireAt(
  board: BoardState,
  x: number,
  y: number,
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
