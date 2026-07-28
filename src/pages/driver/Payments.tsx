import React, { useMemo, useState } from 'react';
import { Receipt, X, Trash2, FileText, Printer, Ban } from 'lucide-react';
import { Payment, Reservation } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SectionTitle from '../../components/SectionTitle';
import { createVNPayPayment } from '../../services/vnpayService';
import { isPaymentVoided } from '../../utils/reservationPricing';

export default function Payments({
  payments,
  reservations = [],
  onClearPaid,
}: {
  payments: Payment[];
  /** Dùng để phát hiện hóa đơn Unpaid mồ côi — đặt chỗ/lượt gửi gắn với nó đã
   *  bị hủy hoặc không còn tồn tại, nên không cho thanh toán tiếp nữa. */
  reservations?: Reservation[];
  onClearPaid?: () => void;
}) {
  const [filter, setFilter] = useState<'Tất cả' | 'Paid' | 'Unpaid' | 'Failed'>('Tất cả');
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeQR, setActiveQR] = useState<Payment | null>(null);
  const [loadingVNPay, setLoadingVNPay] = useState<string | null>(null);
  const [invoicePayment, setInvoicePayment] = useState<Payment | null>(null);

  // Hóa đơn coi là "đã hủy thanh toán" khi: backend đã đánh dấu Failed, HOẶC
  // còn Unpaid nhưng đặt chỗ liên quan (theo reservationCode/ticketCode) đã bị
  // hủy/hết hạn hoặc không còn tồn tại nữa (vd. hủy ngay sau khi vừa đặt) —
  // hóa đơn đó không còn ý nghĩa gì, không nên cho bấm thanh toán tiếp.
  const voidedIds = useMemo(() => {
    const ids = new Set<string>();
    payments.forEach((p) => {
      if (isPaymentVoided(p, reservations)) ids.add(p.id);
    });
    return ids;
  }, [payments, reservations]);

  const filtered = payments.filter((payment) => {
    if (filter === 'Tất cả') return true;
    if (filter === 'Failed') return payment.status === 'Failed' || voidedIds.has(payment.id);
    if (filter === 'Unpaid') return payment.status === 'Unpaid' && !voidedIds.has(payment.id);
    return payment.status === filter;
  });

  const handlePayVNPay = async (payment: Payment) => {
    if (!payment.totalAmount || payment.totalAmount <= 0) {
      alert('Hóa đơn có số tiền 0đ, không cần thanh toán qua VNPay.');
      return;
    }
    try {
      setLoadingVNPay(payment.id);
      const url = await createVNPayPayment(payment.id, payment.totalAmount, `Thanh toan phi giu xe ${payment.id}`);
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể kết nối VNPay. Vui lòng thử lại.');
    } finally {
      setLoadingVNPay(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Thanh toán" subtitle="Theo dõi phí, xử lý hóa đơn còn nợ và xem lịch sử thanh toán" />

      <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
        <div className="flex gap-2">
          {(['Tất cả', 'Paid', 'Unpaid', 'Failed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-4 py-2 font-bold transition ${filter === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab === 'Tất cả' ? 'Tất cả' : tab === 'Paid' ? 'Đã thanh toán' : tab === 'Unpaid' ? 'Chưa thanh toán' : 'Thanh toán lỗi'}
            </button>
          ))}
        </div>

        {onClearPaid && payments.some((p) => p.status === 'Paid') && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Xác nhận xóa?</span>
              <button
                onClick={() => { onClearPaid(); setConfirmClear(false); }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white transition hover:bg-rose-500"
              >
                Xóa
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa lịch sử
            </button>
          )
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {filtered.map((payment) => (
            <div key={payment.id} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 text-xs shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <span className="block text-[9px] font-bold uppercase text-slate-400">Mã hóa đơn / vé xe</span>
                  <span className="text-sm font-bold text-slate-800">{payment.id} ({payment.ticketCode})</span>
                  {payment.licensePlate && (
                    <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                      Biển số: <span className="font-bold text-slate-700">{payment.licensePlate}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInvoicePayment(payment)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                    title="Xem hóa đơn"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Hóa đơn
                  </button>
                  <StatusBadge status={voidedIds.has(payment.id) ? 'Cancelled' : payment.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 border-b border-slate-50 pb-3 text-slate-500">
                <Row label="Phí gửi xe" value={payment.parkingFee} />
                <Row label="Phí dịch vụ" value={payment.extraServiceFee} />
                <Row label="Phí mất thẻ" value={payment.lostTicketFee} />
                {payment.overtimeFee !== undefined && payment.overtimeFee > 0 && <Row label="Phí quá giờ" value={payment.overtimeFee} tone="rose" />}
                <div className="flex justify-between text-[13px] font-bold text-blue-600">
                  <span>Tổng tiền</span>
                  <span>{formatMoney(payment.totalAmount)}</span>
                </div>
              </div>

              {voidedIds.has(payment.id) ? (
                /* Đã hủy thanh toán — đặt chỗ/lượt gửi liên quan đã bị hủy
                   hoặc không còn tồn tại, không cho thanh toán tiếp nữa */
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 pt-3">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-600">Đã hủy thanh toán</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Đặt chỗ liên quan đến hóa đơn này đã bị hủy hoặc không còn tồn tại — hóa đơn không còn hiệu lực, bạn không cần thanh toán.
                    </p>
                  </div>
                </div>
              ) : payment.status === 'Unpaid' ? (
                payment.totalAmount <= 0 ? (
                  /* Xe đang trong bãi, chưa tính phí */
                  <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 pt-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-[11px] font-bold text-amber-700">Xe đang trong bãi</p>
                      <p className="mt-0.5 text-[10px] text-amber-600">
                        Phí gửi xe sẽ được tính tự động khi xe ra cổng. Hóa đơn sẽ cập nhật số tiền sau khi check-out.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Đã có phí, cho phép thanh toán — luôn qua VNPay */
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-700">
                      <span>💳</span>
                      <span>Bạn sẽ được chuyển đến cổng thanh toán VNPay để hoàn tất giao dịch an toàn.</span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handlePayVNPay(payment)}
                        disabled={loadingVNPay === payment.id}
                        className="shrink-0 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
                      >
                        {loadingVNPay === payment.id ? 'Đang chuyển hướng...' : 'Xác nhận thanh toán'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] text-slate-400">
                  <div className="flex flex-col gap-1">
                    <span>
                      Phương thức: <strong className="text-slate-600">{payment.method || 'Chưa ghi nhận'}</strong>
                    </span>
                    {payment.paidAt && (
                      <span>
                        Đã thanh toán lúc: <strong className="text-slate-600">{payment.paidAt}</strong>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveQR(payment)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Xem QR ra cổng
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Receipt} title="Chưa có hóa đơn nào" description="Khi thanh toán hoàn tất, các hóa đơn phù hợp bộ lọc sẽ hiển thị tại đây." />
      )}

      {activeQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xs space-y-5 rounded-2xl bg-white p-6 text-center shadow-xl">
            <button
              onClick={() => setActiveQR(null)}
              className="absolute right-4 top-4 cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-emerald-600">Thẻ ra cổng hợp lệ</span>
              <h4 className="mt-0.5 text-base font-extrabold text-slate-800">{activeQR.ticketCode}</h4>
            </div>

            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-800">
              <div className="space-y-1.5 p-2">
                <span className="block font-mono text-[9px] font-bold uppercase text-emerald-600">Mã QR hợp lệ</span>
                <div className="mx-auto my-2 h-12 w-12 rounded-md border-2 border-current opacity-80" />
                <span className="block font-mono text-xs font-bold">{activeQR.id}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-4 text-left text-[11px] text-slate-500">
              <Row label="Thời gian thanh toán" value={activeQR.paidAt || 'Chưa có'} />
              <Row label="Hiệu lực đến" value={getExpiryText(activeQR.paidAt)} tone="rose" />
            </div>

            <div className="flex gap-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-left text-[10px] font-medium text-rose-700">
              <p>
                Bạn có đúng <strong>15 phút</strong> để quét mã QR này tại barie ra cổng. Quá thời gian sẽ phát sinh phí quá giờ.
              </p>
            </div>
          </div>
        </div>
      )}

      {invoicePayment && (
        <InvoiceModal payment={invoicePayment} onClose={() => setInvoicePayment(null)} />
      )}
    </div>
  );
}

function InvoiceModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const additionalFee = (payment.extraServiceFee || 0) + (payment.lostTicketFee || 0) + (payment.overtimeFee || 0);
  const discount = payment.discount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-100">ParkFlow</p>
                <h3 className="text-lg font-bold">Hóa đơn thanh toán</h3>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 text-white/70 hover:bg-white/20 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Booking info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã đặt chỗ</p>
              <p className="mt-1 text-sm font-bold text-slate-800 font-mono">{payment.ticketCode || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Biển số xe</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{payment.licensePlate || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày tạo hóa đơn</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{payment.createdAt || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thanh toán lúc</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{payment.paidAt || 'Chưa thanh toán'}</p>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
            <InvRow label="Phí gửi xe" value={payment.parkingFee} />
            {payment.extraServiceFee > 0 && <InvRow label="Phí dịch vụ thêm" value={payment.extraServiceFee} />}
            {payment.lostTicketFee > 0 && <InvRow label="Phí mất thẻ" value={payment.lostTicketFee} />}
            {(payment.overtimeFee ?? 0) > 0 && <InvRow label="Phí quá giờ" value={payment.overtimeFee!} tone="rose" />}
            {additionalFee > 0 && <InvRow label="Tổng phí phát sinh" value={additionalFee} tone="amber" />}
            {discount > 0 && <InvRow label="Giảm giá" value={-discount} tone="green" />}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
              <span className="text-sm font-bold text-blue-800">Tổng thanh toán</span>
              <span className="text-lg font-black text-blue-700">{formatMoney(payment.totalAmount)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold text-slate-500">Trạng thái thanh toán</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700'
              : payment.status === 'Failed' ? 'bg-rose-100 text-rose-700'
              : 'bg-amber-100 text-amber-700'
            }`}>
              {payment.status === 'Paid' ? 'Đã thanh toán' : payment.status === 'Failed' ? 'Thất bại' : 'Chưa thanh toán'}
            </span>
          </div>

          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" />
            In hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}

function InvRow({ label, value, tone }: { label: string; value: number; tone?: 'rose' | 'amber' | 'green' }) {
  const color = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-700';
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{formatMoney(Math.abs(value))}{value < 0 ? ' (giảm)' : ''}</span>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function Row({ label, value, tone }: { label: string; value: number | string; tone?: 'rose' }) {
  return (
    <div className={`flex justify-between ${tone === 'rose' ? 'font-bold text-rose-600' : ''}`}>
      <span>{label}:</span>
      <span className="font-bold text-slate-700">{typeof value === 'number' ? formatMoney(value) : value}</span>
    </div>
  );
}

function getExpiryText(paidAt?: string) {
  if (!paidAt) return 'Không xác định';
  const [datePart, timePart] = paidAt.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hrs, mins] = timePart.split(':').map(Number);
  const expiry = new Date(year, month - 1, day, hrs, mins + 15);
  const yyyy = expiry.getFullYear();
  const mm = String(expiry.getMonth() + 1).padStart(2, '0');
  const dd = String(expiry.getDate()).padStart(2, '0');
  const hh = String(expiry.getHours()).padStart(2, '0');
  const mi = String(expiry.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
