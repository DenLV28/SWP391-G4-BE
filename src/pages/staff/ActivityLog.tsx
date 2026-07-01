import { useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, Filter, Eye } from 'lucide-react';
import type { AccessLog } from '../../types/staff';

interface ActivityLogProps {
  accessLogs: AccessLog[];
}

type ExtRow = {
  id: string;
  timeHMS: string;
  dateStr: string;
  platePfx: string;
  plateNum: string;
  vehicleType: string;
  direction: 'entry' | 'exit';
  lane: string;
  status: 'ok' | 'err' | 'override';
  statusLabel: string;
  customerType: string;
};

const VEHICLE_TYPES = ['Ô tô (5 chỗ)', 'Xe máy', 'Ô tô (4 chỗ)', 'Xe tải / Giao hàng', 'Xe điện EV', 'Ô tô (7 chỗ)', 'Xe đạp'];
const LANES = ['Cổng Bắc A - Làn 1', 'Cổng Nam B - Làn 2', 'Cổng Đông C - Làn 1', 'Cổng Tây D - Làn 3'];
const CUSTOMER_TYPES = ['Khách tháng', 'Khách vãng lai', 'Khách vãng lai', 'Khách vãng lai'];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildMockRows(realLogs: AccessLog[]): ExtRow[] {
  const staticRows: ExtRow[] = [
    { id: 's1', timeHMS: '14:23:45', dateStr: '24 Th10, 2023', platePfx: 'ABC', plateNum: '8831', vehicleType: 'Ô tô (5 chỗ)', direction: 'entry', lane: 'Cổng Bắc A - Làn 1', status: 'ok', statusLabel: 'Thành công', customerType: 'Khách tháng' },
    { id: 's2', timeHMS: '14:18:22', dateStr: '24 Th10, 2023', platePfx: 'KYZ', plateNum: '4491', vehicleType: 'Xe máy', direction: 'exit', lane: 'Cổng Nam B - Làn 2', status: 'err', statusLabel: 'Lỗi / Thanh toán', customerType: 'Khách vãng lai' },
    { id: 's3', timeHMS: '14:05:10', dateStr: '24 Th10, 2023', platePfx: 'DEF', plateNum: '1102', vehicleType: 'Xe tải / Giao hàng', direction: 'entry', lane: 'Cổng Bắc A - Làn 1', status: 'ok', statusLabel: 'Thành công', customerType: 'Khách vãng lai' },
    { id: 's4', timeHMS: '13:58:33', dateStr: '24 Th10, 2023', platePfx: 'KLP', plateNum: '9082', vehicleType: 'Xe điện EV', direction: 'exit', lane: 'Cổng Nam B - Làn 2', status: 'ok', statusLabel: 'Thành công', customerType: 'Khách vãng lai' },
  ];

  const rand = seedRand(42);
  const extraRows: ExtRow[] = Array.from({ length: 46 }, (_, i) => {
    const r = rand;
    const h = Math.floor(rand() * 14) + 7;
    const m = Math.floor(rand() * 60);
    const s2 = Math.floor(rand() * 60);
    const vehicleType = VEHICLE_TYPES[Math.floor(rand() * VEHICLE_TYPES.length)];
    const lane = LANES[Math.floor(rand() * LANES.length)];
    const ct = CUSTOMER_TYPES[Math.floor(rand() * CUSTOMER_TYPES.length)];
    const dirRand = rand();
    const dir: 'entry' | 'exit' = dirRand > 0.5 ? 'entry' : 'exit';
    const statusRand = rand();
    const status: ExtRow['status'] = statusRand > 0.85 ? 'err' : statusRand > 0.75 ? 'override' : 'ok';
    const statusLabel = status === 'ok' ? 'Thành công' : status === 'err' ? 'Lỗi / Thanh toán' : 'Thủ công';
    const pfxList = ['KSL','TRX','BKP','MNL','XYZ','QRT','VLN','DFG','HJK','PLM'];
    const pfx = pfxList[Math.floor(rand() * pfxList.length)];
    const num = String(Math.floor(rand() * 9000) + 1000);
    return {
      id: `r${i}`,
      timeHMS: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}`,
      dateStr: '24 Th10, 2023',
      platePfx: pfx,
      plateNum: num,
      vehicleType,
      direction: dir,
      lane,
      status,
      statusLabel,
      customerType: ct,
    };
  });

  const realRows: ExtRow[] = realLogs.map((log) => {
    const parts = log.vehicleId.split(' ');
    const pfx = parts[0] ?? log.vehicleId;
    const num = parts.slice(1).join(' ') || '—';
    const ok = log.status === 'GRANTED' || log.status === 'OVERRIDE';
    return {
      id: log.id,
      timeHMS: log.time,
      dateStr: 'Hôm nay',
      platePfx: pfx,
      plateNum: num,
      vehicleType: log.recognition === 'subscriber' ? 'Ô tô (5 chỗ)' : 'Xe máy',
      direction: log.direction,
      lane: `Cổng ${log.gateId} - Làn 1`,
      status: ok ? 'ok' : 'err',
      statusLabel: ok ? 'Thành công' : 'Lỗi / Thanh toán',
      customerType: log.recognition === 'subscriber' ? 'Khách tháng' : 'Khách vãng lai',
    };
  });

  return [...realRows, ...staticRows, ...extraRows];
}

const PAGE_SIZE = 25;

const VEHICLE_FILTER_OPTS = ['Tất cả', 'Ô tô (5 chỗ)', 'Xe máy', 'Ô tô (4 chỗ)', 'Xe tải / Giao hàng', 'Xe điện EV'];
const ACTION_FILTER_OPTS  = ['Tất cả', 'VÀO', 'RA'];
const GATE_FILTER_OPTS    = ['Tất cả cổng', 'Cổng Bắc A', 'Cổng Nam B', 'Cổng Đông C', 'Cổng Tây D'];

export default function ActivityLog({ accessLogs }: ActivityLogProps) {
  const allRows = buildMockRows(accessLogs);

  const [vehicleFilter, setVehicleFilter] = useState('Tất cả');
  const [actionFilter, setActionFilter]   = useState('Tất cả');
  const [gateFilter, setGateFilter]       = useState('Tất cả cổng');
  const [page, setPage] = useState(1);

  const filtered = allRows.filter((r) => {
    if (vehicleFilter !== 'Tất cả' && r.vehicleType !== vehicleFilter) return false;
    if (actionFilter === 'VÀO' && r.direction !== 'entry') return false;
    if (actionFilter === 'RA'  && r.direction !== 'exit')  return false;
    if (gateFilter !== 'Tất cả cổng' && !r.lane.includes(gateFilter.replace('Cổng ', ''))) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx   = (page - 1) * PAGE_SIZE + 1;
  const endIdx     = Math.min(page * PAGE_SIZE, filtered.length);

  const visiblePageNums = (() => {
    const nums: (number | '…')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1, 2, 3, '…', totalPages);
    }
    return nums;
  })();

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật ký hoạt động</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lịch sử thời gian thực của tất cả các phương tiện di chuyển qua các cổng cơ sở.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
            <FileText className="h-3.5 w-3.5" /> Xuất PDF
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition">
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        {/* Date picker */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>Hôm nay, 24 Th10</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Vehicle type */}
        <div className="relative">
          <select
            value={vehicleFilter}
            onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {VEHICLE_FILTER_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Action */}
        <div className="relative">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {ACTION_FILTER_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Gate */}
        <div className="relative">
          <select
            value={gateFilter}
            onChange={(e) => { setGateFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {GATE_FILTER_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition">
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-widest text-slate-400">
                <th className="px-5 py-3">Thời gian</th>
                <th className="px-5 py-3">Biển số</th>
                <th className="px-5 py-3">Loại xe</th>
                <th className="px-5 py-3">Hành động</th>
                <th className="px-5 py-3">Làn / Cổng</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Phân loại khách</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Không có bản ghi phù hợp.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  {/* Time */}
                  <td className="px-5 py-3.5">
                    <span className="block text-sm font-bold text-blue-600">{row.timeHMS}</span>
                    <span className="block text-[11px] text-slate-400">{row.dateStr}</span>
                  </td>

                  {/* Plate */}
                  <td className="px-5 py-3.5">
                    <span className="block text-sm font-bold text-blue-600">{row.platePfx}</span>
                    <span className="block text-[11px] font-medium text-slate-500">{row.plateNum}</span>
                  </td>

                  {/* Vehicle type */}
                  <td className="px-5 py-3.5 text-slate-700">{row.vehicleType}</td>

                  {/* Direction badge */}
                  <td className="px-5 py-3.5">
                    {row.direction === 'entry' ? (
                      <span className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">
                        VÀO
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        RA
                      </span>
                    )}
                  </td>

                  {/* Lane/Gate */}
                  <td className="px-5 py-3.5 text-slate-600 text-xs">{row.lane}</td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    {row.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {row.statusLabel}
                      </span>
                    ) : row.status === 'override' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {row.statusLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-xs font-semibold text-rose-600">Lỗi</span>
                        <span className="text-xs text-slate-400">/</span>
                        <span className="text-xs font-semibold text-rose-500">Thanh toán</span>
                      </span>
                    )}
                  </td>

                  {/* Customer type */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      row.customerType === 'Khách tháng'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {row.customerType}
                    </span>
                  </td>

                  {/* Eye */}
                  <td className="px-5 py-3.5">
                    <button className="text-slate-400 hover:text-blue-600 transition">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            Hiển thị <span className="font-semibold text-slate-700">{startIdx} - {endIdx}</span> trên{' '}
            <span className="font-semibold text-slate-700">{filtered.length.toLocaleString('vi-VN')} bản ghi</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {visiblePageNums.map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-slate-400 text-sm">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                    page === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
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
    </div>
  );
}
