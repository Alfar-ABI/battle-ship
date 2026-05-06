import { useMemo, useState } from "react";
import { GameBoard3D } from "./GameBoard3D";
import {
  BOARD_SIZE, SHIP_DEFS, DEFAULT_FLEET, expandFleet,
  type PlacedShip, type Orientation, type FleetConfig,
  autoPlace, isValidPlacement, shipCells, cellKey,
} from "@/lib/game/types";
import { sfx } from "@/lib/sound";

interface Props {
  onConfirm: (ships: PlacedShip[]) => void;
  fleet?: FleetConfig;
  boardSize?: number;
}

export function PlacementBoard({ onConfirm, fleet = DEFAULT_FLEET, boardSize = BOARD_SIZE }: Props) {
  const shipDefs = useMemo(() => expandFleet(fleet), [fleet]);

  const [ships, setShips] = useState<PlacedShip[]>([]);
  const [selectedId, setSelectedId] = useState<string>(shipDefs[0]?.id ?? "");
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const remaining = shipDefs.filter((d) => !ships.find((s) => s.id === d.id));
  const selectedDef = shipDefs.find((d) => d.id === selectedId) ?? remaining[0];

  const board = useMemo(() => ({ ships, shots: {} }), [ships]);

  const preview = useMemo(() => {
    if (!hover || !selectedDef) return null;
    const candidate: PlacedShip = { ...selectedDef, x: hover.x, y: hover.y, orientation, hits: 0 };
    const cells = shipCells(candidate);
    const valid = isValidPlacement(ships.filter((s) => s.id !== selectedDef.id), candidate, boardSize);
    return { cells, valid };
  }, [hover, selectedDef, orientation, ships, boardSize]);

  function placeAt(x: number, y: number) {
    if (!selectedDef) return;
    const candidate: PlacedShip = { ...selectedDef, x, y, orientation, hits: 0 };
    if (!isValidPlacement(ships.filter((s) => s.id !== selectedDef.id), candidate, boardSize)) return;
    sfx.place();
    const next = [...ships.filter((s) => s.id !== selectedDef.id), candidate];
    setShips(next);
    const nextDef = shipDefs.find((d) => !next.find((s) => s.id === d.id));
    if (nextDef) setSelectedId(nextDef.id);
  }

  function removeShip(id: string) {
    sfx.click();
    setShips(ships.filter((s) => s.id !== id));
    setSelectedId(id);
  }

  function doAutoPlace() {
    sfx.place();
    setShips(autoPlace(fleet, boardSize));
  }

  function reset() {
    sfx.click();
    setShips([]);
    setSelectedId(shipDefs[0]?.id ?? "");
  }

  const allPlaced = ships.length === shipDefs.length;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 h-full">
      <div className="glass relative overflow-hidden min-h-[420px]">
        <GameBoard3D
          board={board}
          isEnemy={false}
          revealShips
          boardSize={boardSize}
          onCellClick={(x, y) => placeAt(x, y)}
          onCellHover={(x, y) => setHover(y === null ? null : { x, y: y as number })}
          hoverPreview={preview}
        />
        <div className="absolute top-3 left-3 font-display text-xs uppercase tracking-widest neon-cyan">
          Deployment Grid · {boardSize}×{boardSize}
        </div>
      </div>

      <aside className="glass p-5 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h3 className="font-display uppercase tracking-widest text-sm neon-cyan">Fleet</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Select a ship, hover the grid, and click to deploy. Use Rotate to change orientation.
          </p>
        </div>

        <ul className="space-y-2">
          {shipDefs.map((d) => {
            const placed = ships.find((s) => s.id === d.id);
            const active = selectedId === d.id;
            return (
              <li key={d.id}>
                <button
                  onClick={() => { sfx.click(); setSelectedId(d.id); if (placed) removeShip(d.id); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-left transition ${
                    active ? "border-[var(--cyan)] bg-[var(--cyan)]/10" : "border-border hover:border-[var(--cyan)]/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex">
                      {Array.from({ length: d.size }).map((_, i) => (
                        <div key={i} className={`w-3 h-3 mr-0.5 rounded-sm ${placed ? "bg-[var(--cyan)]" : "bg-muted"}`} />
                      ))}
                    </div>
                    <span className="font-display text-xs uppercase tracking-wider">{d.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{placed ? "✓" : `${d.size}`}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <button className="btn-cyber flex-1" onClick={() => { sfx.click(); setOrientation((o) => o === "h" ? "v" : "h"); }}>
            Rotate · {orientation === "h" ? "↔" : "↕"}
          </button>
          <button className="btn-cyber flex-1" onClick={doAutoPlace}>Auto-Place</button>
        </div>

        <div className="flex gap-2 mt-auto">
          <button className="btn-danger flex-1" onClick={reset}>Reset</button>
          <button
            className="btn-cyber flex-1"
            disabled={!allPlaced}
            onClick={() => { sfx.place(); onConfirm(ships); }}
          >
            Engage
          </button>
        </div>
      </aside>
    </div>
  );
}
