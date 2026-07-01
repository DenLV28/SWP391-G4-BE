import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { detailedPricingTables } from '../../data/mockData';

export default function PricingDetail({ setView }: { setView: (view: string) => void }) {
  const getMaterialIcon = (iconName: string) => {
    const iconMap: Record<string, string> = {
      'moped': '🏍️',
      'directions_car': '🚗',
      'airport_shuttle': '🚐',
    };
    return iconMap[iconName] || '📍';
  };

  return (
    <div className="bg-slate-50/50 w-full">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button
            onClick={() => setView('pricing')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-semibold">Quay lại bảng giá</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-16">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          {/* Page Title */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Bảng giá chi tiết dịch vụ</h1>
            <p className="text-slate-600">Thông tin chi tiết về phí gửi xe cho từng loại phương tiện tại ParkFlow</p>
          </div>

          {/* Pricing Tables */}
          <div className="space-y-8">
            {detailedPricingTables.map((table) => (
              <div key={table.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
                {/* Table Header */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMaterialIcon(table.icon)}</span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{table.title}</h3>
                      <p className="text-sm text-slate-600">{table.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Mobile View - Stack Cards */}
                <div className="lg:hidden divide-y divide-slate-200">
                  {table.rows.map((row, idx) => (
                    <div key={idx} className="px-4 py-4 hover:bg-slate-50 transition">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="font-semibold text-slate-900 text-sm flex-1">{row.description}</p>
                        <p className="font-bold text-blue-600 text-lg whitespace-nowrap">
                          {(row.price / 1000).toFixed(0)}k đ
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">{row.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-left font-semibold text-slate-900 text-sm">Thời gian giữ xe</th>
                        <th className="px-6 py-4 text-left font-semibold text-slate-900 text-sm">Đơn vị tính</th>
                        <th className="px-6 py-4 text-right font-semibold text-slate-900 text-sm">Mức giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {table.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 font-medium text-slate-700">{row.description}</td>
                          <td className="px-6 py-4 text-slate-600 text-sm">{row.unit}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-blue-600 text-lg">
                              {(row.price / 1000).toFixed(0)}k đ
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Info Section */}
          <div className="mt-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 sm:p-12 text-white text-center shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Bạn đã sẵn sàng đỗ xe thông minh?
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-base sm:text-lg">
              Tham gia cùng hàng nghìn khách hàng tin tưởng ParkFlow. Đặt chỗ ngay hôm nay để nhận ưu đãi cho tháng đầu tiên.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setView('slots')}
                className="px-8 py-3 bg-white text-blue-600 font-bold rounded-full hover:bg-slate-100 transition shadow-md"
              >
                Đặt chỗ ngay
              </button>
              <button
                onClick={() => setView('pricing')}
                className="px-8 py-3 border-2 border-white text-white font-bold rounded-full hover:bg-white/10 transition"
              >
                Quay lại bảng giá
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
