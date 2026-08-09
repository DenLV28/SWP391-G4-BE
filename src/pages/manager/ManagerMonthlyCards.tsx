import React, { useMemo, useState } from 'react';
import { CalendarCheck, Search, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Reservation, User, VehicleKey } from '../../data/mockData';
import { addOneMonth } from '../../utils/reservationPricing';
import ConfirmModal from '../../components/ConfirmModal';

interface Props {
  reservations: Reservation[];
  users: User[];
  /** Hủy thẻ tháng — thao tác CHỈ Quản lý được làm (nhân viên bị backend chặn). */
  onCancelCard?: (reservationId: string) => void;
}

const VEHICLE_LABEL: Record<VehicleKey, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)',
  motorbike: 'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

const RES_STATUS_LABEL: Record<Reservation['status'], string> = {
  Pending: 'Chờ xác nhận',
  Confirmed: 'Đã xác nhận',
  'Checked-in': 'Đang đỗ trong bãi',
  Completed: 'Đã hoàn tất',
  Cancelled: 'Đã hủy',
  Expired: 'Hết hạn (không tới)',
};

type CardStatus = 'active' | 'expiring' | 'expired' | 'cancelled';

const CARD_STATUS_META: Record<CardStatus, { label: string; cls: string; icon: React.ElementType }> = {
  active:    { label: 'Còn hiệu lực',   cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  expiring:  { label: 'Sắp hết hạn',    cls: 'bg-amber-100  text-amber-700',    icon: Clock },
  expired:   { label: 'Đã hết hạn',     cls: 'bg-slate-100  text-slate-500',    icon: XCircle },
  cancelled: { label: 'Đã hủy',         cls: 'bg-rose-100   text-rose-700',     icon: XCircle },
};

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export default function ManagerMonthlyCards({ reservations, users, onCancelCard }: Props) {
  const [filter, setFilter] = useState<'all' | CardStatus>('all');
  const [query, setQuery] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.fullName));
    return map;
  }, [users]);

  const rows = useMemo(() => {
    const today = todayLocal();
    return reservations
      .filter((r) => r.note === 'Theo tháng')
      .map((r) => {
        const start = r.date.split('T')[0];
        const end = addOneMonth(start);
        const daysLeft = daysBetween(today, end);
        let cardStatus: CardStatus;
        if (r.status === 'Cancelled' || r.status === 'Expired') cardStatus = 'cancelled';
        else if (daysLeft < 0) cardStatus = 'expired';
        else if (daysLeft <= 7) cardStatus = 'expiring';
        else cardStatus = 'active';
        return {
          reservation: r,
          ownerName: userNameById.get(r.userId) || '—',
          start,
          end,
          daysLeft,
          cardStatus,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [reservations, userNameById]);

  const counts = useMemo(() => {
    const c: Record<CardStatus, number> = { active: 0, expiring: 0, expired: 0, cancelled: 0 };
    rows.forEach((row) => { c[row.cardStatus] += 1; });
    return c;
  }, [rows]);

  const filtered = rows.filter((row) => {
    if (filter !== 'all' && row.cardStatus !== filter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      row.reservation.licensePlate.toLowerCase().includes(q) ||
      row.ownerName.toLowerCase().includes(q) ||
      row.reservation.reservationCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Xe đăng ký Thẻ tháng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Danh sách toàn bộ xe đang gửi theo tháng — theo dõi hạn sử dụng thẻ và nhắc khách gia hạn.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([
          { key: 'all' as const, label: 'Tổng số thẻ', value: rows.length, cls: 'text-slate-800' },
          { key: 'active' as const, label: CARD_STATUS_META.active.label, value: counts.active, cls: 'text-emerald-600' },
          { key: 'expiring' as const, label: CARD_STATUS_META.expiring.label, value: counts.expiring, cls: 'text-amber-600' },
          { key: 'expired' as const, label: CARD_STATUS_META.expired.label, value: counts.expired, cls: 'text-slate-500' },
        ]).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFilter(card.key)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${
              filter === card.key ? 'border-blue-400 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.cls}`}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'expiring', 'expired', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filter === f ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
              }`}
            >
              {f === 'all' ? 'Tất cả' : CARD_STATUS_META[f].label}
              <span className="ml-1.5 text-[10px] opacity-75">
                ({f === 'all' ? rows.length : counts[f]})
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm biển số, chủ xe, mã đặt chỗ..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-400">
            <CalendarCheck className="h-10 w-10 text-slate-200" />
            <p className="text-sm font-semibold">Không có xe đăng ký thẻ tháng nào khớp bộ lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Mã đặt chỗ</th>
                  <th className="px-4 py-3">Biển số</th>
                  <th className="px-4 py-3">Chủ xe</th>
                  <th className="px-4 py-3">Loại xe</th>
                  <th className="px-4 py-3">Bãi đỗ · Ô</th>
                  <th className="px-4 py-3">Hiệu lực</th>
                  <th className="px-4 py-3">Còn lại</th>
                  <th className="px-4 py-3 text-right">Giá tháng</th>
                  <th className="px-4 py-3">Trạng thái đặt chỗ</th>
                  <th className="px-4 py-3">Trạng thái thẻ</th>
                  {onCancelCard && <th className="px-4 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(({ reservation: r, ownerName, start, end, daysLeft, cardStatus }) => {
                  const meta = CARD_STATUS_META[cardStatus];
                  const StatusIcon = meta.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{r.reservationCode}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.licensePlate}</td>
                      <td className="px-4 py-3 text-slate-600">{ownerName}</td>
                      <td className="px-4 py-3 text-slate-600">{VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.parkingLot || '—'}
                        {r.slotCode && <span className="block text-[10px] text-slate-400">{r.slotCode}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {start} → {end}
                      </td>
                      <td className="px-4 py-3">
                        {cardStatus === 'cancelled' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={daysLeft < 0 ? 'font-bold text-rose-600' : daysLeft <= 7 ? 'font-bold text-amber-600' : 'text-slate-600'}>
                            {daysLeft < 0 ? `Quá hạn ${Math.abs(daysLeft)} ngày` : `${daysLeft} ngày`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {(r.estimatedCost ?? 0).toLocaleString('vi-VN')}đ
                      </td>
                      <td className="px-4 py-3 text-slate-600">{RES_STATUS_LABEL[r.status]}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.cls}`}>
                          <StatusIcon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                      {onCancelCard && (
                        <td className="px-4 py-3 text-right">
                          {/* Thẻ đã hủy/hết hạn thì không còn gì để chấm dứt. */}
                          {cardStatus === 'cancelled' || cardStatus === 'expired' ? (
                            <span className="text-[11px] text-slate-300">—</span>
                          ) : (
                            <button
                              onClick={() => setCancelTarget(r)}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                            >
                              Hủy thẻ
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={cancelTarget !== null}
        title="Hủy thẻ tháng của khách?"
        message={
          cancelTarget
            ? `Thẻ ${cancelTarget.reservationCode} — xe ${cancelTarget.licensePlate}, ô ${cancelTarget.slotCode || '—'} tại ${cancelTarget.parkingLot || '—'} sẽ bị chấm dứt. Ô đỗ được trả lại cho bãi và khách nhận thông báo. Khoản đã thanh toán cho tháng này KHÔNG tự động hoàn lại.`
            : ''
        }
        onConfirm={() => {
          if (cancelTarget) onCancelCard?.(cancelTarget.id);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />

      {counts.expiring > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Có <strong>{counts.expiring}</strong> thẻ tháng sắp hết hạn trong vòng 7 ngày tới — nên chủ động nhắc khách gia hạn để tránh gián đoạn.
          </span>
        </div>
      )}
    </div>
  );
}
