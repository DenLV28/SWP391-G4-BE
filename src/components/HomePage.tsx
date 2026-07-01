import React from "react";
import { useNavigate } from "react-router-dom";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 via-blue-50 to-white py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-5">
              <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-xs font-medium">
                Thu? ch? ?? th?ng minh
              </div>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                Tìm và thuê chỗ đỗ xe an toàn, tiện lợi
              </h1>
              
              <p className="text-base text-gray-600 leading-relaxed">
                Giải pháp giúp bạn tìm kiếm, đặt chỗ và thanh toán phí gửi xe ngay trên điện thoại. 
                Không còn lo lắng về việc hết chỗ hay thất thoát tiền xe.
              </p>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => navigate('/dat-cho')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Tìm chỗ ngay
                </button>
                <button 
                  onClick={() => navigate('/bang-gia')}
                  className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Xem Bảng Đồ
                </button>
              </div>
              
              <div className="flex items-center gap-2.5 pt-3">
                <div className="flex -space-x-1.5">
                  <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-white"></div>
                  <div className="w-7 h-7 rounded-full bg-purple-500 border-2 border-white"></div>
                  <div className="w-7 h-7 rounded-full bg-green-500 border-2 border-white"></div>
                </div>
                <p className="text-xs text-gray-500">
                  Hơn 10.000 người dùng đã tìm được chỗ đỗ ưng ý
                </p>
              </div>
            </div>

            {/* Right Image with Wireframe */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: '#1a2332' }}>
                <img 
                  src="/src/assets/images/xe.jpg" 
                  alt="Bãi đỗ xe" 
                  className="w-full h-auto opacity-40"
                />
                {/* Wireframe Overlay */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <svg className="w-full h-full" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Main border */}
                    <rect x="20" y="20" width="360" height="260" stroke="white" strokeWidth="1.5" rx="4"/>
                    {/* Top section */}
                    <line x1="20" y1="70" x2="380" y2="70" stroke="white" strokeWidth="1.5"/>
                    {/* Vertical divider */}
                    <line x1="200" y1="70" x2="200" y2="280" stroke="white" strokeWidth="1.5"/>
                    {/* Cards */}
                    <rect x="40" y="90" width="140" height="80" stroke="white" strokeWidth="1.5" rx="3"/>
                    <rect x="220" y="90" width="140" height="80" stroke="white" strokeWidth="1.5" rx="3"/>
                    <rect x="40" y="190" width="140" height="70" stroke="white" strokeWidth="1.5" rx="3"/>
                    <rect x="220" y="190" width="140" height="70" stroke="white" strokeWidth="1.5" rx="3"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Trải nghiệm dịch vụ gửi xe hiện đại
            </h2>
            <p className="text-sm text-gray-600">
              Giải pháp toàn diện giúp việc tìm kiếm và gửi xe trở nên dễ dàng hơn bao giờ hết
            </p>
          </div>

          {/* 2x2 Grid */}
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {/* Card 1 - Tìm vị trí trống (có ảnh) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                    Tìm vị trí trống tức thì
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Xem bản đồ bãi đỗ xe, biết chính xác bãi xe còn chỗ, khoảng cách và giá vé trước khi đến.
                  </p>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden mt-3">
                <img 
                  src="/src/assets/images/xe-trong.jpg" 
                  alt="Parking" 
                  className="w-full h-28 object-cover"
                />
              </div>
            </div>

            {/* Card 2 - Thanh toán (màu xanh, không ảnh) */}
            <div className="bg-blue-600 text-white rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold mb-1.5">
                    Thanh toán nhanh qua App
                  </h3>
                  <p className="text-xs text-blue-50 leading-relaxed">
                    Quét mã QR để vào/ra và thanh toán tự động qua ví điện tử. Không cần dùng tiền mặt, không phải chờ đợi.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3 - Quản lý lịch trình (có ảnh) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                    Quản lý lịch trình gửi xe
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Theo dõi lịch sử, đặt gửi xe, gia hạn đăng ký chỗ theo tháng dễ dàng ngay trên ứng dụng.
                  </p>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden mt-3">
                <img 
                  src="/src/assets/images/an-ninh.jpg" 
                  alt="Schedule" 
                  className="w-full h-28 object-cover"
                />
              </div>
            </div>

            {/* Card 4 - An ninh 24/7 (không ảnh) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                    Bãi xe an ninh & camera 24/7
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Hợp tác với các bãi xe uy tín, trang bị hệ thống nhận diện biển số AI và camera giám sát toàn diện để bảo vệ tài sản của bạn.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Bảng giá dịch vụ theo loại xe
            </h2>
            <p className="text-sm text-gray-600">
              Báo cáo sẵn giá thuê cho từng loại xe đúng theo nhu cầu sử dụng của bạn
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {/* Card 1 - Xe máy */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🛵</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Xe máy</h3>
                    <p className="text-xs text-gray-500">Tất cả các dòng xe hai bánh</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Thuê Giờ (0-2h)</span>
                  <span className="font-bold text-gray-900">5.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Theo Tháng</span>
                  <span className="font-bold text-gray-900">150.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Theo Năm</span>
                  <span className="font-bold text-blue-600">1.500.000đ</span>
                </div>
                <button className="w-full mt-3 bg-white border border-blue-600 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                  Thuê ngay
                </button>
              </div>
            </div>

            {/* Card 2 - Ô tô (Featured - Màu xanh) */}
            <div className="bg-blue-600 text-white rounded-xl overflow-hidden hover:shadow-lg transition-shadow relative">
              <div className="absolute top-3 right-3 bg-yellow-400 text-gray-900 px-2 py-0.5 rounded text-xs font-bold">
                PHỔ BIẾN
              </div>
              <div className="p-5 bg-white/10 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🚗</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Ô tô 4-7 chỗ</h3>
                    <p className="text-xs text-blue-100">Xe cá nhân, xe gia đình</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-100">Thuê Giờ (0-2h)</span>
                  <span className="font-bold">25.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-100">Theo Tháng</span>
                  <span className="font-bold">1.200.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-100">Theo Năm</span>
                  <span className="font-bold text-yellow-300">12.000.000đ</span>
                </div>
                <button className="w-full mt-3 bg-white text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                  Thuê ngay
                </button>
              </div>
            </div>

            {/* Card 3 - Xe tải & Khách */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🚐</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Xe tải & Khách</h3>
                    <p className="text-xs text-gray-500">Xe tải 25-55 chỗ, xe khách</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Thuê Giờ (0-2h)</span>
                  <span className="font-bold text-gray-900">40.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Theo Tháng</span>
                  <span className="font-bold text-gray-900">2.500.000đ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Theo Năm</span>
                  <span className="font-bold text-blue-600">25.000.000đ</span>
                </div>
                <button className="w-full mt-3 bg-white border border-blue-600 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                  Thuê ngay
                </button>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 px-4">
            <p className="text-xs text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Giá trên đã bao gồm VAT. Đối với dịch vụ gửi xe qua đêm hoặc các loại phương tiện đặc biệt, 
              vui lòng kiểm tra thông tin chi tiết trên ứng dụng hoặc liên hệ{" "}
              <a href="#" className="text-blue-600 hover:underline">hotline 1900-xxxx</a>.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-blue-800 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white rounded-full"></div>
              <div className="absolute bottom-10 right-10 w-16 h-16 border-2 border-white rounded-full"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Bạn đã sẵn sàng để gửi xe thông minh hơn?
              </h2>
              <p className="text-sm md:text-base text-blue-100 mb-6 max-w-2xl mx-auto leading-relaxed">
                Đăng ký ngay hôm nay để nhận ưu đãi giảm 50% cho lượt thuê đầu tiên và trải nghiệm dịch vụ gửi xe an toàn nhất.
              </p>
              <button 
                onClick={() => navigate('/dat-cho')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg"
              >
                Đặt ngay
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-50 py-10 px-4 border-t border-blue-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">ParkFlow</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                Nền tảng thuê chỗ gửi xe thông minh hàng đầu Việt Nam, giúp bạn tiết kiệm thời gian 
                và an tâm trong mọi hành trình.
              </p>
              <div className="flex gap-2">
                <a href="#" className="w-7 h-7 bg-gray-300 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors">
                  <span className="text-xs text-white">f</span>
                </a>
                <a href="#" className="w-7 h-7 bg-gray-300 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors">
                  <span className="text-xs text-white">tw</span>
                </a>
              </div>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Dịch vụ</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Tìm chỗ đỗ</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Đặt chỗ theo tháng</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Tài xế đăng nhập</a></li>
              </ul>
            </div>

            {/* About */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Về chúng tôi</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Câu chuyện ParkFlow</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Tuyển dụng</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Blog chia sẻ</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Hỗ trợ</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Trung tâm trợ giúp</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Chính sách hoàn tiền</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-blue-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-gray-500">
            <p>© 2026 ParkFlow Parking Rental Service. All rights reserved.</p>
            <div className="flex gap-5">
              <a href="#" className="hover:text-blue-600 transition-colors">Điều khoản</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Bảo mật</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Ti?ng Vi?t</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
