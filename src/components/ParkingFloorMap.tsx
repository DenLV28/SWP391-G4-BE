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

// ── Layout constants — generously spaced so slots never crowd each other ──
const ROW_X0 = 40;
const ROW_W = 54;
const ROW_H = 40;
const ROW_STEP = 70; // 16px gap between row A / row E slots

const SIDE_W = 64;
const BC_H = 42;
const BC_STEP = 60; // 18px gap between column B / column C slots
const BC_Y0 = 142;

const D_H = 50;
const D_STEP = 68; // 18px gap between column D slots
const D_Y0 = 150;

const COL_B_X = 10;
const COL_C_X = 604;
const COL_D_X = 802;

const LANE_X0 = COL_B_X + SIDE_W + 18; // 92
const LANE_X1 = COL_C_X - 18; // 586
const LANE_TOP_Y = 78;
const LANE_H = 52;
const LANE_BOTTOM_Y = 436;

const ROW_A_Y = 24;
const ROW_E_Y = 500;

const VW = 890;
const BH = 560;
const VH = 638;

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
    spaces.push({ code: `A${String(i + 1).padStart(2, '0')}`, x: ROW_X0 + i * ROW_STEP, y: ROW_A_Y, w: ROW_W, h: ROW_H });
  }
  for (let i = 0; i < 5; i++) {
    spaces.push({ code: `B${String(i + 1).padStart(2, '0')}`, x: COL_B_X, y: BC_Y0 + i * BC_STEP, w: SIDE_W, h: BC_H });
  }
  for (let i = 0; i < 5; i++) {
    spaces.push({ code: `C${String(i + 1).padStart(2, '0')}`, x: COL_C_X, y: BC_Y0 + i * BC_STEP, w: SIDE_W, h: BC_H });
  }
  for (let i = 0; i < 4; i++) {
    spaces.push({ code: `D${String(i + 1).padStart(2, '0')}`, x: COL_D_X, y: D_Y0 + i * D_STEP, w: SIDE_W, h: D_H });
  }
  for (let i = 0; i < 11; i++) {
    spaces.push({ code: `E${String(i + 1).padStart(2, '0')}`, x: ROW_X0 + i * ROW_STEP, y: ROW_E_Y, w: ROW_W, h: ROW_H });
  }
  return spaces;
}

type SlotColors = { fill: string; stroke: string; text: string; dashArray?: string };

