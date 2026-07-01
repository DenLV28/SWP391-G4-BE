// 3D isometric parking lot map — renders a top-down SVG with CSS perspective transform

interface Props {
  level?: 'G' | '1-2';
}

const ASPHALT = '#1c1c1e';
const ASPHALT_LANE = '#252528';
const WHITE = '#ffffff';
const YELLOW = '#f5a623';
const YELLOW_DARK = '#c8841a';
const STRIPE = '#555558';
const GREEN = '#22c55e';
const RED = '#ef4444';

// Number of spaces per row
const N = 13;
const SPACE_W = 42;
const SPACE_H = 72;
const LANE_H = 40;
const ENTRY_W = 56;
const SVG_W = ENTRY_W + N * SPACE_W + 4;   // ≈ 750
const SVG_H = SPACE_H * 2 + LANE_H;        // ≈ 184

// Helpers
function ParkingSpace({ x, y, w, h, flip = false, selected = false }: {
  x: number; y: number; w: number; h: number; flip?: boolean; selected?: boolean;
}) {
  return (
    <g>
      {/* Space fill */}
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={selected ? '#1d4ed8' : '#28282c'} />
      {/* Left divider */}
      <line x1={x} y1={y} x2={x} y2={y + h} stroke={WHITE} strokeWidth="1.5" opacity="0.7" />
      {/* Top/bottom line */}
      {flip
        ? <line x1={x} y1={y} x2={x + w} y2={y} stroke={WHITE} strokeWidth="2" opacity="0.9" />
        : <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={WHITE} strokeWidth="2" opacity="0.9" />
      }
      {/* Stop line bump */}
      {!flip && <rect x={x + 4} y={y + h - 3} width={w - 8} height={3} fill={YELLOW} opacity="0.8" rx="1" />}
      {flip && <rect x={x + 4} y={y} width={w - 8} height={3} fill={YELLOW} opacity="0.8" rx="1" />}
    </g>
  );
}

function Arrow({ x, y, dir = 'right', color = WHITE }: {
  x: number; y: number; dir?: 'right' | 'left'; color?: string;
}) {
  const len = 30;
  const head = 8;
  if (dir === 'right') {
    return (
      <g fill={color} opacity="0.85">
        <line x1={x} y1={y} x2={x + len} y2={y} stroke={color} strokeWidth="2.5" />
        <polygon points={`${x + len},${y} ${x + len - head},${y - head / 2} ${x + len - head},${y + head / 2}`} />
      </g>
    );
  }
  return (
    <g fill={color} opacity="0.85">
      <line x1={x} y1={y} x2={x - len} y2={y} stroke={color} strokeWidth="2.5" />
      <polygon points={`${x - len},${y} ${x - len + head},${y - head / 2} ${x - len + head},${y + head / 2}`} />
    </g>
  );
}

