import { useState, useMemo, type ReactNode } from 'react';
import { Calendar, Download, FileText, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import type { Payment } from '../../data/mockData';

type TimeTab = '7days' | 'month' | 'custom';

interface DailyRow {
  date: string;
  vehicleType: string;
  enter: number;
  exit: number;
  revenue: number;
  trend: 'up' | 'stable' | 'down';
}

const ALL_ROWS: DailyRow[] = [
  { date: '20/06/2024', vehicleType: 'Xe máy',       enter: 245, exit: 238, revenue: 1225000, trend: 'up'     },
  { date: '19/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 89,  exit: 85,  revenue: 2225000, trend: 'stable' },
  { date: '18/06/2024', vehicleType: 'Xe máy',       enter: 212, exit: 205, revenue: 1060000, trend: 'up'     },
  { date: '17/06/2024', vehicleType: 'Xe tải',        enter: 34,  exit: 32,  revenue: 1700000, trend: 'down'   },
  { date: '16/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 102, exit: 100, revenue: 2550000, trend: 'stable' },
  { date: '15/06/2024', vehicleType: 'Xe máy',       enter: 198, exit: 191, revenue: 990000,  trend: 'down'   },
  { date: '14/06/2024', vehicleType: 'Xe đạp',       enter: 67,  exit: 65,  revenue: 134000,  trend: 'stable' },
  { date: '13/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 78,  exit: 76,  revenue: 1950000, trend: 'up'     },
  { date: '12/06/2024', vehicleType: 'Xe máy',       enter: 260, exit: 255, revenue: 1300000, trend: 'up'     },
  { date: '11/06/2024', vehicleType: 'Xe tải',        enter: 29,  exit: 28,  revenue: 1450000, trend: 'stable' },
  { date: '10/06/2024', vehicleType: 'Xe máy',       enter: 185, exit: 180, revenue: 925000,  trend: 'down'   },
  { date: '09/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 95,  exit: 92,  revenue: 2375000, trend: 'stable' },
  { date: '08/06/2024', vehicleType: 'Xe đạp',       enter: 80,  exit: 77,  revenue: 160000,  trend: 'up'     },
  { date: '07/06/2024', vehicleType: 'Xe máy',       enter: 220, exit: 215, revenue: 1100000, trend: 'stable' },
  { date: '06/06/2024', vehicleType: 'Xe tải',        enter: 40,  exit: 38,  revenue: 2000000, trend: 'up'     },
  { date: '05/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 110, exit: 108, revenue: 2750000, trend: 'up'     },
  { date: '04/06/2024', vehicleType: 'Xe máy',       enter: 175, exit: 170, revenue: 875000,  trend: 'down'   },
  { date: '03/06/2024', vehicleType: 'Xe đạp',       enter: 55,  exit: 53,  revenue: 110000,  trend: 'stable' },
  { date: '02/06/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 88,  exit: 85,  revenue: 2200000, trend: 'stable' },
  { date: '01/06/2024', vehicleType: 'Xe máy',       enter: 230, exit: 225, revenue: 1150000, trend: 'up'     },
  { date: '31/05/2024', vehicleType: 'Xe tải',        enter: 38,  exit: 36,  revenue: 1900000, trend: 'down'   },
  { date: '30/05/2024', vehicleType: 'Xe máy',       enter: 195, exit: 190, revenue: 975000,  trend: 'stable' },
  { date: '29/05/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 92,  exit: 90,  revenue: 2300000, trend: 'up'     },
  { date: '28/05/2024', vehicleType: 'Xe đạp',       enter: 73,  exit: 71,  revenue: 146000,  trend: 'stable' },
  { date: '27/05/2024', vehicleType: 'Xe máy',       enter: 205, exit: 200, revenue: 1025000, trend: 'up'     },
  { date: '26/05/2024', vehicleType: 'Xe tải',        enter: 31,  exit: 30,  revenue: 1550000, trend: 'stable' },
  { date: '25/05/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 99,  exit: 97,  revenue: 2475000, trend: 'down'   },
  { date: '24/05/2024', vehicleType: 'Xe máy',       enter: 240, exit: 233, revenue: 1200000, trend: 'up'     },
  { date: '23/05/2024', vehicleType: 'Xe đạp',       enter: 60,  exit: 58,  revenue: 120000,  trend: 'stable' },
  { date: '22/05/2024', vehicleType: 'Ô tô 4-7 chỗ', enter: 105, exit: 103, revenue: 2625000, trend: 'up'     },
];

const PAGE_SIZE = 7;

const TREND_BADGE: Record<DailyRow['trend'], { label: string; cls: string; icon: ReactNode }> = {
  up:     { label: 'Tăng trưởng', cls: 'bg-green-100 text-green-700', icon: <TrendingUp   className="h-3 w-3" /> },
  stable: { label: 'Ổn định',     cls: 'bg-blue-50  text-blue-600',   icon: <Minus        className="h-3 w-3" /> },
  down:   { label: 'Giảm nhẹ',    cls: 'bg-red-50   text-red-600',    icon: <TrendingDown className="h-3 w-3" /> },
};

function fmtVND(n: number) {
  return n.toLocaleString('vi-VN') + ' VNĐ';
}

const TIME_TABS: { key: TimeTab; label: string }[] = [
  { key: '7days',  label: '7 ngày qua' },
  { key: 'month',  label: 'Tháng này'  },
  { key: 'custom', label: 'Tùy chỉnh'  },
];

export default function ManagerReports({ payments = [] }: { payments?: Payment[] }) {
  const [activeTab, setActiveTab]         = useState<TimeTab>('7days');
  const [page, setPage]                   = useState(1);
  const [filterLot, setFilterLot]         = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  // Compute real rows from actual paid payments
  const realRows = useMemo((): DailyRow[] => {
    const paidPayments = payments.filter((p) => p.status === 'Paid');
    if (paidPayments.length === 0) return [];

    const byDate = new Map<string, { revenue: number; count: number }>();
    for (const p of paidPayments) {
      const raw = (p.paidAt || p.createdAt || '').slice(0, 10);
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      const cur = byDate.get(key) ?? { revenue: 0, count: 0 };
      byDate.set(key, { revenue: cur.revenue + (p.totalAmount || 0), count: cur.count + 1 });
    }

    const entries = Array.from(byDate.entries()).sort((a, b) => {
      const parse = (s: string) => { const [dd, mm, yyyy] = s.split('/').map(Number); return new Date(yyyy, mm-1, dd).getTime(); };
      return parse(b[0]) - parse(a[0]);
    });

    return entries.map(([date, { revenue, count }], i) => {
      const prevRevenue = entries[i + 1]?.[1].revenue ?? revenue;
      const trend: DailyRow['trend'] = revenue > prevRevenue * 1.05 ? 'up' : revenue < prevRevenue * 0.95 ? 'down' : 'stable';
      return { date, vehicleType: 'Tất cả', enter: count, exit: count, revenue, trend };
    });
  }, [payments]);

  const useRealData = realRows.length > 0;

  const filtered = (useRealData ? realRows : ALL_ROWS).filter((r) => {
    if (!useRealData && filterVehicle && r.vehicleType !== filterVehicle) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalEnter   = filtered.reduce((s, r) => s + r.enter,   0);
  const totalExit    = filtered.reduce((s, r) => s + r.exit,    0);
  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0);

  const visiblePages = Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 space-y-6">

      {/* Header + time tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo Vận hành &amp; Doanh thu</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi hiệu suất và doanh thu toàn hệ thống bãi đỗ xe</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TIME_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === t.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.key === 'custom' && <Calendar className="h-3.5 w-3.5" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tổng doanh thu</p>
            {useRealData
              ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">Thực tế</span>
              : <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700"><TrendingUp className="h-3 w-3" />+12%</span>
            }
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {useRealData ? totalRevenue.toLocaleString('vi-VN') : '150.000.000'}
          </p>
          <p className="text-xs text-slate-500">VND</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tổng lượt xe</p>
            {useRealData
              ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">Thực tế</span>
              : <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700"><TrendingUp className="h-3 w-3" />+8%</span>
            }
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {useRealData ? totalEnter.toLocaleString('vi-VN') : '5.432'}
          </p>
          <p className="text-xs text-slate-500">lượt</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tỷ lệ lấp đầy TB</p>
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
              <TrendingDown className="h-3 w-3" />-2%
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">82%</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[82%] rounded-full bg-blue-600" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Thời gian đỗ TB</p>
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
              <Minus className="h-3 w-3" />Ổn định
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">2h 45m</p>
          <p className="text-xs text-slate-500">trung bình / lượt</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {[
          { value: filterLot,     setter: setFilterLot,     label: 'Tất cả bãi đỗ', opts: [['central','ParkFlow Central'],['thuduc','ParkFlow Thủ Đức'],['quan9','ParkFlow Quận 9']] },
          { value: filterVehicle, setter: setFilterVehicle, label: 'Tất cả loại xe', opts: [['Xe đạp','Xe đạp'],['Xe máy','Xe máy'],['Ô tô 4-7 chỗ','Ô tô 4-7 chỗ'],['Xe tải','Xe tải']] },
          { value: filterPayment, setter: setFilterPayment, label: 'Tất cả thanh toán', opts: [['cash','Tiền mặt'],['card','Thẻ ngân hàng'],['wallet','Ví điện tử']] },
        ].map((f, i) => (
          <div key={i} className="relative">
            <select
              value={f.value}
              onChange={(e) => { f.setter(e.target.value); setPage(1); }}
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">{f.label}</option>
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition">
            <Download className="h-3.5 w-3.5" />Xuất file Excel
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
            <FileText className="h-3.5 w-3.5" />Tải bản PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Chi tiết vận hành hàng ngày</h2>
          {useRealData
            ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">Dữ liệu thực tế từ DB</span>
            : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">Dữ liệu mẫu — chưa có thanh toán</span>
          }
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {['Ngày', 'Loại xe', 'Số lượt vào', 'Số lượt ra', 'Doanh thu (VNĐ)', 'Tình trạng'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const trend = TREND_BADGE[row.trend];
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{row.date}</td>
                    <td className="px-5 py-3.5 text-slate-600">{row.vehicleType}</td>
                    <td className="px-5 py-3.5 text-slate-700">{row.enter.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-3.5 text-slate-700">{row.exit.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">{fmtVND(row.revenue)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${trend.cls}`}>
                        {trend.icon}{trend.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="border-t-2 border-blue-100 bg-blue-50/40">
                <td colSpan={2} className="px-5 py-3.5 text-sm font-bold text-blue-700">TỔNG CỘNG</td>
                <td className="px-5 py-3.5 font-bold text-blue-700">{totalEnter.toLocaleString('vi-VN')}</td>
                <td className="px-5 py-3.5 font-bold text-blue-700">{totalExit.toLocaleString('vi-VN')}</td>
                <td className="px-5 py-3.5 font-bold text-blue-700">{fmtVND(totalRevenue)}</td>
                <td className="px-5 py-3.5" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-500">
            Hiển thị {Math.min(PAGE_SIZE, filtered.length - (page - 1) * PAGE_SIZE)} trong tổng số{' '}
            <span className="font-semibold text-slate-700">{filtered.length} ngày</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {visiblePages.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                  page === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
            {totalPages > 3 && <span className="px-1 text-slate-400">…</span>}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        © 2024 ParkFlow Manager — Hệ thống quản lý vận hành bãi xe thông minh
      </p>
    </div>
  );
}
