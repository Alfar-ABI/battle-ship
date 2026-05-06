import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { BoardState, PlacedShip } from "@/lib/game/types";
import { cellKey, shipCells } from "@/lib/game/types";

interface BoardProps {
  board: BoardState;
  isEnemy: boolean;
  revealShips: boolean;
  onCellClick?: (x: number, y: number) => void;
  onCellRightClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number | null) => void;
  hoverCell?: { x: number; y: number } | null;
  hoverPreview?: { cells: { x: number; y: number }[]; valid: boolean } | null;
  boardSize?: number;
  playerColor?: string; // hex color for this player's ships/accents
}

const CELL = 1;

function gridPos(x: number, y: number, boardSize: number): [number, number, number] {
  const OFFSET = (boardSize * CELL) / 2 - CELL / 2;
  return [x - OFFSET, 0, y - OFFSET];
}

function ShipMesh({ ship, color, sunk, boardSize }: { ship: PlacedShip; color: string; sunk: boolean; boardSize: number }) {
  const cells = shipCells(ship);
  const start = cells[0];
  const end = cells[cells.length - 1];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const len = ship.size * CELL * 0.95;
  const wid = CELL * 0.5;
  const rotY = ship.orientation === "h" ? 0 : Math.PI / 2;

  const hullColor = sunk ? "#5a5858" : color;
  const deckColor = "#0b1220";
  const accentEmissive = sunk ? 0.22 : 0.75;
  const turretCount = Math.max(1, ship.size - 2);

  return (
    <group position={gridPos(cx, cy, boardSize)} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[len * 0.78, 0.18, wid]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} emissive={color} emissiveIntensity={accentEmissive * 0.55} toneMapped={false} />
      </mesh>
      <mesh position={[len * 0.39 + len * 0.06, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[wid / 2, len * 0.22, 4]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[-len * 0.39 - len * 0.03, 0.12, 0]}>
        <boxGeometry args={[len * 0.06, 0.18, wid * 0.85]} />
        <meshStandardMaterial color={hullColor} metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[len * 0.7, 0.02, wid * 0.85]} />
        <meshStandardMaterial color={deckColor} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[len * 0.05, 0.36, 0]}>
        <boxGeometry args={[len * 0.18, 0.22, wid * 0.55]} />
        <meshStandardMaterial color={deckColor} metalness={0.6} roughness={0.4} emissive={color} emissiveIntensity={accentEmissive} toneMapped={false} />
      </mesh>
      <mesh position={[len * 0.05, 0.5, 0]}>
        <boxGeometry args={[len * 0.08, 0.1, wid * 0.35]} />
        <meshStandardMaterial color={deckColor} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[len * 0.05, 0.72, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.32, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={accentEmissive * 1.5} toneMapped={false} />
      </mesh>
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
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len * 0.95, wid * 1.15]} />
        <meshBasicMaterial color={color} transparent opacity={sunk ? 0.12 : 0.18} />
      </mesh>
    </group>
  );
}