function HatchZone({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const lines = [];
  const step = 8;
  for (let i = -h; i < w + h; i += step) {
    lines.push(
      <line key={i}
        x1={x + i} y1={y}
        x2={x + i + h} y2={y + h}
        stroke={YELLOW_DARK} strokeWidth="3"
      />
    );
  }
  return (
    <g clipPath={`url(#hatch-clip-${x})`}>
      <defs>
        <clipPath id={`hatch-clip-${x}`}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={YELLOW} opacity="0.25" />
      {lines}
    </g>
  );
}

export default function Parking3DMap({ level = 'G' }: Props) {
  const isGround = level === 'G';

  return (
    <div
      className="w-full flex items-center justify-center overflow-hidden rounded-xl bg-neutral-900"
      style={{ height: 220, perspective: '700px', perspectiveOrigin: '50% -20%' }}
    >
      <div
        style={{
          transform: 'rotateX(42deg) rotateZ(-3deg) scale(1.18)',
          transformOrigin: 'center 65%',
          width: '92%',
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', width: '100%' }}
        >
          {/* ── Background asphalt ── */}
          <rect width={SVG_W} height={SVG_H} fill={ASPHALT} />

          {/* ── Entry/Exit lane on the left ── */}
          <HatchZone x={0} y={0} w={ENTRY_W} h={SPACE_H} />
          <HatchZone x={0} y={SPACE_H + LANE_H} w={ENTRY_W} h={SPACE_H} />

          {/* Entry label */}
          <rect x={2} y={SPACE_H - 14} width={ENTRY_W - 4} height={14} fill={GREEN} rx="3" opacity="0.9" />
          <text x={ENTRY_W / 2} y={SPACE_H - 3} textAnchor="middle" fill={WHITE} fontSize="8" fontWeight="bold">VÀO</text>

          {/* Exit label */}
          <rect x={2} y={SPACE_H + LANE_H} width={ENTRY_W - 4} height={14} fill={RED} rx="3" opacity="0.9" />
          <text x={ENTRY_W / 2} y={SPACE_H + LANE_H + 11} textAnchor="middle" fill={WHITE} fontSize="8" fontWeight="bold">RA</text>

          {/* ── Top parking row ── */}
          {Array.from({ length: N }, (_, i) => (
            <ParkingSpace
              key={`top-${i}`}
              x={ENTRY_W + i * SPACE_W}
              y={0}
              w={SPACE_W}
              h={SPACE_H}
              flip={false}
            />
          ))}
          {/* Last vertical line of top row */}
          <line x1={ENTRY_W + N * SPACE_W} y1={0} x2={ENTRY_W + N * SPACE_W} y2={SPACE_H} stroke={WHITE} strokeWidth="1.5" opacity="0.7" />

          {/* ── Center driving lane ── */}
          <rect x={ENTRY_W} y={SPACE_H} width={N * SPACE_W} height={LANE_H} fill={ASPHALT_LANE} />

          {/* Yellow dashed centerline */}
          {Array.from({ length: 18 }, (_, i) => (
            <rect
              key={`dash-${i}`}
              x={ENTRY_W + 20 + i * 34}
              y={SPACE_H + LANE_H / 2 - 1}
              width={18}
              height={2}
              fill={YELLOW}
              opacity="0.7"
            />
          ))}

          {/* Traffic arrows - upper lane (going RIGHT: entry side) */}
          <Arrow x={ENTRY_W + 60}  y={SPACE_H + LANE_H / 4}      dir="right" color={WHITE} />
          <Arrow x={ENTRY_W + 160} y={SPACE_H + LANE_H / 4}      dir="right" color={WHITE} />
          <Arrow x={ENTRY_W + 260} y={SPACE_H + LANE_H / 4}      dir="right" color={WHITE} />
          <Arrow x={ENTRY_W + 380} y={SPACE_H + LANE_H / 4}      dir="right" color={WHITE} />

          {/* Traffic arrows - lower lane (going LEFT: exit side) */}
          <Arrow x={ENTRY_W + N * SPACE_W - 60}  y={SPACE_H + LANE_H * 3 / 4} dir="left" color={WHITE} />
          <Arrow x={ENTRY_W + N * SPACE_W - 160} y={SPACE_H + LANE_H * 3 / 4} dir="left" color={WHITE} />
          <Arrow x={ENTRY_W + N * SPACE_W - 280} y={SPACE_H + LANE_H * 3 / 4} dir="left" color={WHITE} />
          <Arrow x={ENTRY_W + N * SPACE_W - 400} y={SPACE_H + LANE_H * 3 / 4} dir="left" color={WHITE} />

          {/* Turnaround curve on the right */}
          <path
            d={`M ${ENTRY_W + N * SPACE_W - 2} ${SPACE_H + 4} Q ${ENTRY_W + N * SPACE_W + 22} ${SPACE_H + LANE_H / 2} ${ENTRY_W + N * SPACE_W - 2} ${SPACE_H + LANE_H - 4}`}
            fill="none" stroke={YELLOW} strokeWidth="2.5" strokeDasharray="5,3"
          />
          {/* Arrowhead on right curve */}
          <polygon
            points={`${ENTRY_W + N * SPACE_W - 2},${SPACE_H + LANE_H - 4} ${ENTRY_W + N * SPACE_W + 7},${SPACE_H + LANE_H - 12} ${ENTRY_W + N * SPACE_W - 10},${SPACE_H + LANE_H - 6}`}
            fill={YELLOW}
          />

          {/* ── Bottom parking row ── */}
          {Array.from({ length: N }, (_, i) => (
            <ParkingSpace
              key={`bot-${i}`}
              x={ENTRY_W + i * SPACE_W}
              y={SPACE_H + LANE_H}
              w={SPACE_W}
              h={SPACE_H}
              flip={true}
            />
          ))}
          <line x1={ENTRY_W + N * SPACE_W} y1={SPACE_H + LANE_H} x2={ENTRY_W + N * SPACE_W} y2={SPACE_H * 2 + LANE_H} stroke={WHITE} strokeWidth="1.5" opacity="0.7" />

          {/* ── Right-end hatch zone ── */}
          <HatchZone x={ENTRY_W + N * SPACE_W} y={0} w={4} h={SVG_H} />

          {/* ── Floor label ── */}
          <rect x={ENTRY_W + 4} y={SPACE_H + LANE_H / 2 - 9} width={60} height={18} rx="4" fill={isGround ? GREEN : '#1d4ed8'} opacity="0.9" />
          <text x={ENTRY_W + 34} y={SPACE_H + LANE_H / 2 + 5} textAnchor="middle" fill={WHITE} fontSize="9" fontWeight="bold">
            {isGround ? 'TẦNG G' : 'TẦNG 1-2'}
          </text>

          {/* ── Outer border ── */}
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="none" stroke={STRIPE} strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
