import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { BoardState, PlacedShip } from "@/lib/game/types";
import { BOARD_SIZE, cellKey, shipCells } from "@/lib/game/types";

interface BoardProps {
  board: BoardState;
  isEnemy: boolean;
  revealShips: boolean;
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number | null) => void;
  hoverCell?: { x: number; y: number } | null;
  hoverPreview?: { cells: { x: number; y: number }[]; valid: boolean } | null;
}

const CELL = 1;
const OFFSET = (BOARD_SIZE * CELL) / 2 - CELL / 2;

function gridPos(x: number, y: number): [number, number, number] {
  return [x - OFFSET, 0, y - OFFSET];
}

/** Detailed low-poly ship: hull + pointed bow + stern + bridge tower + turrets/funnels */
function ShipMesh({ ship, color, sunk }: { ship: PlacedShip; color: string; sunk: boolean }) {
  const cells = shipCells(ship);
  const start = cells[0];
  const end = cells[cells.length - 1];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const len = ship.size * CELL * 0.95;
  const wid = CELL * 0.5;
  const rotY = ship.orientation === "h" ? 0 : Math.PI / 2;

  const hullColor = sunk ? "#3a3a3a" : color;
  const deckColor = "#0b1220";
  const accentEmissive = sunk ? 0.02 : 0.35;

  // Number of turrets/funnels scales with size
  const turretCount = Math.max(1, ship.size - 2);

  return (
    <group position={gridPos(cx, cy)} rotation={[0, rotY, 0]}>
      {/* Main hull (slightly tapered using box) */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[len * 0.78, 0.18, wid]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} emissive={color} emissiveIntensity={accentEmissive * 0.4} />
      </mesh>

      {/* Bow (pointed front) */}
      <mesh position={[len * 0.39 + len * 0.06, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[wid / 2, len * 0.22, 4]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Stern (squared back, smaller) */}
      <mesh position={[-len * 0.39 - len * 0.03, 0.12, 0]}>
        <boxGeometry args={[len * 0.06, 0.18, wid * 0.85]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Deck plate */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[len * 0.7, 0.02, wid * 0.85]} />
        <meshStandardMaterial color={deckColor} metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Bridge / command tower */}
      <mesh position={[len * 0.05, 0.36, 0]}>
        <boxGeometry args={[len * 0.18, 0.22, wid * 0.55]} />
        <meshStandardMaterial color={deckColor} metalness={0.6} roughness={0.4} emissive={color} emissiveIntensity={accentEmissive} />
      </mesh>
      <mesh position={[len * 0.05, 0.5, 0]}>
        <boxGeometry args={[len * 0.08, 0.1, wid * 0.35]} />
        <meshStandardMaterial color={deckColor} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Antenna / mast */}
      <mesh position={[len * 0.05, 0.72, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.32, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={accentEmissive * 1.5} />
      </mesh>

      {/* Turrets (front of bridge) */}
      {Array.from({ length: turretCount }).map((_, i) => {
        const t = (i + 0.5) / turretCount;
        const px = -len * 0.3 + t * (len * 0.25);
        return (
          <group key={`t${i}`} position={[px, 0.28, 0]}>
            <mesh>
              <cylinderGeometry args={[wid * 0.18, wid * 0.2, 0.1, 12]} />
              <meshStandardMaterial color={deckColor} metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[wid * 0.25, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, wid * 0.5, 6]} />
              <meshStandardMaterial color={hullColor} metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* Glow waterline */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len * 0.95, wid * 1.15]} />
        <meshBasicMaterial color={color} transparent opacity={sunk ? 0.05 : 0.18} />
      </mesh>
    </group>
  );
}

function HitMarker({ x, y, type }: { x: number; y: number; type: "hit" | "miss" }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current && type === "hit") {
      ref.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 3) * 0.08);
    }
  });
  if (type === "miss") {
    const [px, , pz] = gridPos(x, y);
    return (
      <group position={[px, 0.06, pz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.32, 32]} />
          <meshBasicMaterial color="#9fd8ee" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#1a3340" transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }
  const [px, , pz] = gridPos(x, y);
  return (
    <group position={[px, 0.45, pz]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <pointLight color="#ff3b30" intensity={1.2} distance={2} />
    </group>
  );
}

function CellTile({
  x, y, hovered, previewState, shot, onClick, onEnter, onLeave, isEnemy,
}: {
  x: number; y: number;
  hovered: boolean;
  previewState: "none" | "valid" | "invalid";
  shot: "miss" | "hit" | undefined;
  onClick: () => void; onEnter: () => void; onLeave: () => void;
  isEnemy: boolean;
}) {
  const baseColor = isEnemy ? "#150a10" : "#08111c";
  const hoverColor = isEnemy ? "#ff3b30" : "#3ad8ff";
  const previewColor = previewState === "valid" ? "#3ad8ff" : "#ff3b30";
  const showPreview = previewState !== "none";

  // When showing preview or hovering, use BasicMaterial (no lighting interference)
  // so the color reads as a clean flat neon instead of a muddy mix.
  let color = baseColor;
  let opacity = 0.7;
  if (showPreview) { color = previewColor; opacity = 0.55; }
  else if (hovered && !shot) { color = hoverColor; opacity = 0.55; }

  return (
    <mesh
      position={[gridPos(x, y)[0], 0.015, gridPos(x, y)[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onEnter(); }}
      onPointerOut={() => onLeave()}
    >
      <planeGeometry args={[CELL * 0.94, CELL * 0.94]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const half = (BOARD_SIZE * CELL) / 2;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      const p = -half + i * CELL;
      pts.push(-half, 0.01, p, half, 0.01, p);
      pts.push(p, 0.01, -half, p, 0.01, half);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);
  return (
    <lineSegments>
      <primitive object={lines} attach="geometry" />
      <lineBasicMaterial color="#3ad8ff" transparent opacity={0.35} />
    </lineSegments>
  );
}

function Scene({ board, isEnemy, revealShips, onCellClick, onCellHover, hoverPreview }: BoardProps) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const previewSet = useMemo(() => {
    if (!hoverPreview) return null;
    return new Set(hoverPreview.cells.map((c) => cellKey(c.x, c.y)));
  }, [hoverPreview]);

  const cells = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const k = cellKey(x, y);
      const shot = board.shots[k];
      const isHover = hover?.x === x && hover?.y === y;
      let preview: "none" | "valid" | "invalid" = "none";
      if (previewSet?.has(k)) preview = hoverPreview!.valid ? "valid" : "invalid";
      cells.push(
        <CellTile key={k} x={x} y={y}
          shot={shot}
          hovered={isHover}
          previewState={preview}
          isEnemy={isEnemy}
          onEnter={() => { setHover({ x, y }); onCellHover?.(x, y); }}
          onLeave={() => { setHover(null); onCellHover?.(x, null); }}
          onClick={() => onCellClick?.(x, y)}
        />
      );
    }
  }

  return (
    <>
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 16, 34]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 4, 0]} intensity={0.6} color={isEnemy ? "#ff3b30" : "#3ad8ff"} />

      <Float speed={0.6} rotationIntensity={0.05} floatIntensity={0.1}>
        <group>
          <mesh position={[0, -0.05, 0]} receiveShadow>
            <boxGeometry args={[BOARD_SIZE + 0.4, 0.1, BOARD_SIZE + 0.4]} />
            <meshStandardMaterial color="#070c14" metalness={0.8} roughness={0.4} />
          </mesh>
          <GridLines />
          {cells}
          {board.ships.map((s) =>
            (revealShips || s.hits >= s.size) ? (
              <ShipMesh key={s.id} ship={s} color={isEnemy ? "#ff5b50" : "#3ad8ff"} sunk={s.hits >= s.size} />
            ) : null
          )}
          {Object.entries(board.shots).map(([k, v]) => {
            const [x, y] = k.split(",").map(Number);
            return <HitMarker key={k} x={x} y={y} type={v} />;
          })}
        </group>
      </Float>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minDistance={10}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
      />
    </>
  );
}

export function GameBoard3D(props: BoardProps) {
  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [0, 12, 12], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        flat
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
