import { useMemo, useRef } from 'react';

export interface MapSlot {
  id: string;
  code: string;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance' | 'Locked' | 'Pending';
  /** Toạ độ kéo thả (hệ toạ độ SVG). Bỏ trống → xếp theo công thức lưới mẫu. */
  x?: number | null;
  y?: number | null;
  /** Kích thước sau khi kéo dãn. Bỏ trống → cỡ mặc định của lưới mẫu. */
  w?: number | null;
  h?: number | null;
  /**
   * Loại xe THẬT của ô (dbo.parking_slots.vehicle_type). Luôn truyền vào nếu có:
   * mã ô giờ do Admin tự đặt ('V1', 'VIP3'...) nên KHÔNG thể suy loại xe từ chữ
   * cái đầu nữa — thiếu trường này thì ô xe máy tên 'V1' sẽ bị hiểu thành ô tô.
   */
  vehicleType?: 'car' | 'motorbike' | 'electric vehicle' | null;
}

/** Loại xe theo mã ô của LƯỚI MẪU — chỉ dùng khi ô không mang vehicleType thật. */
export function slotRowType(code: string): 'car' | 'motorbike' | 'ev' {
  const row = code[0];
  if (row === 'B' || row === 'E') return 'motorbike';
  if (row === 'C') return 'ev';
  return 'car'; // A, D
}

/** VehicleKey của app ('electric vehicle') → khoá nội bộ của sơ đồ ('ev'). */
function toRowType(v: MapSlot['vehicleType']): 'car' | 'motorbike' | 'ev' | null {
  if (v === 'motorbike') return 'motorbike';
  if (v === 'electric vehicle') return 'ev';
  if (v === 'car') return 'car';
  return null;
}