function slotColors(status: MapSlot['status'], selected: boolean, dimmed = false, issueMode = false): SlotColors {
  if (dimmed) return { fill: '#f8fafc', stroke: '#e2e8f0', text: '#cbd5e1' };
  if (selected && issueMode) return { fill: '#f97316', stroke: '#c2410c', text: '#ffffff' };
  if (selected) return { fill: '#2563eb', stroke: '#1d4ed8', text: '#ffffff' };
  switch (status) {
    case 'Available':
      return { fill: '#ffffff', stroke: '#3b82f6', text: '#1d4ed8' };
    case 'Occupied':
      return { fill: '#ecfdf5', stroke: '#10b981', text: '#047857' };
    case 'Pending':
      return { fill: '#fffbeb', stroke: '#fbbf24', text: '#b45309', dashArray: '4,3' };
    case 'Reserved':
      return { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' };
    case 'Maintenance':
      return { fill: '#fef2f2', stroke: '#ef4444', text: '#b91c1c' };
    case 'Locked':
      return { fill: '#fdf2f8', stroke: '#ec4899', text: '#be185d' };
    default:
      return { fill: '#f8fafc', stroke: '#cbd5e1', text: '#64748b' };
  }
}

// Flat, light-theme slot card (subtle shadow instead of dark 3D extrusion)
function SlotCard({ sp, c, clickable }: {
  sp: SpaceDef & { id: string; status: MapSlot['status'] };
  c: SlotColors;
  clickable: boolean;
}) {
  const cx = sp.x + sp.w / 2;
  const cy = sp.y + sp.h / 2;

  return (
    <g style={{ cursor: clickable ? 'pointer' : 'default' }} className={clickable ? 'group' : ''}>
      {/* Soft drop shadow */}
      <rect x={sp.x + 1.5} y={sp.y + 2.5} width={sp.w} height={sp.h} rx="8" fill="#0f172a" opacity="0.06" />
      {/* Main card */}
      <rect
        x={sp.x}
        y={sp.y}
        width={sp.w}
        height={sp.h}
        rx="8"
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={c.dashArray ? 1.6 : 1.6}
        strokeDasharray={c.dashArray}
        className={clickable ? 'group-hover:brightness-95 transition-all' : ''}
      />
      {/* Slot code label */}
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        fill={c.text}
        fontSize="9.5"
        fontWeight="800"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="0.4"
      >
        {sp.code}
      </text>
      {/* Status mini icon */}
      <text x={cx} y={cy + 9} textAnchor="middle" fill={c.text} fontSize="7" fontFamily="sans-serif" opacity="0.85">
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
      className="w-full rounded-2xl border border-slate-200 shadow-sm"
      style={{ background: '#ffffff', fontFamily: 'sans-serif' }}
    >
      <defs>
        {/* Floor texture pattern */}
        <pattern id="floorTexture" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#f8fafc" />
          <circle cx="10" cy="10" r="0.8" fill="#e2e8f0" opacity="0.8" />
          <circle cx="30" cy="25" r="0.6" fill="#e2e8f0" opacity="0.6" />
          <circle cx="20" cy="35" r="0.7" fill="#e2e8f0" opacity="0.7" />
        </pattern>
      </defs>

      {/* Floor background */}
      <rect width={VW} height={BH} fill="url(#floorTexture)" />

      {/* Building perimeter wall */}
      <rect x="4" y="4" width={VW - 8} height={BH - 10} fill="none" stroke="#cbd5e1" strokeWidth="3" rx="10" />
      <rect x="8" y="8" width={VW - 16} height={BH - 18} fill="none" stroke="#e2e8f0" strokeWidth="1" rx="8" />

      {/* Drive lane — top (Entry flow) */}
      <rect x={LANE_X0} y={LANE_TOP_Y} width={LANE_X1 - LANE_X0} height={LANE_H} fill="#f1f5f9" rx="6" />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`tl${i}`}
          x1={LANE_X0 + 60 + i * 78}
          y1={LANE_TOP_Y + LANE_H / 2}
          x2={LANE_X0 + 90 + i * 78}
          y2={LANE_TOP_Y + LANE_H / 2}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="18,10"
          opacity="0.8"
        />
      ))}
      <text x={LANE_X0 + 250} y={LANE_TOP_Y + LANE_H / 2 + 4} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">▶</text>
      <text x={LANE_X0 + 400} y={LANE_TOP_Y + LANE_H / 2 + 4} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">▶</text>

      {/* Drive lane — bottom (Exit flow) */}
      <rect x={LANE_X0} y={LANE_BOTTOM_Y} width={LANE_X1 - LANE_X0} height={LANE_H} fill="#f1f5f9" rx="6" />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`bl${i}`}
          x1={LANE_X1 - 60 - i * 78}
          y1={LANE_BOTTOM_Y + LANE_H / 2}
          x2={LANE_X1 - 90 - i * 78}
          y2={LANE_BOTTOM_Y + LANE_H / 2}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="18,10"
          opacity="0.8"
        />
      ))}
      <text x={LANE_X1 - 250} y={LANE_BOTTOM_Y + LANE_H / 2 + 4} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">◀</text>
      <text x={LANE_X1 - 400} y={LANE_BOTTOM_Y + LANE_H / 2 + 4} textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">◀</text>

      {/* Lane separators */}
      <line x1={LANE_X0} y1={LANE_TOP_Y} x2={LANE_X0} y2={LANE_BOTTOM_Y + LANE_H} stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="6,5" />
      <line x1={LANE_X1} y1={LANE_TOP_Y} x2={LANE_X1} y2={LANE_BOTTOM_Y + LANE_H} stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="6,5" />

      {/* ── ENTRY marker — sits inside the top lane, well clear of column B ── */}
      <rect x={LANE_X0 + 6} y={LANE_TOP_Y + 6} width="92" height="40" rx="8" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.6" />
      <text x={LANE_X0 + 52} y={LANE_TOP_Y + 26} textAnchor="middle" fill="#047857" fontSize="10.5" fontWeight="900" letterSpacing="1">ENTRY</text>
      <text x={LANE_X0 + 52} y={LANE_TOP_Y + 39} textAnchor="middle" fill="#059669" fontSize="9" fontWeight="bold">▶ Vào</text>

      {/* ── EXIT marker — sits inside the bottom lane, well clear of column B ── */}
      <rect x={LANE_X0 + 6} y={LANE_BOTTOM_Y + 6} width="92" height="40" rx="8" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.6" />
      <text x={LANE_X0 + 52} y={LANE_BOTTOM_Y + 26} textAnchor="middle" fill="#b91c1c" fontSize="10.5" fontWeight="900" letterSpacing="1">EXIT</text>
      <text x={LANE_X0 + 52} y={LANE_BOTTOM_Y + 39} textAnchor="middle" fill="#dc2626" fontSize="9" fontWeight="bold">◀ Ra</text>

      {/* ── STAFF BOOTH ── */}
      <rect x="243" y="222" width="118" height="108" rx="10" fill="#0f172a" opacity="0.05" />
      <rect x="240" y="218" width="118" height="108" rx="10" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.6" />
      <rect x="248" y="226" width="102" height="92" rx="7" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
      <text x="299" y="266" textAnchor="middle" fill="#2563eb" fontSize="11" fontWeight="900" letterSpacing="1.5">STAFF</text>
      <text x="299" y="282" textAnchor="middle" fill="#2563eb" fontSize="11" fontWeight="900" letterSpacing="1.5">BOOTH</text>
      <path d="M 248 300 A 16 16 0 0 1 232 284" fill="none" stroke="#3b82f6" strokeWidth="1.3" opacity="0.6" />
      <line x1="248" y1="300" x2="232" y2="300" stroke="#3b82f6" strokeWidth="1.3" opacity="0.6" />

      {/* ── RAMP ── */}
      <rect x="393" y="222" width="108" height="108" rx="10" fill="#0f172a" opacity="0.05" />
      <rect x="390" y="218" width="108" height="108" rx="10" fill="#ffffff" stroke="#a5b4fc" strokeWidth="1.6" />
      <line x1="390" y1="218" x2="498" y2="326" stroke="#818cf8" strokeWidth="1" strokeDasharray="6,4" opacity="0.7" />
      <line x1="498" y1="218" x2="390" y2="326" stroke="#818cf8" strokeWidth="1" strokeDasharray="6,4" opacity="0.7" />
      <text x="444" y="266" textAnchor="middle" fill="#4f46e5" fontSize="11" fontWeight="900">RAMP</text>
      <text x="444" y="286" textAnchor="middle" fill="#4f46e5" fontSize="13" fontWeight="bold">{level === 1 ? '↑ UP' : '↓ DN'}</text>

      {/* ── Parking spaces ── */}
      {enriched.map((sp) => {
        if (sp.hiddenByArea) return null;
        // Có kho ô đỗ thật (mỗi bãi sức chứa khác nhau) → vị trí không tồn tại
        // trong bãi thì không vẽ. Không truyền slots (trang demo công khai) →
        // vẫn vẽ đủ mặt bằng như cũ.
        if ((slots?.length ?? 0) > 0 && !sp.isReal) return null;
        const isSelected = selectedId === sp.id;
        const isAvail = sp.status === 'Available';
        const clickable = interactive && !sp.dimmedByFilter && (issueMode || isAvail);
        const c = slotColors(sp.status, isSelected, sp.dimmedByFilter, issueMode);

        return (
          <g key={sp.code} onClick={() => clickable && onSelect?.(sp.id)}>
            <SlotCard sp={sp} c={c} clickable={clickable} />
          </g>
        );
      })}

      {/* ── Corner accent bolts ── */}
      {[[18, 18], [VW - 18, 18], [18, BH - 18], [VW - 18, BH - 18]].map(([bx, by], i) => (
        <g key={i}>
          <circle cx={bx} cy={by} r="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx={bx} cy={by} r="2" fill="#94a3b8" />
        </g>
      ))}

      {/* ── Legend strip ── */}
      <rect x="0" y={BH} width={VW} height={VH - BH} fill="#ffffff" />
      <line x1="0" y1={BH} x2={VW} y2={BH} stroke="#e2e8f0" strokeWidth="1" />
      <text x="14" y={BH + 20} fill="#64748b" fontSize="9" fontWeight="800" letterSpacing="1.5">TRẠNG THÁI Ô ĐỖ</text>

      {[
        { color: '#ffffff', stroke: '#3b82f6', label: 'Trống',      tx: 14 },
        { color: '#ecfdf5', stroke: '#10b981', label: 'Đang đỗ',    tx: 106 },
        { color: '#fffbeb', stroke: '#fbbf24', label: 'Chờ duyệt',  tx: 210, dash: '4,3' },
        { color: '#fef3c7', stroke: '#f59e0b', label: 'Đã đặt',     tx: 320 },
        { color: '#fdf2f8', stroke: '#ec4899', label: 'Xe tháng',   tx: 420 },
        { color: '#fef2f2', stroke: '#ef4444', label: 'Sửa chữa',   tx: 524 },
        ...(interactive
          ? [{ color: issueMode ? '#f97316' : '#2563eb', stroke: issueMode ? '#c2410c' : '#1d4ed8', label: 'Đã chọn', tx: 628 }]
          : []),
      ].map((item) => (
        <g key={item.tx}>
          <rect
            x={item.tx}
            y={BH + 30}
            width="15"
            height="15"
            rx="4"
            fill={item.color}
            stroke={item.stroke}
            strokeWidth="1.4"
            strokeDasharray={(item as { dash?: string }).dash}
          />
          <text x={item.tx + 20} y={BH + 42} fill="#475569" fontSize="10.5">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}
