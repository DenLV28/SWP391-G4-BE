import React, { useState } from 'react';
import { CheckCircle, Copy, X } from 'lucide-react';

const BANK_ID = 'MB';
const ACCOUNT_NO = '0123456789';
const ACCOUNT_NAME = 'CONG TY CP PARKFLOW VN';
const BANK_DISPLAY = 'MB Bank (Quân đội)';

export default function VietQRModal({
  amount,
  description,
  onConfirm,
  onClose,
  onPayLater,
}: {
  amount: number;
  description: string;
  onConfirm: () => void;
  onClose?: () => void;
  onPayLater?: () => void;
}) {
  const [copied, setCopied] = useState<'account' | 'amount' | null>(null);

  const qrUrl =
    `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png` +
    `?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const copy = (text: string, key: 'account' | 'amount') => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            VietQR · Tất cả ngân hàng Việt Nam
          </div>
          <p className="text-2xl font-black text-slate-900">
            {amount.toLocaleString('vi-VN')}đ
          </p>
          <p className="text-[11px] text-slate-500">{description}</p>
        </div>

        {/* QR image from VietQR API */}
        <div className="flex justify-center">
          <div className="rounded-2xl border-2 border-blue-100 bg-white p-2 shadow-inner">
            <img
              src={qrUrl}
              alt="VietQR Payment"
              className="h-52 w-52 object-contain"
            />
          </div>
        </div>

        <p className="text-center text-[10px] font-medium text-slate-400">
          Mở app ngân hàng bất kỳ → Quét mã QR → Xác nhận chuyển khoản
        </p>

        {/* Bank info */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-xs">
          <InfoRow label="Ngân hàng" value={BANK_DISPLAY} />

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Số tài khoản</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-slate-700">{ACCOUNT_NO}</span>
              <button
                type="button"
                onClick={() => copy(ACCOUNT_NO, 'account')}
                className={`rounded p-0.5 transition ${copied === 'account' ? 'text-emerald-600' : 'text-blue-500 hover:bg-blue-50'}`}
              >
                {copied === 'account' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <InfoRow label="Chủ tài khoản" value={ACCOUNT_NAME} />

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Số tiền</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-blue-700">{amount.toLocaleString('vi-VN')}đ</span>
              <button
                type="button"
                onClick={() => copy(String(amount), 'amount')}
                className={`rounded p-0.5 transition ${copied === 'amount' ? 'text-emerald-600' : 'text-blue-500 hover:bg-blue-50'}`}
              >
                {copied === 'amount' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-400 shrink-0">Nội dung CK</span>
            <span className="font-semibold text-blue-700 text-right truncate">{description}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          {onPayLater && (
            <button
              type="button"
              onClick={onPayLater}
              className="w-1/2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Thanh toán sau
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`${onPayLater ? 'w-1/2' : 'w-full'} flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 transition`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Đã chuyển khoản
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="font-semibold text-slate-700 text-right">{value}</span>
    </div>
  );
}
