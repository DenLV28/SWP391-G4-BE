export default function ParkingJourney({ setView: _setView }: { setView: (view: string) => void }) {
  return (
    <section className="public-section-alt border-y py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <p className="public-copy mx-auto max-w-[820px] text-center text-[15px] leading-7">
          Toàn bộ hành trình gửi xe được số hoá thành năm bước liền mạch — từ lúc xe vào bãi và nhận mã gửi xe,
          qua đặt chỗ trước hoặc theo dõi lượt gửi theo thời gian thực, đến khi thanh toán và gửi phản hồi nếu
          phát sinh sự cố. Mỗi bước đều gắn với một màn hình cụ thể trong hệ thống, giúp cả khách gửi xe lẫn
          nhân viên vận hành luôn nắm rõ trạng thái xe và chi phí tại mọi thời điểm.
        </p>
      </div>
    </section>
  );
}
