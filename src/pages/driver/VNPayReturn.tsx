import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, ParkingSquare } from 'lucide-react';

type ReturnStatus = 'success' | 'failed' | 'invalid' | 'error' | null;

export type VNPayCheckoutContext = {
  paymentId: string;
  sessionId: string;
  ticketCode: string;
  amount: number;
};

/** Đặt chỗ theo tháng chờ tạo — lưu tạm lúc chuyển sang VNPay, chỉ trở thành
 *  đặt chỗ thật trong DB sau khi thanh toán thành công (xem App.tsx). */
export type PendingMonthlyBooking = {
  reservationCode: string;
  reservationType: 'Fixed-time' | 'Flexible';
  slotAssignmentMode: 'Auto' | 'Manual';
  /** Ô khách đã bấm chọn trên sơ đồ — phải giữ qua vòng thanh toán VNPay. */
  slotCode?: string;
  vehicleType: string;
  licensePlate: string;
  date: string;
  startTime: string;
  endTime?: string;
  floor: string;
  area: string;
  note: string;
  estimatedCost: number;
  parkingLot: string;
};

interface VNPayReturnProps {
  onPaymentSuccess: (paymentId: string, ctx: VNPayCheckoutContext | null) => void;
  /** Gói tháng: thanh toán vừa thành công → tạo đặt chỗ thật ngay bây giờ. */
  onMonthlyBookingPaid?: (paymentId: string, booking: PendingMonthlyBooking) => void;
  setView: (view: string) => void;
}

export default function VNPayReturn({ onPaymentSuccess, onMonthlyBookingPaid, setView }: VNPayReturnProps) {
  const [status, setStatus] = useState<ReturnStatus>(null);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(0);
  const [isSessionCheckout, setIsSessionCheckout] = useState(false);
  const [isMonthlyBooking, setIsMonthlyBooking] = useState(false);
  const successCalled = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);

    const s = params.get('status') as ReturnStatus;
    const pid = params.get('paymentId') || '';
    const amt = Number(params.get('amount') || '0');

    setStatus(s);
    setPaymentId(pid);
    setAmount(amt);

    if (s === 'success' && pid && !successCalled.current) {
      successCalled.current = true;
      let ctx: VNPayCheckoutContext | null = null;
      try {
        const raw = localStorage.getItem('pf_vnpay_ctx');
        if (raw) { ctx = JSON.parse(raw) as VNPayCheckoutContext; localStorage.removeItem('pf_vnpay_ctx'); }
      } catch { /* ignore */ }
      setIsSessionCheckout(!!ctx?.sessionId);

      let pendingMonthly: { paymentId: string; booking: PendingMonthlyBooking } | null = null;
      try {
        const raw = localStorage.getItem('pf_pending_monthly_booking');
        if (raw) {
          const parsed = JSON.parse(raw) as { paymentId: string; booking: PendingMonthlyBooking };
          if (parsed.paymentId === pid) pendingMonthly = parsed;
          localStorage.removeItem('pf_pending_monthly_booking');
        }
      } catch { /* ignore */ }

      if (pendingMonthly) {
        setIsMonthlyBooking(true);
        onMonthlyBookingPaid?.(pid, pendingMonthly.booking);
      } else {
        onPaymentSuccess(pid, ctx);
      }
    }
  }, []);

  const goToPayments = () => {
    window.location.hash = '#/payments';
    setView('payments');
  };

  // Trang "Lượt gửi hiện tại" của user đã chuyển thành "Theo dõi bãi xe" phía
  // staff — sau thanh toán, đưa khách về lịch sử thanh toán.
  const goToSession = () => {
    window.location.hash = '#/payments';
    setView('payments');
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-lg text-center">

        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Thanh toán thành công!</h2>
              {paymentId && (
                <p className="mt-1 text-sm text-slate-500">
                  Mã hóa đơn: <strong className="text-slate-700">{paymentId}</strong>
                </p>
              )}
              {amount > 0 && (
                <p className="mt-1 text-sm text-slate-500">
                  Số tiền: <strong className="text-emerald-600">{amount.toLocaleString('vi-VN')}đ</strong>
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isMonthlyBooking
                ? 'Giao dịch VNPay hoàn tất. Đặt chỗ gửi xe theo tháng của bạn đã được tạo — xem chi tiết trong mục Đặt chỗ.'
                : (<>Giao dịch VNPay hoàn tất. Lượt gửi xe đã <strong>kết thúc</strong>, ô đỗ đã <strong>được giải phóng</strong> và barie đã mở. Bạn có thể xem lịch sử trong mục Thanh toán.</>)}
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-rose-500" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Thanh toán thất bại</h2>
              <p className="mt-1 text-sm text-slate-500">
                Giao dịch không thành công. Vui lòng kiểm tra lại thông tin thẻ hoặc chọn phương thức khác.
              </p>
            </div>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertCircle className="mx-auto h-16 w-16 text-amber-400" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Xảy ra lỗi</h2>
              <p className="mt-1 text-sm text-slate-500">
                {status === 'invalid'
                  ? 'Chữ ký thanh toán không hợp lệ. Vui lòng thử lại hoặc liên hệ hỗ trợ.'
                  : 'Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.'}
              </p>
            </div>
          </>
        )}

        {status === null && (
          <>
            <AlertCircle className="mx-auto h-16 w-16 text-slate-300" />
            <h2 className="text-xl font-extrabold text-slate-800">Đang xử lý kết quả...</h2>
          </>
        )}

        {status === 'success' && isMonthlyBooking ? (
          <button
            onClick={() => { window.location.hash = '#/reservations'; setView('reservations'); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-500"
          >
            <ParkingSquare className="h-4 w-4" />
            Xem đặt chỗ của tôi
          </button>
        ) : status === 'success' && isSessionCheckout ? (
          <button
            onClick={goToSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-500"
          >
            <ParkingSquare className="h-4 w-4" />
            Xem lịch sử thanh toán
          </button>
        ) : (
          <button
            onClick={goToPayments}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay về trang Thanh toán
          </button>
        )}
      </div>
    </div>
  );
}
