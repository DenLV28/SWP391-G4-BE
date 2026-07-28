import { useState } from 'react';
import { Wallet, Clock, Receipt, ChevronDown } from 'lucide-react';
import type { Payment } from '../data/mockData';
import { formatCurrency, localDateISO } from '../utils/helpers';

interface Props {
  payments: Payment[];
  /** Cap how many recent transactions to list below the totals. */
  recentLimit?: number;
}

const money = (n: number) => formatCurrency(n).replace('₫', 'đ');

function paymentTime(p: Payment): string {
  return p.paidAt || p.createdAt || '';
}

/**
 * Staff/Manager wallet widget: total money collected from paid transactions,
 * today's total, and a feed of "who paid how much and when" for the most
 * recent transactions — doubles as the payment notification list.
 */
export default function PaymentWalletCard({ payments, recentLimit = 6 }: Props) {
  const [showRecent, setShowRecent] = useState(true);
  const paid = payments.filter((p) => p.status === 'Paid');
  const totalRevenue = paid.reduce((sum, p) => sum + p.totalAmount, 0);

  const todayStr = localDateISO();
  const todayPayments = paid.filter((p) => paymentTime(p).startsWith(todayStr));
  const todayRevenue = todayPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  const recent = [...paid]
    .sort((a, b) => paymentTime(b).localeCompare(paymentTime(a)))
    .slice(0, recentLimit);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Wallet className="h-5 w-5 text-blue-600" /> Ví thu tiền
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Tổng tiền người dùng đã chuyển khoản qua hệ thống</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tổng cộng</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Hôm nay</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{money(todayRevenue)}</p>
          <p className="text-[11px] text-slate-400">{todayPayments.length} giao dịch</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tổng giao dịch</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{paid.length}</p>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-4">
        <button
          onClick={() => setShowRecent((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
        >
          <span className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Giao dịch gần đây
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showRecent ? 'rotate-180' : ''}`} />
        </button>
        {!showRecent ? null : recent.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có giao dịch nào được ghi nhận.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {p.userName || 'Người dùng'}
                    {p.licensePlate ? <span className="ml-1.5 font-mono text-xs text-slate-500">· {p.licensePlate}</span> : null}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" /> {paymentTime(p) || '—'} · {p.method || 'Cash'}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">+{money(p.totalAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
