import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

type ReturnStatus = 'success' | 'failed' | 'invalid' | 'error' | null;

export type VNPayCheckoutContext = {
  paymentId: string;
  sessionId: string;
  ticketCode: string;
  amount: number;
};

interface VNPayReturnProps {
  onPaymentSuccess: (paymentId: string, ctx: VNPayCheckoutContext | null) => void;
  setView: (view: string) => void;
}

export default function VNPayReturn({ onPaymentSuccess, setView }: VNPayReturnProps) {
  const [status, setStatus] = useState<ReturnStatus>(null);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(0);
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
      onPaymentSuccess(pid, ctx);
    }
  }, []);

  const goToPayments = () => {
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
              Giao dịch VNPay hoàn tất. Lượt gửi xe đã <strong>kết thúc</strong>, ô đỗ đã <strong>được giải phóng</strong> và barie đã mở. Bạn có thể xem lịch sử trong mục Thanh toán.
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

        <button
          onClick={goToPayments}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay về trang Thanh toán
        </button>
      </div>
    </div>
  );
}
