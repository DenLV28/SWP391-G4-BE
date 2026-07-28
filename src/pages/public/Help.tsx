import React, { useState } from 'react';
import {
  ArrowLeft,
  LifeBuoy,
  Ticket,
  CreditCard,
  KeyRound,
  Car,
  ChevronDown,
  Mail,
  Phone,
  MessageSquareWarning,
} from 'lucide-react';

const guides = [
  {
    icon: Ticket,
    title: 'Đặt chỗ gửi xe như thế nào?',
    content:
      'Vào mục "Đặt chỗ" trên thanh điều hướng, chọn loại xe và gói giá phù hợp (theo giờ, qua đêm hoặc theo tháng), chọn ô đỗ còn trống trên sơ đồ bãi rồi bấm "Xác nhận đặt chỗ". Bạn có thể xem lại và quản lý các đặt chỗ trong mục "Lịch sử đặt chỗ".',
  },
  {
    icon: Car,
    title: 'Check-in và check-out khi vào/ra bãi ra sao?',
    content:
      'Khi đến bãi, nhân viên hoặc hệ thống sẽ quét biển số hoặc thẻ RFID để ghi nhận xe vào — bạn không cần tự thao tác check-in. Khi ra bãi, hệ thống tự tính phí tạm thời — nếu đã thanh toán trước, barie sẽ mở tự động ngay khi thanh toán thành công.',
  },
  {
    icon: CreditCard,
    title: 'Thanh toán và hoàn tiền hoạt động thế nào?',
    content:
      'ParkFlow sử dụng cổng thanh toán VNPay để xử lý mọi giao dịch an toàn. Bạn có thể thanh toán ngay khi đặt chỗ hoặc thanh toán khi xe ra khỏi bãi trong mục "Thanh toán". Với các trường hợp hủy hợp lệ (trong vòng 5 phút sau khi đặt chỗ và chưa thanh toán), khoản phí sẽ không bị tính. Sau 5 phút, vui lòng liên hệ nhân viên bãi đỗ để được hỗ trợ hủy.',
  },
  {
    icon: KeyRound,
    title: 'Quên mật khẩu hoặc không đăng nhập được?',
    content:
      'Tại trang đăng nhập, chọn "Quên mật khẩu" và làm theo hướng dẫn để đặt lại mật khẩu qua email đã đăng ký. Nếu vẫn gặp sự cố, vui lòng liên hệ đội ngũ hỗ trợ qua các kênh bên dưới để được trợ giúp trực tiếp.',
  },
  {
    icon: MessageSquareWarning,
    title: 'Gặp sự cố tại bãi xe (mất thẻ, sai phí, ô bị chiếm...)?',
    content:
      'Vào mục "Phản hồi / Hỗ trợ", chọn đúng loại sự cố, mô tả chi tiết và đính kèm ảnh nếu có. Đội ngũ nhân viên sẽ tiếp nhận và phản hồi trực tiếp trong ứng dụng. Với sự cố khẩn cấp, vui lòng gọi ngay hotline hỗ trợ 24/7.',
  },
];

const faqs = [
  {
    question: 'Tôi có thể hủy đặt chỗ đã thanh toán không?',
    answer:
      'Không. Vì lý do quản lý chỗ đỗ công bằng cho mọi khách hàng, đặt chỗ đã thanh toán thành công không thể tự hủy trên hệ thống. Vui lòng liên hệ bộ phận CSKH nếu cần hỗ trợ trong trường hợp đặc biệt.',
  },
  {
    question: 'Phí gửi xe được tính như thế nào nếu tôi ra trễ hơn dự kiến?',
    answer:
      'Hệ thống tự động tính thêm phí quá giờ theo biểu phí của từng loại xe, tính theo từng khoảng 30 phút vượt quá thời gian dự kiến. Khoản phí phát sinh sẽ hiển thị rõ trước khi bạn xác nhận thanh toán khi ra bãi.',
  },
  {
    question: 'Tôi có thể đăng ký nhiều xe trong một tài khoản không?',
    answer:
      'Có. Vào mục "Hồ sơ" → "Quản lý xe" để thêm nhiều phương tiện, đặt một xe làm mặc định để việc đặt chỗ nhanh hơn ở những lần sau.',
  },
  {
    question: 'Vé gửi xe theo tháng có gia hạn tự động không?',
    answer:
      'Chưa hỗ trợ gia hạn tự động. Trước khi hết hạn, bạn sẽ cần đặt một gói "Theo tháng" mới trong mục "Đặt chỗ" để tiếp tục sử dụng dịch vụ.',
  },
];

function GuideCard({ icon: Icon, title, content }: { icon: React.ComponentType<{ className?: string }>; title: string; content: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-[14px] font-semibold text-slate-900">{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4 text-[13px] leading-6 text-slate-600">{answer}</div>}
    </div>
  );
}

export default function Help({ setView }: { setView: (view: string) => void }) {
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
              <LifeBuoy className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">ParkFlow</p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Trợ giúp & Hỗ trợ</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-blue-50/90">
            Hướng dẫn sử dụng dịch vụ ParkFlow và giải đáp các thắc mắc thường gặp. Không tìm thấy câu trả lời? Đội ngũ hỗ trợ luôn sẵn sàng 24/7.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[860px] px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">Hướng dẫn sử dụng</h2>
        <div className="space-y-6">
          {guides.map((g) => (
            <GuideCard key={g.title} icon={g.icon} title={g.title} content={g.content} />
          ))}
        </div>

        <h2 className="mb-4 mt-12 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} />
          ))}
        </div>

        {/* Contact note */}
        <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <h3 className="text-[15px] font-bold text-blue-900">Vẫn cần hỗ trợ thêm?</h3>
          <p className="mt-2 text-[13px] leading-6 text-blue-700">
            Gửi yêu cầu trực tiếp qua trang{' '}
            <button onClick={() => setView('contact')} className="font-semibold underline underline-offset-2">
              Liên hệ
            </button>
            , hoặc liên hệ đội ngũ CSKH của chúng tôi qua các kênh dưới đây.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
            <a href="tel:19001234" className="flex items-center gap-2 font-semibold text-blue-800 hover:underline">
              <Phone className="h-4 w-4" /> 1900 1234 (24/7)
            </a>
            <a href="mailto:support@parkflow.vn" className="flex items-center gap-2 font-semibold text-blue-800 hover:underline">
              <Mail className="h-4 w-4" /> support@parkflow.vn
            </a>
          </div>
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