/** Cổng vào/ra do Admin đặt cho từng bãi (dbo.parking_lot_gates). */
export interface MapGate {
  kind: 'entry' | 'exit';
  label: string;
  position: 'left' | 'center' | 'right';
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
  /**
   * Cổng vào/ra của bãi. Bỏ trống → giữ nguyên hình cũ (1 entry + 1 exit ở đầu
   * trái hai làn), nên mọi trang đang gọi component này không đổi gì.
   */
  gates?: MapGate[];
  /**
   * Chế độ thiết kế của Admin: vẽ ĐỦ 36 vị trí mặt bằng mẫu, ô đã có vẽ đậm,
   * ô chưa có vẽ nét đứt mờ; bấm bất kỳ ô nào để bật/tắt qua `onToggleSlot`.
   */
  designMode?: boolean;
  onToggleSlot?: (code: string) => void;
  /** designMode: tô sáng các vị trí còn trống làm đích khi đang đổi chỗ một ô. */
  highlightEmpty?: boolean;
  /** designMode: kéo thả xong một ô — trả về toạ độ mới trong hệ toạ độ SVG. */
  onMoveSlot?: (code: string, x: number, y: number) => void;
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

/**
 * KÍCH THƯỚC Ô ĐỖ THEO LOẠI XE — nguồn chân lý duy nhất cho mọi sơ đồ.
 *
 * Thứ tự to nhỏ phản ánh chỗ xe thật sự chiếm:
 *   nhỏ nhất → Xe máy / Xe máy điện      54 × 40
 *   vừa      → Ô tô 4-7 chỗ (Xăng)       62 × 46
 *   lớn nhất → Ô tô 4-7 chỗ (Điện / EV)  68 × 52   (cần thêm chỗ cho trụ sạc)
 *
 * Trước đây ô tô xăng lại là ô to nhất còn ô tô điện chỉ nhỉnh hơn xe máy —
 * ngược với thực tế.
 *
 * Các số này bị chặn trên bởi khoảng cách giữa các vị trí trong lưới mẫu:
 * hàng A/E cách nhau ROW_STEP = 70 nên bề ngang tối đa là 68 (chừa 2px);
 * cột B/C cách nhau BC_STEP = 60 nên chiều cao tối đa là 52 (chừa 8px).
 * Tăng quá mức này thì các ô cạnh nhau sẽ đè lên nhau.
 */
const MOTORBIKE_W = ROW_W, MOTORBIKE_H = ROW_H;   // 54 × 40
const CAR_W = 62, CAR_H = 46;                     // xăng
const EV_W = 68, EV_H = 52;                       // điện — lớn nhất

export const VEHICLE_SLOT_SIZE: Record<'car' | 'motorbike' | 'electric vehicle', { w: number; h: number }> = {
  motorbike: { w: MOTORBIKE_W, h: MOTORBIKE_H },
  car: { w: CAR_W, h: CAR_H },
  'electric vehicle': { w: EV_W, h: EV_H },
};

/** Bản đối chiếu theo khoá nội bộ của sơ đồ ('ev' thay cho 'electric vehicle'). */
const SIZE_BY_ROW_TYPE: Record<'car' | 'motorbike' | 'ev', { w: number; h: number }> = {
  motorbike: VEHICLE_SLOT_SIZE.motorbike,
  car: VEHICLE_SLOT_SIZE.car,
  ev: VEHICLE_SLOT_SIZE['electric vehicle'],
};

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

/** Vị trí cổng trên làn → toạ độ x của thẻ cổng (thẻ rộng 92, làn dài ~494). */
function gateX(position: MapGate['position']): number {
  const laneW = LANE_X1 - LANE_X0;
  if (position === 'center') return LANE_X0 + (laneW - 92) / 2;
  if (position === 'right') return LANE_X1 - 92 - 6;
  return LANE_X0 + 6;
}

const DEFAULT_GATES: MapGate[] = [
  { kind: 'entry', label: 'Vào', position: 'left' },
  { kind: 'exit', label: 'Ra', position: 'left' },
];

export default function ParkingFloorMap({
  slots,
  selectedId,
  onSelect,
  interactive = false,
  level = 1,
  filterVehicleType,
  areaMode = 'all',
  issueMode = false,
  gates,
  designMode = false,
  onToggleSlot,
  highlightEmpty = false,
  onMoveSlot,
}: Props) {
  const spaceDefs = useMemo(() => buildSpaces(level), [level]);
  const gateList = gates && gates.length ? gates : DEFAULT_GATES;
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Ô đang kéo — giữ trong ref để không re-render mỗi lần con trỏ nhích.
  const dragRef = useRef<{ code: string; dx: number; dy: number } | null>(null);

  const enriched = useMemo(() => {
    const byCode = new Map(slots?.map((s) => [s.code, s]) ?? []);
    const gridCodes = new Set(spaceDefs.map((d) => d.code));

    // Ô có mã ngoài lưới mẫu (Admin tự đặt, vd. 'VIP1') không có sẵn ô trong
    // `spaceDefs` — dựng thêm def từ chính toạ độ của nó.
    //
    // BẮT BUỘC phải có toạ độ thật. DB còn các hàng cũ ('T1-A-01', 'B1-A-02',
    // 'T2-B-01'...) mà caller tách mã bằng `slotCode.split('-').pop()` nên đều
    // ra '01'/'02' — không thuộc lưới và không có toạ độ. Nếu vẫn vẽ chúng ở
    // giữa bãi làm mặc định thì cả loạt sẽ chồng lên nhau ngay trên RAMP, tạo
    // ra "ô đỗ ảo 01". Không có toạ độ nghĩa là không biết đặt ở đâu → không vẽ.
    const seen = new Set<string>();
    const extraDefs: SpaceDef[] = (slots ?? [])
      .filter((s) => {
        if (gridCodes.has(s.code)) return false;
        if (typeof s.x !== 'number' || typeof s.y !== 'number') return false;
        if (seen.has(s.code)) return false;
        seen.add(s.code);
        return true;
      })
      .map((s) => ({
        code: s.code,
        x: s.x as number,
        y: s.y as number,
        w: ROW_W,
        h: ROW_H,
      }));

    return [...spaceDefs, ...extraDefs].map((def) => {
      const slot = byCode.get(def.code);
      // Ưu tiên loại xe THẬT của ô; chỉ suy từ mã khi ô không mang thông tin đó
      // (vị trí trống của lưới mẫu, hoặc caller cũ chưa truyền vehicleType).
      const rowType = toRowType(slot?.vehicleType) ?? slotRowType(def.code);
      const hiddenByArea =
        areaMode === 'car' ? (rowType !== 'car' && rowType !== 'ev') :
        areaMode === 'motorbike' ? rowType !== 'motorbike' :
        false;
      const dimmedByFilter = filterVehicleType != null ? rowType !== filterVehicleType : false;
      // KÍCH THƯỚC THEO LOẠI XE, không theo dãy của lưới mẫu.
      //
      // Lưới mẫu gán cỡ cứng theo cột (A/E nhỏ, B/C vừa, D cao). Nhưng Admin đổi
      // được loại xe của từng ô, nên một ô xe máy nằm ở cột D vẫn bị vẽ to bằng
      // ô tô — cùng một loại xe lại có cỡ khác nhau tùy chỗ nó đứng. Lấy cỡ theo
      // loại xe thì mọi sơ đồ trong web (đặt chỗ, staff, manager, trình thiết kế)
      // đều nhất quán.
      const size = SIZE_BY_ROW_TYPE[rowType];
      return {
        ...def,
        // Ô đã được kéo thả thì dùng toạ độ riêng, chưa thì theo lưới mẫu.
        x: typeof slot?.x === 'number' ? slot.x : def.x,
        y: typeof slot?.y === 'number' ? slot.y : def.y,
        // Kích thước KHÔNG nhận giá trị riêng của từng ô nữa. Tính năng kéo dãn
        // đã bị bỏ; còn tôn trọng w/h cũ trong DB thì hai ô cùng loại xe vẫn có
        // thể khác cỡ — đúng thứ cần loại bỏ.
        w: size.w,
        h: size.h,
        id: slot?.id ?? `virtual-${def.code}`,
        status: slot?.status ?? 'Available' as MapSlot['status'],
        isReal: !!slot,
        rowType,
        hiddenByArea,
        dimmedByFilter,
      };
    });
  }, [spaceDefs, slots, filterVehicleType, areaMode]);

  /** Toạ độ con trỏ (pixel màn hình) → hệ toạ độ trong viewBox của SVG. */
  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const handleDragStart = (e: React.PointerEvent, sp: { code: string; x: number; y: number }) => {
    if (!designMode || !onMoveSlot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toSvgPoint(e.clientX, e.clientY);
    // Ghi lại khoảng lệch để ô không "nhảy" về góc khi bắt đầu kéo.
    dragRef.current = { code: sp.code, dx: p.x - sp.x, dy: p.y - sp.y };
  };

  const handleDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    // Giữ ô nằm trong khung bãi
    const x = Math.max(8, Math.min(VW - ROW_W - 8, p.x - d.dx));
    const y = Math.max(8, Math.min(BH - ROW_H - 8, p.y - d.dy));
    onMoveSlot?.(d.code, Math.round(x), Math.round(y));
  };

  const handleDragEnd = () => { dragRef.current = null; };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full rounded-2xl border border-slate-200 shadow-sm"
      style={{ background: '#ffffff', fontFamily: 'sans-serif', touchAction: designMode ? 'none' : undefined }}
      onPointerMove={designMode ? handleDragMove : undefined}
      onPointerUp={designMode ? handleDragEnd : undefined}
      onPointerCancel={designMode ? handleDragEnd : undefined}
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

      {/* ── Cổng vào/ra — nằm trong làn trên (entry) / làn dưới (exit), vị trí
             trái/giữa/phải do Admin đặt cho từng bãi ── */}
      {gateList.map((g, i) => {
        const isEntry = g.kind === 'entry';
        const x = gateX(g.position);
        const y = isEntry ? LANE_TOP_Y + 6 : LANE_BOTTOM_Y + 6;
        const c = isEntry
          ? { fill: '#ecfdf5', stroke: '#10b981', title: '#047857', sub: '#059669' }
          : { fill: '#fef2f2', stroke: '#ef4444', title: '#b91c1c', sub: '#dc2626' };
        return (
          <g key={`${g.kind}-${g.position}-${i}`}>
            <rect x={x} y={y} width="92" height="40" rx="8" fill={c.fill} stroke={c.stroke} strokeWidth="1.6" />
            <text x={x + 46} y={y + 20} textAnchor="middle" fill={c.title} fontSize="10.5" fontWeight="900" letterSpacing="1">
              {isEntry ? 'ENTRY' : 'EXIT'}
            </text>
            <text x={x + 46} y={y + 33} textAnchor="middle" fill={c.sub} fontSize="9" fontWeight="bold">
              {isEntry ? `▶ ${g.label || 'Vào'}` : `◀ ${g.label || 'Ra'}`}
            </text>
          </g>
        );
      })}

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

        // Chế độ thiết kế: vẽ ĐỦ mặt bằng mẫu, ô chưa thêm để nét đứt mờ. Bấm
        // vào ô để chọn/thêm — thao tác xóa và đổi vị trí nằm ở panel bên phải.
        if (designMode) {
          const isSel = selectedId === sp.code;
          let c: SlotColors;
          if (sp.isReal) {
            c = slotColors('Available', isSel);
          } else if (isSel) {
            // Vị trí trống đang được chọn — viền đậm để thấy rõ đang đứng ở đâu
            c = { fill: '#eff6ff', stroke: '#2563eb', text: '#1d4ed8', dashArray: '4,3' };
          } else if (highlightEmpty) {
            // Đang đổi chỗ: mọi vị trí trống là đích hợp lệ
            c = { fill: '#fffbeb', stroke: '#f59e0b', text: '#b45309', dashArray: '4,3' };
          } else {
            c = { fill: '#ffffff', stroke: '#cbd5e1', text: '#94a3b8', dashArray: '4,3' };
          }
          return (
            <g
              key={sp.code}
              onClick={() => { if (!dragRef.current) onToggleSlot?.(sp.code); }}
              // Chỉ ô ĐÃ CÓ mới kéo được; vị trí trống của lưới mẫu thì không.
              onPointerDown={sp.isReal ? (e) => handleDragStart(e, sp) : undefined}
              style={sp.isReal && onMoveSlot ? { cursor: 'grab' } : undefined}
            >
              <SlotCard sp={{ ...sp, status: 'Available' }} c={c} clickable />
            </g>
          );
        }

        // Ô KHÔNG CÓ THẬT thì không được vẽ như ô thật.
        //
        // Điều kiện cũ là `slots.length > 0` nên bãi có 0 ô lại lọt qua: sơ đồ
        // vẽ trọn lưới mẫu 36 vị trí thành các ô xanh "còn trống", trông y hệt
        // ô thật. Staff thấy sơ đồ đầy ô nhưng bộ đếm báo 0/0 và không hiểu vì
        // sao — chính là mâu thuẫn trong ảnh báo lỗi.
        //
        // Giờ chỉ cần caller có truyền mảng `slots` (tức đang hiển thị dữ liệu
        // thật) là chỉ vẽ ô thật, kể cả mảng rỗng. Trang demo công khai không
        // truyền `slots` nên vẫn vẽ đủ mặt bằng như cũ.
        //
        // `designMode` giữ NGUYÊN điều kiện cũ: trình thiết kế của Admin có
        // quy tắc hiển thị riêng, không phải chỗ cần sửa ở đây.
        const hideVirtual = designMode ? (slots?.length ?? 0) > 0 : slots !== undefined;
        if (hideVirtual && !sp.isReal) return null;
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

      {/* Bãi thật sự chưa có ô đỗ nào — nói thẳng ra giữa mặt bằng, thay vì để
          một khoảng trống khiến staff tưởng sơ đồ bị lỗi tải. */}
      {slots !== undefined && slots.length === 0 && !designMode && (
        <g>
          <rect
            x={VW / 2 - 190} y={BH / 2 - 34} width="380" height="68" rx="12"
            fill="#fffbeb" stroke="#fcd34d" strokeWidth="1.5"
          />
          <text x={VW / 2} y={BH / 2 - 8} textAnchor="middle" fill="#b45309" fontSize="13" fontWeight="800">
            Bãi này chưa có ô đỗ nào
          </text>
          <text x={VW / 2} y={BH / 2 + 14} textAnchor="middle" fill="#92400e" fontSize="10.5">
            Quản trị cần vào "Quản lý bãi đỗ" để tạo sơ đồ ô cho bãi.
          </text>
        </g>
      )}

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
      <text x="14" y={BH + 20} fill="#64748b" fontSize="9" fontWeight="800" letterSpacing="1.5">
        {designMode
          ? (highlightEmpty ? 'BẤM VÀO Ô TRỐNG ĐỂ CHUYỂN Ô ĐANG CHỌN TỚI ĐÓ' : 'BẤM VÀO Ô ĐỂ CHỌN / THÊM')
          : 'TRẠNG THÁI Ô ĐỖ'}
      </text>

      {(designMode
        ? [
            { color: '#ffffff', stroke: '#3b82f6', label: 'Đã thêm vào bãi', tx: 14 },
            { color: '#ffffff', stroke: '#cbd5e1', label: 'Chưa thêm',       tx: 160, dash: '4,3' },
            ...(highlightEmpty
              ? [{ color: '#fffbeb', stroke: '#f59e0b', label: 'Đích có thể chuyển tới', tx: 268, dash: '4,3' }]
              : []),
          ]
        : [
        { color: '#ffffff', stroke: '#3b82f6', label: 'Trống',      tx: 14 },
        { color: '#ecfdf5', stroke: '#10b981', label: 'Đang đỗ',    tx: 106 },
        { color: '#fffbeb', stroke: '#fbbf24', label: 'Chờ duyệt',  tx: 210, dash: '4,3' },
        { color: '#fef3c7', stroke: '#f59e0b', label: 'Đã đặt',     tx: 320 },
        { color: '#fdf2f8', stroke: '#ec4899', label: 'Xe tháng',   tx: 420 },
        { color: '#fef2f2', stroke: '#ef4444', label: 'Sửa chữa',   tx: 524 },
        ...(interactive
          ? [{ color: issueMode ? '#f97316' : '#2563eb', stroke: issueMode ? '#c2410c' : '#1d4ed8', label: 'Đã chọn', tx: 628 }]
          : []),
      ]).map((item) => (
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
