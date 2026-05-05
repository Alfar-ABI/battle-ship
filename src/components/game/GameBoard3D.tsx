import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { BoardState, PlacedShip } from "@/lib/game/types";
import { BOARD_SIZE, cellKey, shipCells } from "@/lib/game/types";

interface BoardProps {
  board: BoardState;
  isEnemy: boolean;
  /** Show ships? Hide for enemy until sunk/game over */
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

function ShipMesh({ ship, color, sunk }: { ship: PlacedShip; color: string; sunk: boolean }) {
  const cells = shipCells(ship);
  const start = cells[0];
  const end = cells[cells.length - 1];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const len = ship.size * CELL * 0.92;
  const wid = CELL * 0.55;
  const rotY = ship.orientation === "h" ? 0 : Math.PI / 2;
  return (
    <group position={gridPos(cx, cy)} rotation={[0, rotY, 0]}>
      {/* hull */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[len, 0.25, wid]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={sunk ? 0.05 : 0.25} />
      </mesh>
      {/* deck tower */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[len * 0.25, 0.18, wid * 0.55]} />
        <meshStandardMaterial color="#0e1726" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* bow taper */}
      <mesh position={[len / 2, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[wid / 2, 0.4, 4]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={sunk ? 0.05 : 0.2} />
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
    return (
      <mesh position={gridPos(x, y)} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.28, 24]} />
        <meshBasicMaterial color="#7faec8" transparent opacity={0.7} />
      </mesh>
    );
  }
  return (
    <group position={[...gridPos(x, y).slice(0, 1), 0.45, gridPos(x, y)[2]] as [number, number, number]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1.2} />
      </mesh>
      <pointLight color="#ff3b30" intensity={1.2} distance={2} />
    </group>
  );
}

function CellTile({
  x, y, state, hovered, previewState, onClick, onEnter, onLeave, isEnemy,
}: {
  x: number; y: number; state: "empty" | "miss" | "hit";
  hovered: boolean;
  previewState: "none" | "valid" | "invalid";
  onClick: () => void; onEnter: () => void; onLeave: () => void;
  isEnemy: boolean;
}) {
  const baseColor = isEnemy ? "#1a0e15" : "#0e1726";
  const hoverColor = isEnemy ? "#ff3b30" : "#3ad8ff";
  const previewColor = previewState === "valid" ? "#3ad8ff" : "#ff3b30";
  const showPreview = previewState !== "none";
  return (
    <mesh
      position={gridPos(x, y)}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onEnter(); }}
      onPointerOut={() => onLeave()}
    >
      <planeGeometry args={[CELL * 0.94, CELL * 0.94]} />
      <meshStandardMaterial
        color={showPreview ? previewColor : baseColor}
        emissive={showPreview ? previewColor : (hovered ? hoverColor : "#000000")}
        emissiveIntensity={showPreview ? 0.5 : (hovered ? 0.6 : 0)}
        transparent opacity={showPreview ? 0.45 : 0.85}
        metalness={0.3} roughness={0.6}
      />
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
          state={shot ?? "empty"}
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
      <fog attach="fog" args={["#05070d", 12, 28]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 4, 0]} intensity={0.6} color={isEnemy ? "#ff3b30" : "#3ad8ff"} />

      <Float speed={0.6} rotationIntensity={0.08} floatIntensity={0.15}>
        <group>
          {/* base plate */}
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
      <Canvas camera={{ position: [0, 12, 12], fov: 45 }} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
