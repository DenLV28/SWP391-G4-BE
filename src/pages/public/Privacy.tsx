import React from 'react';
import { ArrowLeft, Shield, Database, Eye, Lock, Trash2, Bell } from 'lucide-react';

const sections = [
  {
    icon: Database,
    title: '1. Thông tin chúng tôi thu thập',
    content:
      'Chúng tôi thu thập thông tin bạn cung cấp khi đăng ký tài khoản (họ tên, email, số điện thoại), thông tin phương tiện (biển số xe, loại xe), lịch sử đặt chỗ và thanh toán. Ngoài ra, chúng tôi có thể thu thập dữ liệu kỹ thuật như địa chỉ IP, loại trình duyệt và thời gian truy cập để cải thiện dịch vụ.',
  },
  {
    icon: Eye,
    title: '2. Cách chúng tôi sử dụng thông tin',
    content:
      'Thông tin của bạn được sử dụng để: xử lý đặt chỗ và thanh toán; gửi thông báo liên quan đến dịch vụ; cải thiện trải nghiệm người dùng; tuân thủ yêu cầu pháp lý; ngăn chặn gian lận. Chúng tôi không bán hoặc cho thuê thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào.',
  },
  {
    icon: Shield,
    title: '3. Chia sẻ thông tin',
    content:
      'Chúng tôi chỉ chia sẻ thông tin với: đối tác vận hành bãi xe cần thiết để thực hiện dịch vụ; nhà cung cấp thanh toán để xử lý giao dịch; cơ quan có thẩm quyền khi được yêu cầu theo quy định pháp luật. Mọi đối tác đều phải cam kết bảo mật thông tin theo tiêu chuẩn của chúng tôi.',
  },
  {
    icon: Lock,
    title: '4. Bảo mật dữ liệu',
    content:
      'Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn công nghiệp: mã hóa SSL/TLS cho toàn bộ dữ liệu truyền tải; mã hóa dữ liệu lưu trữ nhạy cảm; kiểm soát truy cập nghiêm ngặt theo vai trò; giám sát hệ thống 24/7 để phát hiện và phòng ngừa xâm nhập trái phép.',
  },
  {
    icon: Bell,
    title: '5. Cookie và theo dõi',
    content:
      'Chúng tôi sử dụng cookie để duy trì phiên đăng nhập, ghi nhớ tùy chọn của bạn và phân tích việc sử dụng dịch vụ. Bạn có thể kiểm soát cookie thông qua cài đặt trình duyệt, tuy nhiên điều này có thể ảnh hưởng đến một số tính năng của dịch vụ.',
  },
  {
    icon: Trash2,
    title: '6. Quyền của bạn',
    content:
      'Bạn có quyền: truy cập và xem thông tin cá nhân đang được lưu trữ; yêu cầu chỉnh sửa thông tin không chính xác; yêu cầu xóa tài khoản và dữ liệu cá nhân (trừ dữ liệu cần giữ theo quy định pháp lý); từ chối nhận thông báo marketing. Liên hệ chúng tôi để thực hiện các quyền này.',
  },
];

export default function Privacy({ setView }: { setView: (view: string) => void }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[860px]">
          <button
            onClick={() => setView('home')}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">ParkFlow</p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Chính sách bảo mật</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-300">
            Chúng tôi cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn theo tiêu chuẩn cao nhất.
          </p>
          <p className="mt-3 text-[12px] text-slate-500">Cập nhật lần cuối: 01/01/2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[860px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {sections.map(({ icon: Icon, title, content }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900">{title}</h2>
                  <p className="mt-2 text-[14px] leading-7 text-slate-600">{content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact note */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-800 p-6 text-white">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
            <div>
              <h3 className="text-[15px] font-bold">Liên hệ về quyền riêng tư</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">
                Nếu bạn có thắc mắc về chính sách bảo mật hoặc muốn thực hiện quyền của mình, vui lòng liên hệ:{' '}
                <span className="font-semibold text-white">privacy@parkflow.vn</span> hoặc gửi yêu cầu bằng văn bản tới địa chỉ văn phòng của chúng tôi.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-[14px] font-semibold text-white shadow-md transition hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