function HitMarker({ x, y, type, boardSize }: { x: number; y: number; type: "hit" | "miss"; boardSize: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current && type === "hit") {
      ref.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 3) * 0.08);
    }
  });
  if (type === "miss") {
    const [px, , pz] = gridPos(x, y, boardSize);
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
  const [px, , pz] = gridPos(x, y, boardSize);
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
  x, y, hovered, previewState, shot, marked, onClick, onRightClick, onEnter, onLeave, isEnemy, boardSize,
}: {
  x: number; y: number;
  hovered: boolean;
  previewState: "none" | "valid" | "invalid";
  shot: "miss" | "hit" | undefined;
  marked: boolean;
  onClick: () => void; onRightClick: () => void; onEnter: () => void; onLeave: () => void;
  isEnemy: boolean;
  boardSize: number;
}) {
  const baseColor = isEnemy ? "#150a10" : "#08111c";
  const hoverColor = isEnemy ? "#ff3b30" : "#3ad8ff";
  const previewColor = previewState === "valid" ? "#3ad8ff" : "#ff3b30";
  const showPreview = previewState !== "none";

  let color = baseColor;
  let opacity = 0.7;
  if (showPreview) { color = previewColor; opacity = 0.55; }
  else if (hovered && !shot) { color = hoverColor; opacity = 0.55; }
  else if (marked) { color = "#ffd84a"; opacity = 0.4; }

  const [px, , pz] = gridPos(x, y, boardSize);

  return (
    <group>
      <mesh
        position={[px, 0.015, pz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onContextMenu={(e) => { e.stopPropagation(); (e as any).nativeEvent?.preventDefault?.(); onRightClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); onEnter(); }}
        onPointerOut={() => onLeave()}
      >
        <planeGeometry args={[CELL * 0.94, CELL * 0.94]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {marked && !shot && (
        <group position={[px, 0.08, pz]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[0.22, 0.3, 4]} />
            <meshBasicMaterial color="#ffd84a" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial color="#ffd84a" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial color="#ffd84a" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function GridLines({ boardSize }: { boardSize: number }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const half = (boardSize * CELL) / 2;
    for (let i = 0; i <= boardSize; i++) {
      const p = -half + i * CELL;
      pts.push(-half, 0.01, p, half, 0.01, p);
      pts.push(p, 0.01, -half, p, 0.01, half);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [boardSize]);
  return (
    <lineSegments>
      <primitive object={lines} attach="geometry" />
      <lineBasicMaterial color="#3ad8ff" transparent opacity={0.35} />
    </lineSegments>
  );
}

function AxisLabels({ boardSize }: { boardSize: number }) {
  const half = (boardSize * CELL) / 2;
  const offset = half - CELL / 2;
  const edgeZ = half + 0.65;
  const edgeX = -(half + 0.65);
  return (
    <>
      {Array.from({ length: boardSize }, (_, i) => {
        const pos = i * CELL - offset;
        return (
          <group key={i}>
            <Text position={[pos, 0.05, edgeZ]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#3ad8ff" anchorX="center" anchorY="middle">
              {i.toString()}
            </Text>
            <Text position={[edgeX, 0.05, pos]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#3ad8ff" anchorX="center" anchorY="middle">
              {String.fromCharCode(65 + i)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

function Scene({ board, isEnemy, revealShips, onCellClick, onCellRightClick, onCellHover, hoverPreview, boardSize = 10, playerColor }: BoardProps) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const isLight = typeof document !== "undefined" && document.documentElement.classList.contains("light");
  const bgColor = isLight ? "#e8eef5" : "#05070d";
  const shipColor = playerColor ?? (isEnemy ? "#ff5b50" : "#3ad8ff");

  const previewSet = useMemo(() => {
    if (!hoverPreview) return null;
    return new Set(hoverPreview.cells.map((c) => cellKey(c.x, c.y)));
  }, [hoverPreview]);

  const sunkCells = useMemo(() => {
    const s = new Set<string>();
    for (const ship of board.ships) {
      if (ship.hits >= ship.size) {
        for (const c of shipCells(ship)) s.add(cellKey(c.x, c.y));
      }
    }
    return s;
  }, [board.ships]);

  // Camera distance scales with board size
  const camDist = boardSize * 0.9 + 6;
  const fogNear = boardSize * 1.2 + 4;
  const fogFar = boardSize * 2.8 + 10;

  const cells = [];
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const k = cellKey(x, y);
      const shot = board.shots[k];
      const isHover = hover?.x === x && hover?.y === y;
      const marked = !!board.marks?.[k];
      let preview: "none" | "valid" | "invalid" = "none";
      if (previewSet?.has(k)) preview = hoverPreview!.valid ? "valid" : "invalid";
      cells.push(
        <CellTile key={k} x={x} y={y}
          shot={shot}
          hovered={isHover}
          previewState={preview}
          marked={marked}
          isEnemy={isEnemy}
          boardSize={boardSize}
          onEnter={() => { setHover({ x, y }); onCellHover?.(x, y); }}
          onLeave={() => { setHover(null); onCellHover?.(x, null); }}
          onClick={() => onCellClick?.(x, y)}
          onRightClick={() => onCellRightClick?.(x, y)}
        />
      );
    }
  }

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, fogNear, fogFar]} />
      <ambientLight intensity={isLight ? 0.9 : 0.55} />
      <directionalLight position={[5, 10, 5]} intensity={isLight ? 1.3 : 1.1} />
      <pointLight position={[0, 4, 0]} intensity={1.2} color={isEnemy ? "#ff3b30" : "#3ad8ff"} />

      <group>
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <boxGeometry args={[boardSize + 0.4, 0.1, boardSize + 0.4]} />
          <meshStandardMaterial color={isLight ? "#cfd8e3" : "#070c14"} metalness={0.5} roughness={0.5} />
        </mesh>
        <GridLines boardSize={boardSize} />
        <AxisLabels boardSize={boardSize} />
        {cells}
        {board.ships.map((s) =>
          (revealShips || s.hits >= s.size) ? (
            <ShipMesh key={s.id} ship={s} color={shipColor} sunk={s.hits >= s.size} boardSize={boardSize} />
          ) : null
        )}
        {Object.entries(board.shots).map(([k, v]) => {
          if (v === "hit" && sunkCells.has(k)) return null;
          const [x, y] = k.split(",").map(Number);
          return <HitMarker key={k} x={x} y={y} type={v} boardSize={boardSize} />;
        })}
      </group>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minDistance={camDist * 0.7}
        maxDistance={camDist * 1.6}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
      />
    </>
  );
}

export function GameBoard3D(props: BoardProps) {
  const boardSize = props.boardSize ?? 10;
  const camDist = boardSize * 0.9 + 6;
  return (
    <div className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        camera={{ position: [0, camDist * 0.85, camDist * 0.85], fov: 45 }}
        dpr={[1.5, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene {...props} boardSize={boardSize} />
      </Canvas>
    </div>
  );
}
