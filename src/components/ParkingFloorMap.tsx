import { useMemo } from 'react';

export interface MapSlot {
  id: string;
  code: string;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance' | 'Locked' | 'Pending';
}

// Which vehicle type each slot row serves (derived from code prefix)
export function slotRowType(code: string): 'car' | 'motorbike' | 'ev' {
  const row = code[0];
  if (row === 'B' || row === 'E') return 'motorbike';
  if (row === 'C') return 'ev';
  return 'car'; // A, D
}

interface Props {
  slots?: MapSlot[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  level?: 1 | 2;
  /** When set, only slots of this type are clickable; others are dimmed */
  filterVehicleType?: 'car' | 'motorbike' | 'ev' | null;
  /** When set, only show slots belonging to this area (for staff/manager split view) */
  areaMode?: 'all' | 'car' | 'motorbike';
  /** Issue-report mode: ALL slots are clickable (not just Available); selected slot is orange */
  issueMode?: boolean;
}

// Layout constants
const VW = 760;
const VH = 450;
const BH = 390;

interface SpaceDef {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpaces(_level: 1 | 2): SpaceDef[] {
  const spaces: SpaceDef[] = [];
  for (let i = 0; i < 11; i++) {
    spaces.push({ code: `A${String(i + 1).padStart(2, '0')}`, x: 30 + i * 62, y: 18, w: 56, h: 38 });
  }
  for (let i = 0; i < 5; i++) {
    spaces.push({ code: `B${String(i + 1).padStart(2, '0')}`, x: 8, y: 88 + i * 46, w: 68, h: 40 });
  }
  for (let i = 0; i < 5; i++) {
    spaces.push({ code: `C${String(i + 1).padStart(2, '0')}`, x: 580, y: 88 + i * 46, w: 68, h: 40 });
  }
  for (let i = 0; i < 4; i++) {
    spaces.push({ code: `D${String(i + 1).padStart(2, '0')}`, x: 684, y: 92 + i * 55, w: 68, h: 48 });
  }
  for (let i = 0; i < 11; i++) {
    spaces.push({ code: `E${String(i + 1).padStart(2, '0')}`, x: 30 + i * 62, y: 314, w: 56, h: 38 });
  }
  return spaces;
}

type SlotColors = { top: string; mid: string; bot: string; stroke: string; text: string; glow?: string; dashArray?: string };

function slotColors(status: MapSlot['status'], selected: boolean, dimmed = false, issueMode = false): SlotColors {
  if (dimmed) return { top: '#1e293b', mid: '#1e293b', bot: '#0f172a', stroke: '#334155', text: '#475569' };
  if (selected && issueMode) return { top: '#fb923c', mid: '#f97316', bot: '#ea580c', stroke: '#fed7aa', text: '#fff', glow: '#f97316' };
  if (selected) return { top: '#38bdf8', mid: '#0ea5e9', bot: '#0284c7', stroke: '#7dd3fc', text: '#fff', glow: '#0ea5e9' };
  switch (status) {
    case 'Available':
      return { top: '#1e3a5f', mid: '#163354', bot: '#0e2340', stroke: '#3b82f6', text: '#93c5fd', glow: '#3b82f6' };
    case 'Occupied':
      return { top: '#166534', mid: '#15803d', bot: '#14532d', stroke: '#4ade80', text: '#bbf7d0' };
    case 'Pending':
      return { top: '#713f12', mid: '#92400e', bot: '#78350f', stroke: '#fbbf24', text: '#fde68a', dashArray: '4,2' };
    case 'Reserved':
      return { top: '#b45309', mid: '#d97706', bot: '#92400e', stroke: '#fcd34d', text: '#fff' };
    case 'Maintenance':
      return { top: '#991b1b', mid: '#dc2626', bot: '#7f1d1d', stroke: '#fca5a5', text: '#fff' };
    case 'Locked':
      return { top: '#9d174d', mid: '#db2777', bot: '#831843', stroke: '#f9a8d4', text: '#fff' };
    default:
      return { top: '#1e293b', mid: '#334155', bot: '#0f172a', stroke: '#475569', text: '#94a3b8' };
  }
}

// 3D box for a parking slot
function Slot3D({ sp, c, clickable, gradId }: {
  sp: SpaceDef & { id: string; status: MapSlot['status'] };
  c: SlotColors;
  clickable: boolean;
  gradId: string;
}) {
  const DEPTH = 5; // 3D extrusion offset
  const cx = sp.x + sp.w / 2;
  const cy = sp.y + sp.h / 2;

  // Top perspective face (top-right shifted)
  const topFace = `${sp.x},${sp.y} ${sp.x + sp.w},${sp.y} ${sp.x + sp.w + DEPTH},${sp.y - DEPTH} ${sp.x + DEPTH},${sp.y - DEPTH}`;
  // Right side face
  const rightFace = `${sp.x + sp.w},${sp.y} ${sp.x + sp.w},${sp.y + sp.h} ${sp.x + sp.w + DEPTH},${sp.y + sp.h - DEPTH} ${sp.x + sp.w + DEPTH},${sp.y - DEPTH}`;

  return (
    <g
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      className={clickable ? 'group' : ''}
    >
      {/* Glow ring when hovered (clickable only) */}
      {clickable && (
        <rect
          x={sp.x - 2}
          y={sp.y - 2}
          width={sp.w + 4}
          height={sp.h + 4}
          rx="5"
          fill="none"
          stroke={c.glow ?? c.stroke}
          strokeWidth="0"
          className="group-hover:stroke-3 transition-all"
          opacity="0.5"
        />
      )}
      {/* Right side face (depth) */}
      <polygon points={rightFace} fill={c.bot} opacity="0.9" />
      {/* Top perspective face (top lip) */}
      <polygon points={topFace} fill={c.top} opacity="0.85" />
      {/* Main face */}
      <rect
        x={sp.x}
        y={sp.y}
        width={sp.w}
        height={sp.h}
        rx="3"
        fill={`url(#${gradId})`}
        stroke={c.stroke}
        strokeWidth={c.dashArray ? 1.5 : 1.5}
        strokeDasharray={c.dashArray}
        className={clickable ? 'group-hover:brightness-125 transition-all' : ''}
      />
      {/* Slot code label */}
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        fill={c.text}
        fontSize="7.5"
        fontWeight="800"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="0.5"
      >
        {sp.code}
      </text>
      {/* Status mini icon/text */}
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        fill={c.text}
        fontSize="5.5"
        fontFamily="sans-serif"
        opacity="0.7"
      >
        {sp.status === 'Available' ? '✓' : sp.status === 'Occupied' ? '●' : sp.status === 'Reserved' ? '⊛' : sp.status === 'Maintenance' ? '⚠' : sp.status === 'Locked' ? '⊘' : '?'}
      </text>
    </g>
  );
}

export default function ParkingFloorMap({
  slots,
  selectedId,
  onSelect,
  interactive = false,
  level = 1,
  filterVehicleType,
  areaMode = 'all',
  issueMode = false,
}: Props) {
  const spaceDefs = useMemo(() => buildSpaces(level), [level]);

  const enriched = useMemo(() => {
    const byCode = new Map(slots?.map((s) => [s.code, s]) ?? []);
    return spaceDefs.map((def) => {
      const slot = byCode.get(def.code);
      const rowType = slotRowType(def.code);
      const hiddenByArea =
        areaMode === 'car' ? (rowType !== 'car' && rowType !== 'ev') :
        areaMode === 'motorbike' ? rowType !== 'motorbike' :
        false;
      const dimmedByFilter = filterVehicleType != null ? rowType !== filterVehicleType : false;
      return {
        ...def,
        id: slot?.id ?? `virtual-${def.code}`,
        status: slot?.status ?? 'Available' as MapSlot['status'],
        isReal: !!slot,
        rowType,
        hiddenByArea,
        dimmedByFilter,
      };
    });
  }, [spaceDefs, slots, filterVehicleType, areaMode]);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full rounded-2xl shadow-2xl"
      style={{ background: '#0a1628', fontFamily: 'sans-serif' }}
    >
      <defs>
        {/* Slot gradient definitions */}
        {enriched.map((sp) => {
          const isSelected = selectedId === sp.id;
          const c = slotColors(sp.status, isSelected, sp.dimmedByFilter, issueMode);
          return (
            <linearGradient key={sp.code} id={`sg-${sp.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.top} />
              <stop offset="50%" stopColor={c.mid} />
              <stop offset="100%" stopColor={c.bot} />
            </linearGradient>
          );
        })}
        {/* Asphalt texture pattern */}
        <pattern id="asphalt" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#0d1e35" />
          <circle cx="10" cy="10" r="0.8" fill="#1a2f4a" opacity="0.6" />
          <circle cx="30" cy="25" r="0.6" fill="#1a2f4a" opacity="0.4" />
          <circle cx="20" cy="35" r="0.7" fill="#1a2f4a" opacity="0.5" />
        </pattern>
        {/* Glow filter */}
        <filter id="slotGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Lane stripe gradient */}
        <linearGradient id="laneGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2f4a" />
          <stop offset="100%" stopColor="#152540" />
        </linearGradient>
        {/* Building wall gradient */}
        <linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0e1f35" />
        </linearGradient>
      </defs>

      {/* Floor background */}
      <rect width={VW} height={BH} fill="url(#asphalt)" />

      {/* Building perimeter wall */}
      <rect x="4" y="4" width={VW - 8} height={BH - 10} fill="none" stroke="#1e4080" strokeWidth="4" rx="4" opacity="0.8" />
      {/* Inner glow of perimeter */}
      <rect x="7" y="7" width={VW - 14} height={BH - 16} fill="none" stroke="#3b6cc4" strokeWidth="1" rx="3" opacity="0.4" />

      {/* Drive lane — top */}
      <rect x="82" y="62" width={484} height={58} fill="url(#laneGrad)" opacity="0.9" rx="2" />
      {/* Yellow lane center dashes — top lane */}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`tl${i}`}
          x1={110 + i * 58}
          y1={91}
          x2={140 + i * 58}
          y2={91}
          stroke="#fbbf24"
          strokeWidth="1.5"
          strokeDasharray="20,10"
          opacity="0.8"
        />
      ))}
      {/* Arrow indicators top lane */}
      <text x="190" y="95" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="bold" opacity="0.9">▶</text>
      <text x="340" y="95" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="bold" opacity="0.9">▶</text>

      {/* Drive lane — bottom */}
      <rect x="82" y="252" width={484} height={58} fill="url(#laneGrad)" opacity="0.9" rx="2" />
      {/* Yellow lane center dashes — bottom lane */}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`bl${i}`}
          x1={540 - i * 58}
          y1={281}
          x2={510 - i * 58}
          y2={281}
          stroke="#fbbf24"
          strokeWidth="1.5"
          strokeDasharray="20,10"
          opacity="0.8"
        />
      ))}
      {/* Arrow indicators bottom lane (going left) */}
      <text x="420" y="285" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="bold" opacity="0.9">◀</text>
      <text x="260" y="285" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="bold" opacity="0.9">◀</text>

      {/* Lane separator dashed lines */}
      <line x1={82} y1={62} x2={82} y2={312} stroke="#1e4080" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.6" />
      <line x1={566} y1={62} x2={566} y2={312} stroke="#1e4080" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.6" />

      {/* ── STAFF BOOTH — 3D box style ── */}
      {/* Shadow base */}
      <rect x="330" y="142" width="86" height="76" rx="6" fill="#000" opacity="0.4" />
      {/* Right face */}
      <rect x="410" y="138" width="8" height="76" rx="2" fill="#0a1628" opacity="0.8" />
      {/* Top face */}
      <rect x="330" y="130" width="86" height="12" rx="2" fill="#1d3461" opacity="0.9" />
      {/* Main face */}
      <rect x="326" y="138" width="86" height="76" rx="6" fill="#0d1e3a" stroke="#2563eb" strokeWidth="1.5" />
      {/* Inner highlight */}
      <rect x="332" y="144" width="74" height="64" rx="4" fill="#0f2448" stroke="#1d4ed8" strokeWidth="0.8" />
      {/* Staff text */}
      <text x="369" y="175" textAnchor="middle" fill="#60a5fa" fontSize="9" fontWeight="900" letterSpacing="1.5">STAFF</text>
      <text x="369" y="189" textAnchor="middle" fill="#60a5fa" fontSize="9" fontWeight="900" letterSpacing="1.5">BOOTH</text>
      {/* Door arc */}
      <path d="M 326 180 A 14 14 0 0 1 312 166" fill="none" stroke="#3b82f6" strokeWidth="1.2" opacity="0.7" />
      <line x1="326" y1="180" x2="312" y2="180" stroke="#3b82f6" strokeWidth="1.2" opacity="0.7" />

      {/* ── RAMP — 3D box style ── */}
      {/* Shadow */}
      <rect x="446" y="142" width="76" height="76" rx="6" fill="#000" opacity="0.4" />
      {/* Top face */}
      <rect x="442" y="130" width="80" height="12" rx="2" fill="#1a1a2e" opacity="0.9" />
      {/* Right face */}
      <rect x="518" y="138" width="8" height="76" rx="2" fill="#0a0a1a" opacity="0.8" />
      {/* Main face */}
      <rect x="442" y="138" width="80" height="76" rx="6" fill="#0d0d1f" stroke="#4f46e5" strokeWidth="1.5" />
      {/* Diagonal ramp lines */}
      <line x1="442" y1="138" x2="522" y2="214" stroke="#4f46e5" strokeWidth="0.8" strokeDasharray="5,3" opacity="0.7" />
      <line x1="522" y1="138" x2="442" y2="214" stroke="#4f46e5" strokeWidth="0.8" strokeDasharray="5,3" opacity="0.7" />
      <text x="482" y="175" textAnchor="middle" fill="#818cf8" fontSize="9" fontWeight="800">RAMP</text>
      <text x="482" y="190" textAnchor="middle" fill="#818cf8" fontSize="11">{level === 1 ? '↑ UP' : '↓ DN'}</text>

      {/* Entry / Exit markers */}
      <rect x="6" y="62" width="72" height="24" rx="3" fill="#052e16" stroke="#22c55e" strokeWidth="1" />
      <text x="42" y="78" textAnchor="middle" fill="#4ade80" fontSize="7.5" fontWeight="900" letterSpacing="1">ENTRY</text>
      <rect x="6" y="262" width="72" height="24" rx="3" fill="#450a0a" stroke="#ef4444" strokeWidth="1" />
      <text x="42" y="278" textAnchor="middle" fill="#f87171" fontSize="7.5" fontWeight="900" letterSpacing="1">EXIT</text>

      {/* ── Parking spaces ── */}
      {enriched.map((sp) => {
        if (sp.hiddenByArea) return null;
        const isSelected = selectedId === sp.id;
        const isAvail = sp.status === 'Available';
        const clickable = interactive && !sp.dimmedByFilter && (issueMode || isAvail);
        const c = slotColors(sp.status, isSelected, sp.dimmedByFilter, issueMode);

        return (
          <g
            key={sp.code}
            onClick={() => clickable && onSelect?.(sp.id)}
          >
            <Slot3D sp={sp} c={c} clickable={clickable} gradId={`sg-${sp.code}`} />
          </g>
        );
      })}

      {/* ── Corner accent bolts ── */}
      {[[16, 16], [VW - 16, 16], [16, BH - 16], [VW - 16, BH - 16]].map(([bx, by], i) => (
        <g key={i}>
          <circle cx={bx} cy={by} r="6" fill="#0d1e35" stroke="#1e4080" strokeWidth="1.5" />
          <circle cx={bx} cy={by} r="2" fill="#3b82f6" opacity="0.7" />
        </g>
      ))}

      {/* ── Legend strip ── */}
      <rect x="0" y={BH} width={VW} height={VH - BH} fill="#060e1c" />
      <text x="10" y={BH + 16} fill="#475569" fontSize="7.5" fontWeight="800" letterSpacing="1.5">TRẠNG THÁI Ô ĐỖ</text>

      {[
        { color: '#163354', stroke: '#3b82f6', label: 'Trống',      tx: 10 },
        { color: '#15803d', stroke: '#4ade80', label: 'Đang đỗ',    tx: 90 },
        { color: '#92400e', stroke: '#fbbf24', label: 'Chờ duyệt',  tx: 182, dash: '4,2' },
        { color: '#d97706', stroke: '#fcd34d', label: 'Đã đặt',     tx: 280 },
        { color: '#db2777', stroke: '#f9a8d4', label: 'Xe tháng',   tx: 368 },
        { color: '#dc2626', stroke: '#fca5a5', label: 'Sửa chữa',   tx: 460 },
        ...(interactive
          ? [{ color: issueMode ? '#f97316' : '#0ea5e9', stroke: issueMode ? '#fed7aa' : '#7dd3fc', label: 'Đã chọn', tx: 558 }]
          : []),
      ].map((item) => (
        <g key={item.tx}>
          <rect
            x={item.tx}
            y={BH + 22}
            width="13"
            height="13"
            rx="2"
            fill={item.color}
            stroke={item.stroke}
            strokeWidth="1"
            strokeDasharray={(item as { dash?: string }).dash}
          />
          <text x={item.tx + 17} y={BH + 33} fill="#94a3b8" fontSize="10">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}
