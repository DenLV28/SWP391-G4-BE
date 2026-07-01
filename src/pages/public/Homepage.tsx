import React from 'react';
import { Info, QrCode, Search, ShieldCheck } from 'lucide-react';
import anNinhImage from '../../assets/images/an-ninh.jpg';
import xeImage from '../../assets/images/xe.jpg';
import xeTrongImage from '../../assets/images/xe-trong.jpg';

export default function Homepage({ setView }: { setView: (view: string) => void; stats: any }) {
  return (
    <div className="public-page w-full">
      <section className="public-hero-section relative w-full overflow-hidden pb-24 pt-16">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 lg:flex-row">
            <div className="space-y-6 lg:w-1/2">
              <span className="public-pill inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                Đặt chỗ thông minh
              </span>
              <h1 className="public-heading text-[40px] font-bold leading-[1.1] tracking-tight lg:text-[48px]">
                Tìm và thuê chỗ đỗ xe an toàn, tiện lợi
              </h1>
              <p className="public-copy max-w-md text-[15px] leading-relaxed">
                Giải pháp giúp bạn tìm kiếm, đặt chỗ và thanh toán phí gửi xe ngay trên điện thoại. Không còn lo lắng về việc hết chỗ hay thất thoát tiền lẻ.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <button onClick={() => setView('slots')} className="flex items-center gap-2 rounded-lg bg-[#1a56db] px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
                  Tìm chỗ ngay
                  <Search className="h-4 w-4" />
                </button>
                <button onClick={() => setView('slots')} className="public-button-secondary rounded-lg border px-6 py-3 font-semibold shadow-sm transition">
                  Xem bản đồ
                </button>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <div className="flex -space-x-2">
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/150?img=11" alt="" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/150?img=12" alt="" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white" src="https://i.pravatar.cc/150?img=13" alt="" />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 ring-2 ring-white">10k+</div>
                </div>
                <p className="public-copy text-[12px] font-medium">Hơn 15.000 người dùng đã trải nghiệm và đồng ý</p>
              </div>
            </div>

            <div className="relative lg:w-1/2">
              <div className="public-surface relative overflow-hidden rounded-2xl p-2 shadow-2xl">
                <img src={xeImage} alt="Bãi đỗ xe" className="aspect-[4/3] w-full rounded-xl object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto mb-12 max-w-[1000px] px-4 text-center">
          <h2 className="public-heading mb-3 text-[28px] font-bold">Trải nghiệm dịch vụ gửi xe hiện đại</h2>
          <p className="public-copy text-[15px]">ParkFlow mang đến sự tiện lợi tối đa cho mọi hành trình của bạn.</p>
        </div>

        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="public-card-muted md:col-span-2 flex flex-col items-center gap-6 rounded-2xl border p-8 md:flex-row">
              <div className="flex-1 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#1a56db]">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="public-heading text-xl font-bold">Tìm vị trí trống tức thì</h3>
                <p className="public-copy text-[13px] leading-relaxed">
                  Xem bản đồ thời gian thực để biết chính xác bãi xe nào còn chỗ, khoảng cách và giá vé trước khi đến.
                </p>
              </div>
              <div className="relative w-full flex-1">
                <img src={xeTrongImage} alt="Bản đồ bãi xe" className="w-full rounded-xl object-cover shadow-lg" />
              </div>
            </div>

            <div className="rounded-2xl bg-[#1a56db] p-8 text-white">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="mb-3 text-xl font-bold">Thanh toán nhanh qua ứng dụng</h3>
              <p className="text-[13px] leading-relaxed text-blue-100">
                Quét mã QR để vào, ra và thanh toán tự động qua ví điện tử. Không cần dùng tiền mặt, không phải chờ đợi.
              </p>
            </div>

            <div className="public-surface flex flex-col justify-between rounded-2xl border p-8 shadow-sm">
              <div>
                <h3 className="public-heading mb-3 text-xl font-bold">Quản lý lịch trình gửi xe</h3>
                <p className="public-copy text-[13px] leading-relaxed">
                  Theo dõi lịch sử gửi xe, chi phí và đăng ký thuê chỗ theo tháng dễ dàng ngay trên ứng dụng.
                </p>
              </div>
            </div>

            <div className="public-surface md:col-span-2 flex flex-col items-center gap-6 rounded-2xl border p-8 shadow-sm md:flex-row">
              <div className="w-full flex-1">
                <img src={anNinhImage} alt="Cổng an ninh" className="h-40 w-full rounded-xl object-cover" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="public-heading text-lg font-bold">Bãi xe an ninh và camera 24/7</h3>
                <p className="public-copy text-[13px] leading-relaxed">
                  Hợp tác với các bãi xe uy tín, trang bị hệ thống nhận diện biển số AI và camera giám sát toàn diện để bảo vệ tài sản của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section-alt border-t py-20">
        <div className="mx-auto mb-12 max-w-[1000px] px-4 text-center">
          <h2 className="public-heading mb-3 text-[28px] font-bold">Bảng giá dịch vụ theo loại xe</h2>
          <p className="public-copy text-[15px]">Phí thuê chỗ gửi xe được áp dụng đồng nhất trên toàn hệ thống ParkFlow</p>
        </div>

        <div className="mx-auto max-w-[1100px] px-4">
          <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-3">
            {[
              { title: 'Xe máy', icon: '🏍️', hourly: '5.000đ', monthly: '150.000đ', yearly: '1.500.000đ', savings: '- Tiết kiệm 2 tháng -' },
              { title: 'Ô tô 4-7 chỗ', icon: '🚗', hourly: '25.000đ', monthly: '1.200.000đ', yearly: '12.000.000đ', savings: '- Tiết kiệm 2.4tr -', featured: true },
              { title: 'Xe tải & Khách', icon: '🚐', hourly: '40.000đ', monthly: '2.500.000đ', yearly: '25.000.000đ', savings: '- Tiết kiệm 5tr -' },
            ].map((item) => (
              <div key={item.title} className={`public-surface overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${item.featured ? 'border-2 border-[#1a56db] md:-translate-y-4' : ''}`}>
                {item.featured && <div className="bg-[#1a56db] px-4 py-1 text-center text-[10px] font-bold text-white">PHỔ BIẾN NHẤT</div>}
                <div className="public-card-top border-b p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.featured ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
                      <span className="text-xl">{item.icon}</span>
                    </div>
                    <div>
                      <h3 className="public-heading font-bold text-[16px]">{item.title}</h3>
                      <p className="public-copy text-xs">
                        {item.title === 'Xe máy' ? 'Tất cả các dòng xe hai bánh' : item.title === 'Ô tô 4-7 chỗ' ? 'Xe cá nhân, xe gia đình' : 'Xe tải, xe khách'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5 p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="public-copy">Theo giờ (0-2h)</span>
                    <span className="public-heading font-bold text-[14px]">{item.hourly}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="public-copy">Theo tháng</span>
                    <span className="public-heading font-bold text-[14px]">{item.monthly}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="public-copy">Theo năm</span>
                    <span className={`font-bold ${item.featured ? 'text-yellow-300' : 'text-blue-600'}`}>{item.yearly}</span>
                  </div>
                  <button className={`mt-3 w-full rounded-lg py-2 text-sm font-medium transition-colors ${item.featured ? 'bg-[#1a56db] text-white hover:bg-blue-700' : 'public-button-secondary border'}`}>
                    Thuê ngay
                  </button>
                  <p className="pt-1 text-center text-[10px] font-bold text-emerald-500">{item.savings}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="public-info-box mx-auto mt-8 flex max-w-4xl items-start gap-3 rounded-xl border p-4 sm:items-center">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500 sm:mt-0" />
            <p className="public-copy flex-1 text-[12px]">
              Giá trên đã bao gồm VAT. Đối với dịch vụ gửi xe qua đêm hoặc các loại phương tiện đặc biệt, vui lòng kiểm tra thông tin chi tiết trên ứng dụng.
            </p>
            <a href="#" className="hidden whitespace-nowrap text-[12px] font-semibold text-blue-600 hover:underline sm:block">
              Xem biểu giá đầy đủ →
            </a>
          </div>
        </div>
      </section>

      <section className="public-section py-20">
        <div className="mx-auto max-w-[1000px] px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101b3b] to-[#1a2d5c] p-12 text-center text-white shadow-xl">
            <div className="absolute right-0 top-0 h-64 w-64 -mr-16 -mt-16 rounded-full bg-white opacity-5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-64 w-64 -ml-16 -mb-16 rounded-full bg-[#1a56db] opacity-20 blur-3xl" />
            <div className="relative z-10">
              <h2 className="mb-4 text-[28px] font-bold md:text-[36px]">Bạn đã sẵn sàng để gửi xe thông minh hơn?</h2>
              <p className="mx-auto mb-8 max-w-xl text-[15px] text-slate-300">
                Đăng ký ngay hôm nay để nhận ưu đãi giảm 50% cho lượt thuê đầu tiên và trải nghiệm dịch vụ gửi xe an toàn nhất.
              </p>
              <button onClick={() => setView('register')} className="rounded-lg bg-[#1a56db] px-8 py-3.5 font-bold text-white shadow-lg transition hover:bg-blue-600">
                Đặt ngay
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
