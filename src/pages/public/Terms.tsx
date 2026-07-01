import React from 'react';
import { ArrowLeft, FileText, Scale, ShieldCheck, AlertTriangle, RefreshCw, Users } from 'lucide-react';

const sections = [
  {
    icon: Users,
    title: '1. Chấp nhận điều khoản',
    content:
      'Bằng cách truy cập và sử dụng dịch vụ ParkFlow, bạn đồng ý tuân thủ và bị ràng buộc bởi các điều khoản và điều kiện sau đây. Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản này, vui lòng không sử dụng dịch vụ của chúng tôi.',
  },
  {
    icon: FileText,
    title: '2. Sử dụng dịch vụ',
    content:
      'Dịch vụ ParkFlow được cung cấp cho mục đích đặt chỗ và quản lý bãi đỗ xe. Bạn đồng ý sử dụng dịch vụ này chỉ cho các mục đích hợp pháp và không vi phạm quyền lợi của bất kỳ bên thứ ba nào. Mọi hành vi gian lận, giả mạo thông tin hoặc sử dụng sai mục đích đều bị nghiêm cấm.',
  },
  {
    icon: ShieldCheck,
    title: '3. Tài khoản người dùng',
    content:
      'Khi tạo tài khoản, bạn có trách nhiệm cung cấp thông tin chính xác và cập nhật. Bạn chịu trách nhiệm hoàn toàn về mật khẩu và bảo mật tài khoản. Vui lòng thông báo ngay cho chúng tôi nếu phát hiện bất kỳ hành vi sử dụng trái phép nào đối với tài khoản của bạn.',
  },
  {
    icon: Scale,
    title: '4. Đặt chỗ và thanh toán',
    content:
      'Mọi đặt chỗ đều phải được xác nhận bởi hệ thống. Phí gửi xe được tính theo biểu phí hiện hành công bố trên nền tảng. Việc hủy đặt chỗ cần thực hiện ít nhất 15 phút trước giờ bắt đầu. Chúng tôi không hoàn tiền đối với các trường hợp hủy muộn hoặc không đến bãi.',
  },
  {
    icon: AlertTriangle,
    title: '5. Giới hạn trách nhiệm',
    content:
      'ParkFlow không chịu trách nhiệm đối với mất mát, hư hỏng tài sản trong xe, hoặc thiệt hại do sự cố ngoài tầm kiểm soát (thiên tai, sự cố kỹ thuật). Chúng tôi khuyến khích người dùng không để vật dụng có giá trị cao trong xe khi gửi tại bãi.',
  },
  {
    icon: RefreshCw,
    title: '6. Thay đổi điều khoản',
    content:
      'ParkFlow có quyền sửa đổi các điều khoản này bất kỳ lúc nào. Mọi thay đổi sẽ được thông báo qua email đăng ký hoặc thông báo trên nền tảng. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực đồng nghĩa với việc bạn chấp nhận các điều khoản mới.',
  },
];

export default function Terms({ setView }: { setView: (view: string) => void }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-[#1f67db] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[860px]">
          <button
            onClick={() => setView('home')}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-blue-100 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Scale className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">ParkFlow</p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Điều khoản sử dụng</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-blue-50/90">
            Vui lòng đọc kỹ các điều khoản và điều kiện dưới đây trước khi sử dụng dịch vụ ParkFlow.
          </p>
          <p className="mt-3 text-[12px] text-blue-100/70">Cập nhật lần cuối: 01/01/2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[860px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {sections.map(({ icon: Icon, title, content }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1f67db]">
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
        <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <h3 className="text-[15px] font-bold text-blue-900">Liên hệ & thắc mắc</h3>
          <p className="mt-2 text-[13px] leading-6 text-blue-700">
            Nếu bạn có bất kỳ câu hỏi nào về Điều khoản sử dụng, vui lòng liên hệ chúng tôi qua email{' '}
            <span className="font-semibold">support@parkflow.vn</span> hoặc hotline{' '}
            <span className="font-semibold">1900 1234</span>.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 rounded-full bg-[#1f67db] px-8 py-3 text-[14px] font-semibold text-white shadow-md transition hover:bg-[#1759c2]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
