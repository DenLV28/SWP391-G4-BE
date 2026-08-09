import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  CameraOff,
  ScanLine,
  Check,
  X,
  ArrowRight,
  Scan,
  Loader2,
  AlertCircle,
  CheckCircle,
  CreditCard,
  UserCheck,
  LogIn,
  LogOut,
  Lock,
  Unlock,
  RefreshCw,
  IdCard,
  Radio,
  QrCode,
  CalendarCheck,
} from 'lucide-react';
import jsQR from 'jsqr';
import type { Gate, ScanEvent, ScanDirection, RecognitionResult } from '../../types/staff';
import { manualVehicleOptions } from '../../types/staff';
import type { User, VehicleKey, PricingRule, Reservation, Payment, ParkingSession } from '../../data/mockData';
import { validateLicensePlate } from '../../data/mockData';
import { formatCurrency } from '../../utils/helpers';
import { readLicensePlateEx, checkOcrHealth, getOcrServiceUrl, type OcrEngine } from '../../services/ocrService';
import { fetchRfidInfo, linkRfidCard, unlinkRfidCard, type RfidInfo } from '../../services/rfidService';
import { fetchActiveSessions, createSession, updateSession } from '../../services/sessionService';
import { updateReservation } from '../../services/reservationService';
import { createPayment, updatePayment } from '../../services/paymentService';
import { updateSlotStatus } from '../../services/slotService';
import { createRfidScan, updateRfidScan, subscribeToRfidTaps, sendGateCommand, fetchRfidScans, clearRfidScanImages, type RfidScan } from '../../services/rfidScanService';
import { sameLot } from '../../utils/parkingLots';
import { perVisitOverstay, overstayDue, isReservationPaid, realtimeParkingFee, addOneMonth, findActiveMonthlyReservation } from '../../utils/reservationPricing';

interface GateControlProps {
  gates: Gate[];
  liveScans: ScanEvent[];
  iotStatus: 'connecting' | 'online' | 'offline' | 'simulated';
  iotTransport: string;
  pricingRules: PricingRule[];
  currentUser?: User;
  /** Lượt gửi (đã lọc theo bãi của staff) — tra giờ vào & tính tiền khi xe ra. */
  reservations?: Reservation[];
  payments?: Payment[];
  onConfirmScan: (scan: ScanEvent, vehicleType: VehicleKey, status: 'GRANTED' | 'OVERRIDE') => void;
  onDenyScan: (scan: ScanEvent) => void;
  onManualEntry: (gateId: string, plate: string, vehicleType: VehicleKey, direction: 'entry' | 'exit') => void;
  onRfidVerified: (gateId: string, direction: ScanDirection, plate: string, vehicleType: VehicleKey, ownerName: string, rfidUid: string, collectedFee?: number) => void;
  /** Lệnh rào chắn gửi xuống tầng IoT (ESP32/simulator). */
  onGateCommand?: (gateId: string, command: 'open' | 'close') => boolean;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  /** Bãi đang Bảo trì/Đóng cửa — chỉ hiển thị banner cảnh báo; các thao tác thật
   * sự bị chặn ở StaffDashboard (nơi truyền các handler xuống đây). */
  isUnderMaintenance?: boolean;
}

const recognitionPill: Record<string, { label: string; cls: string }> = {
  subscriber: { label: 'Khách tháng',     cls: 'bg-emerald-100 text-emerald-700' },
  casual:     { label: 'Khách lượt',      cls: 'bg-blue-100   text-blue-700'     },
  unknown:    { label: 'Không nhận diện', cls: 'bg-rose-100   text-rose-700'     },
};

/** Maps a DB-stored vehicle type label (e.g. "Ô tô 4-7 chỗ (Xăng)") back to a VehicleKey. */
function labelToVehicleKey(label: string): VehicleKey {
  return manualVehicleOptions.find((o) => o.label === label)?.key ?? 'motorbike';
}

const normPlate = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Hộp thoại chọn loại xe cho khách vãng lai tự chốt sau ngần này giây.
 *
 * Rào CHƯA mở khi hộp thoại đang hiện — loại xe phải chốt trước thì mới xếp
 * đúng ô và tính đúng giá. Mốc dự phòng này để xe không kẹt vô hạn ở cổng khi
 * staff bận ở cổng kia hoặc rời quầy: hết giờ thì chốt theo loại đang chọn sẵn
 * rồi mở rào, thay vì bắt khách đứng chờ mãi.
 */
const WALKIN_FALLBACK_SECONDS = 20;

// ── QR thẻ tháng ──────────────────────────────────────────────────────────────
// Payload do trang "Lịch sử đặt chỗ" của driver sinh ra (MyReservations):
//   PARKFLOW-MONTHLY|<reservationCode>|<licensePlate>|<ngày bắt đầu>|<ngày hết hạn>
// Chỉ tin 2 trường đầu để tra hồ sơ; hạn dùng luôn TÍNH LẠI từ ngày đăng ký
// trong DB (date + 1 tháng) — khách sửa ngày trong QR không qua mặt được.
function parseMonthlyQr(text: string): { code: string; plate: string } | null {
  const parts = text.trim().split('|');
  if (parts.length < 3 || parts[0] !== 'PARKFLOW-MONTHLY') return null;
  const code = parts[1].trim();
  const plate = parts[2].trim();
  return code && plate ? { code, plate } : null;
}


/** YYYY-MM-DD theo giờ máy (không dùng toISOString để khỏi lệch múi giờ). */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD HH:mm" theo giờ máy — dùng cho check-in/check-out phiên gửi xe. */
function localNowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${todayLocal()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type QrResult =
  | { ok: true; res: Reservation; start: string; end: string; daysLeft: number }
  | { ok: false; reason: string };

function fmtClock(d: Date, withSeconds = false) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ''}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${hms}`;
}

function fmtDuration(ms: number) {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(secs / 3600))} giờ ${pad(Math.floor((secs % 3600) / 60))} phút ${pad(secs % 60)} giây`;
}

type OcrStatus = 'idle' | 'scanning' | 'done' | 'error' | 'no_plate';
type RfidStatus = 'idle' | 'scanning' | 'found' | 'not_found' | 'error';

const DIRECTION_TABS: { key: ScanDirection; label: string; icon: typeof LogIn }[] = [
  { key: 'entry', label: 'Trạm OCR — Xe Vào', icon: LogIn },
  { key: 'exit',  label: 'Trạm OCR — Xe Ra',  icon: LogOut },
];

export default function GateControl({
  gates,
  liveScans,
  iotStatus,
  iotTransport: _iotTransport,
  pricingRules,
  currentUser,
  reservations = [],
  payments = [],
  onConfirmScan,
  onDenyScan,
  onManualEntry,
  onRfidVerified,
  onGateCommand,
  addToast,
  isUnderMaintenance = false,
}: GateControlProps) {
  // Which OCR screen is active — Entry gate or Exit gate.
  const [activeDirection, setActiveDirection] = useState<ScanDirection>('entry');
  const gate = gates.find((g) => g.direction === activeDirection) ?? gates[0];

  const [plate, setPlate] = useState('');
  const [manualType, setManualType] = useState<VehicleKey>('motorbike');

  /**
   * KHÁCH VÃNG LAI — hộp thoại nhập thủ công loại xe.
   *
   * Camera chỉ đọc được biển số, không biết đó là xe máy hay ô tô; mà loại xe
   * quyết định cỡ ô đỗ được xếp và bảng giá. Trước đây khách vãng lai bị gán
   * cứng theo ô "Loại phương tiện" ở đầu trang — staff chưa kịp chọn thì ô tô
   * bị vào vé xe máy. Nay RÀO CHƯA MỞ khi hộp thoại đang hiện: staff chọn loại
   * xe xong thì hệ thống mới gắn thẻ, mở vé rồi mở rào.
   */
  const [walkIn, setWalkIn] = useState<{ plate: string; uid: string; gateId: string } | null>(null);
  const [walkInSeconds, setWalkInSeconds] = useState(WALKIN_FALLBACK_SECONDS);
  const [walkInBusy, setWalkInBusy] = useState(false);

  /**
   * Xe vừa quét đã có mặt trong bãi → chặn vào lần hai và BÁO HẲN LÊN MÀN HÌNH.
   *
   * Chỉ báo bằng toast là không đủ: toast tự tắt sau vài giây, staff đứng ở cổng
   * quay đi một cái là mất, rồi tưởng hệ thống không phản hồi và quẹt lại.
   */
  const [alreadyInside, setAlreadyInside] = useState<
    { plate: string; slotCode: string; checkInTime: string; ticketCode: string } | null
  >(null);

  /**
   * XE THẺ THÁNG QUẸT NHẦM Ở LUỒNG RFID.
   *
   * Thẻ tháng phải vào bãi bằng mã QR — đó là đường duy nhất kiểm được hạn thẻ
   * và giữ đúng ô đã đăng ký. Vào bằng RFID thì hệ thống coi như khách vãng
   * lai: mở vé theo lượt, xếp một ô bất kỳ, và tới lúc ra mới phát hiện đây là
   * xe tháng nên đánh dấu ô vừa mượn thành ô giữ chỗ tháng — sai cả ô lẫn tiền.
   *
   * Nên chặn ngay tại cổng vào và yêu cầu staff chuyển sang quét QR.
   */
  const [monthlyNeedsQr, setMonthlyNeedsQr] = useState<
    { plate: string; code: string; slotCode: string; expiry: string } | null
  >(null);

  /** Xe tra ở cổng ra nhưng vé thuộc bãi khác — không cho ra tại đây. */
  const [wrongLotExit, setWrongLotExit] = useState<
    { plate: string; lot: string; ticketCode: string } | null
  >(null);

  // Đồng hồ THỜI GIAN THỰC (tick mỗi giây) cho overlay camera, thời gian ra,
  // tổng thời gian và tiền — như bảng điện tử ở cổng bãi xe thật.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState('');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrError, setOcrError] = useState('');
  const [lastSnapshot, setLastSnapshot] = useState<string>('');
  // Which engine produced the last result + its confidence, and whether the
  // local PaddleOCR service answered its health ping (null = still checking).
  const [ocrEngine, setOcrEngine] = useState<OcrEngine | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [paddleOnline, setPaddleOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkOcrHealth().then((ok) => { if (!cancelled) setPaddleOnline(ok); });
    return () => { cancelled = true; };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamActive(false);
    setWebcamError('');
    setOcrStatus('idle');
    setLastSnapshot('');
  }, []);

  // Switching between the Entry and Exit OCR screens tears down the previous
  // screen's camera session — each screen starts fresh, like a separate station.
  useEffect(() => {
    stopWebcam();
    setPlate('');
    setOcrConfidence(null);
  }, [activeDirection, stopWebcam]);

  const startWebcam = async () => {
    setWebcamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWebcamError(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? 'Trình duyệt chưa cấp quyền camera. Vui lòng cho phép trong cài đặt.'
          : `Không mở được webcam: ${msg}`,
      );
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopWebcam(), [stopWebcam]);

  // Returns what it captured/read so the automated RFID pipeline can reuse it —
  // the manual "Chụp & OCR" button just calls this and ignores the return value.
  const captureAndOCR = async (): Promise<{ image: string; plate: string }> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Check the stream ref, not webcamActive state — the RFID pipeline may have
    // just auto-started the camera and state hasn't re-rendered into this closure.
    if (!video || !canvas || !streamRef.current) return { image: '', plate: '' };

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { image: '', plate: '' };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    setLastSnapshot(dataUrl);

    setOcrStatus('scanning');
    setOcrError('');

    try {
      const result = await readLicensePlateEx(base64, 'image/jpeg');
      setOcrEngine(result.engine);
      setOcrConfidence(result.confidence);
      if (result.plate) {
        setPlate(result.plate);
        setOcrStatus('done');
        // ĐỌC RA BIỂN XE THÁNG THÌ BÁO NGAY, bất kể đọc bằng đường nào.
        //
        // Đặt ở đây chứ không chỉ trong luồng quẹt thẻ: nhân viên bấm "Chụp &
        // OCR" tay cũng phải thấy cảnh báo, vì cái quyết định "xe này phải đi
        // bằng QR" nằm ở BIỂN SỐ chứ không nằm ở chuyện có quẹt thẻ hay không.
        const monthly = findActiveMonthlyReservation(result.plate, reservations);
        if (monthly) {
          setMonthlyNeedsQr({
            plate: result.plate,
            code: monthly.reservationCode,
            slotCode: monthly.slotCode || '',
            expiry: addOneMonth(monthly.date.split('T')[0]),
          });
        } else {
          // Chụp lại ra một biển KHÁC và không phải xe tháng → xoá cảnh báo cũ.
          // Không xoá thì băng hồng của chiếc xe trước còn treo trên màn hình và
          // khoá luôn nút "Thu tiền & Mở cổng" của chiếc xe đang đứng ở cổng.
          setMonthlyNeedsQr(null);
        }
        return { image: dataUrl, plate: result.plate };
      } else {
        setOcrStatus('no_plate');
        return { image: dataUrl, plate: '' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOcrError(msg);
      setOcrStatus('error');
      return { image: dataUrl, plate: '' };
    }
  };

  // ── Phiên gửi xe (vé) — như bãi xe thật ────────────────────────────────────
  // Vào cổng: mở vé (parking session) trong DB. Ra cổng: tra vé theo biển số,
  // tính tiền theo giờ, đóng vé khi xác nhận.
  const [exitSession, setExitSession] = useState<ParkingSession | null>(null);
  // Bản ghi quét LÚC VÀO của cùng thẻ — ảnh + biển số chụp ở cổng vào, dùng
  // đối soát khi xe ra.
  const [entryScan, setEntryScan] = useState<RfidScan | null>(null);

  // Xe có đặt chỗ trước khớp biển số vừa quét — hiển thị cho staff biết đây là
  // "xe đặt trước", không phải khách vãng lai.
  const [matchedReservation, setMatchedReservation] = useState<Reservation | null>(null);

  /** Mở vé cho xe vào — bỏ qua nếu biển số này đã có vé đang hoạt động.
   *  reservationSlot: có khi xe khớp một đặt chỗ trước — vé kế thừa đúng ô đỗ
   *  & phí đã chốt lúc đặt, thay vì để trống/tính lại. */
  const openEntrySession = async (
    plateVal: string,
    vehicleType: VehicleKey,
    gateId: string,
    reservationSlot?: { floor: string; area: string; slotCode: string; estimatedCost: number },
  ) => {
    try {
      const active = await fetchActiveSessions();
      // Chốt sớm phía cổng để đỡ gọi API thừa; chốt thật nằm ở backend (409
      // ALREADY_INSIDE) vì kiểm-tra-rồi-mới-ghi ở đây có kẽ hở: hai lượt quét
      // sát nhau cùng đọc thấy "chưa có vé" rồi cùng tạo vé.
      const inside = active.find((s) => normPlate(s.licensePlate) === normPlate(plateVal));
      if (inside) {
        setAlreadyInside({
          plate: plateVal,
          slotCode: inside.slotCode || '',
          checkInTime: inside.checkInTime || '',
          ticketCode: inside.ticketCode || '',
        });
        addToast?.(
          `Xe ${plateVal} đang ở trong bãi${inside.slotCode ? ` (ô ${inside.slotCode})` : ''} — không mở vé thêm lần nữa.`,
          'error',
        );
        return;
      }
      const { session, autoAssignedSlot } = await createSession(
        {
          licensePlate: plateVal,
          vehicleType,
          entryGate: gateId,
          checkInTime: localNowStr(),
          sessionStatus: 'Active',
          paymentStatus: 'Unpaid',
          ...(reservationSlot
            ? {
                floor: reservationSlot.floor,
                area: reservationSlot.area,
                slotCode: reservationSlot.slotCode,
                estimatedFee: reservationSlot.estimatedCost,
              }
            : {}),
        } as ParkingSession,
        // LUÔN gửi bãi đang phụ trách — không chỉ khi cần backend tự chọn ô.
        // Backend ghi giá trị này lên chính vé, nhờ đó vé vẫn quy được về đúng
        // bãi ngay cả khi bãi hết ô phù hợp và chưa xếp được ô nào.
        currentUser?.assignedParkingLot,
      );
      if (reservationSlot?.slotCode) {
        updateSlotStatus(reservationSlot.slotCode, 'Occupied').catch(() => {});
      } else if (autoAssignedSlot && session.slotCode) {
        addToast?.(`Xe vào bãi — đã xếp vào ô ${session.slotCode}.`, 'success');
      } else if (!reservationSlot) {
        addToast?.('Xe vào bãi nhưng bãi đã hết ô trống phù hợp — cần xếp ô thủ công.', 'error');
      }
    } catch (e) {
      // 409 ALREADY_INSIDE mang câu giải thích của backend (đang ở ô nào, từ
      // lúc nào) — hiện cho staff. Lỗi khác coi như mất kết nối: nhật ký ra vào
      // vẫn được ghi nên không chặn luồng cổng.
      const err = e as Error & { code?: string; session?: { ticketCode?: string; slotCode?: string; checkInTime?: string } };
      if (err?.code === 'ALREADY_INSIDE') {
        setAlreadyInside({
          plate: plateVal,
          slotCode: err.session?.slotCode || '',
          checkInTime: err.session?.checkInTime || '',
          ticketCode: err.session?.ticketCode || '',
        });
        addToast?.(err.message, 'error');
      }
    }
  };

  /**
   * Xe khớp một đặt chỗ trước → chuyển đặt chỗ sang Checked-in (nếu đang
   * Confirmed; kèm staffId để backend tự kiểm tra đúng bãi phụ trách) và mở
   * vé với đúng ô đỗ + phí đã chốt lúc đặt, thay vì coi như khách vãng lai.
   */
  const checkInReservation = async (
    matched: Reservation,
    plateVal: string,
    vehicleType: VehicleKey,
    gateId: string,
  ) => {
    // "!== 'Checked-in'" (không phải chỉ "=== 'Confirmed'") — vé tháng dao
    // động Checked-in ⇄ Completed mỗi lần ra/vào trong tháng, nên từ lần vào
    // THỨ HAI trở đi status thực tế là 'Completed' chứ không phải 'Confirmed'.
    // Trước đây chỉ xử lý đúng lần vào đầu tiên: các lần sau, status bị bỏ
    // quên ở 'Completed' trong khi phiên gửi xe mới vẫn được tạo — khiến xe
    // "biến mất" khỏi danh sách đặt chỗ Checked-in thật và bị hiểu nhầm thành
    // khách vãng lai (mất nhãn "Theo tháng" → Phí tạm tính tính sai theo giá
    // tháng thay vì luôn là 0).
    if (matched.status !== 'Checked-in') {
      try {
        await updateReservation(matched.id, { status: 'Checked-in', staffId: currentUser?.id });
        setMatchedReservation({ ...matched, status: 'Checked-in' });
      } catch {
        addToast?.('Không thể check-in đặt chỗ — bãi đỗ không thuộc phân công của bạn hoặc mất kết nối.', 'error');
      }
    } else {
      setMatchedReservation(matched);
    }
    // Báo ngay cho staff biết xe này đã trả tiền từ trước hay chưa — không
    // cần đợi nhìn lên thẻ thông tin mới biết có phải thu tiền lúc vào hay không.
    addToast?.(
      isReservationPaid(matched, payments)
        ? `Xe ${plateVal} đã thanh toán trước (${matched.reservationCode}) — không cần thu thêm lúc vào.`
        : `Xe ${plateVal} chưa thanh toán (${matched.reservationCode}) — sẽ thu phí lúc ra.`,
      isReservationPaid(matched, payments) ? 'success' : 'info',
    );
    await openEntrySession(plateVal, vehicleType, gateId, {
      floor: matched.floor,
      area: matched.area,
      slotCode: matched.slotCode,
      estimatedCost: matched.estimatedCost,
    });
  };

  /** Tra `reservations` xem biển số này có đặt chỗ trước không; nếu có thì
   *  check-in luôn. Trả về đặt chỗ đã khớp (hoặc null nếu không có). */
  const checkInIfReserved = async (
    plateVal: string,
    vehicleType: VehicleKey,
    gateId: string,
  ): Promise<Reservation | null> => {
    const matched = reservations.find(
      (r) =>
        (r.status === 'Confirmed' || r.status === 'Checked-in') &&
        normPlate(r.licensePlate) === normPlate(plateVal),
    );
    if (!matched) return null;
    await checkInReservation(matched, plateVal, vehicleType, gateId);
    return matched;
  };

  /**
   * Chốt khách vãng lai sau khi staff chọn loại xe: gắn thẻ vào biển số vừa
   * đọc rồi mở vé đúng loại xe. Rào đã mở từ lúc phát hiện, hàm này chỉ lo phần
   * hồ sơ nên chạy chậm vài giây cũng không giữ xe lại ở cổng.
   */
  const finishWalkIn = async (vehicleType: VehicleKey, auto = false) => {
    const pending = walkIn;
    if (!pending || walkInBusy) return;
    setWalkInBusy(true);
    try {
      const typeLabel = manualVehicleOptions.find((o) => o.key === vehicleType)?.label;
      // Gắn thẻ với đúng loại xe staff vừa chọn — hồ sơ xe vãng lai được backend
      // tạo mới sẽ mang loại xe này, không còn mặc định "Xe máy".
      const link = await linkRfidCard(pending.uid, pending.plate, typeLabel, currentUser?.assignedParkingLot);

      // Backend xác định đây là XE THẺ THÁNG → DỪNG HẲN luồng vãng lai.
      //
      // Chốt phía trước (monthlyByOcr) chỉ tra được thẻ tháng của BÃI STAFF ĐANG
      // PHỤ TRÁCH — `reservations` đã bị lọc theo bãi. Thẻ tháng ở bãi khác lọt
      // qua đó, và nếu chỉ báo lỗi rồi vẫn mở vé thì xe tháng vẫn vào diện vãng
      // lai như cũ. Backend biết toàn cục nên đây mới là chốt cuối.
      if (!link.ok && link.code === 'MONTHLY_CANNOT_LINK_RFID') {
        const m = findActiveMonthlyReservation(pending.plate, reservations);
        setMonthlyNeedsQr({
          plate: pending.plate,
          code: m?.reservationCode ?? '—',
          slotCode: m?.slotCode ?? '',
          expiry: m ? addOneMonth(m.date.split('T')[0]) : '—',
        });
        addToast?.(link.error ?? 'Xe thẻ tháng — phải quét mã QR thẻ tháng.', 'error');
        setAutoPipelineNote('');
        return;
      }

      if (link.ok) {
        const relook = await fetchRfidInfo(pending.uid);
        if (relook.ok === true) {
          setRfidInfo(relook.data);
          setRfidStatus('found');
          setRfidError('');
        }
      }

      onManualEntry(pending.gateId, pending.plate, vehicleType, 'entry');
      // Vẫn tra đặt chỗ trước: xe có thể đã đặt chỗ mà chưa gắn thẻ RFID.
      const matched = await checkInIfReserved(pending.plate, vehicleType, pending.gateId);
      if (!matched) await openEntrySession(pending.plate, vehicleType, pending.gateId);

      // MỞ RÀO Ở ĐÂY — sau khi đã chốt loại xe, gắn thẻ và mở vé xong.
      sendGateCommand(pending.gateId, 'open');

      const typeText = typeLabel ?? vehicleType;
      addToast?.(
        link.ok
          ? `Khách vãng lai ${pending.plate} (${typeText})${auto ? ' — hết giờ chờ, chốt theo loại đang chọn' : ''} — đã gắn thẻ, mở vé & mở rào.`
          : `Khách vãng lai ${pending.plate} (${typeText}) — đã mở vé & mở rào, nhưng CHƯA gắn được thẻ (${link.error ?? 'lỗi liên kết'}).`,
        link.ok ? 'success' : 'error',
      );
      setAutoPipelineNote('');
    } finally {
      setWalkInBusy(false);
      setWalkIn(null);
    }
  };

  // Đếm ngược của hộp thoại khách vãng lai; hết giờ thì tự chốt theo loại xe
  // đang chọn ở ô "Loại phương tiện" để xe trong bãi luôn có vé.
  useEffect(() => {
    if (!walkIn) return;
    const t = setInterval(() => {
      setWalkInSeconds((s) => {
        if (s <= 1) { void finishWalkIn(manualType, true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [walkIn, manualType]);

  const handleManualSubmit = async () => {
    if (!plate.trim()) return;
    const plateErr = validateLicensePlate(plate);
    if (plateErr) { alert(plateErr); return; }
    const plateVal = plate.trim().toUpperCase();
    if (activeDirection === 'entry') {
      onManualEntry(gate.id, plateVal, manualType, activeDirection);
      // TRA ĐẶT CHỖ TRƯỚC, y như đường quẹt thẻ RFID.
      //
      // Trước đây nhánh nhập tay gọi thẳng openEntrySession nên đặt chỗ đã xác
      // nhận bị bỏ qua hoàn toàn: xe được mở một vé VÃNG LAI ở một ô khác, còn
      // đơn đặt chỗ vẫn treo ở 'Confirmed' và vẫn giữ ô đã đặt. Kết quả là một
      // chiếc xe sinh ra HAI dòng trong lịch sử và chiếm HAI ô đỗ.
      const matched = await checkInIfReserved(plateVal, manualType, gate.id);
      if (!matched) await openEntrySession(plateVal, manualType, gate.id);
      addToast?.(
        matched
          ? `Đã check-in đặt chỗ ${matched.reservationCode} cho xe ${plateVal} — ô ${matched.slotCode || '—'}.`
          : `Đã xác nhận cho xe ${plateVal} vào cổng.`,
        'success',
      );
    } else if (await closeExitSession()) {
      // Cũng như nhánh RFID: chỉ ghi nhật ký SAU khi vé đóng được thật.
      onManualEntry(gate.id, plateVal, manualType, activeDirection);
      addToast?.(
        dueAmount != null
          ? `Đã thu ${formatCurrency(dueAmount)} & ghi nhận xe ${plateVal} ra cổng.`
          : `Đã ghi nhận xe ${plateVal} ra cổng.`,
        'success',
      );
    } else {
      if (!exitSession && !matchedRes) {
        addToast?.(
          `Xe ${plateVal} không có vé đang mở trong bãi — có thể đã ra rồi hoặc chưa từng vào. Không cho ra lần nữa.`,
          'error',
        );
      }
      return; // giữ nguyên màn hình để staff kiểm tra lại, không xóa trắng form
    }
    handleRefresh();
  };

  const handleRefresh = () => {
    setAlreadyInside(null);
    setMonthlyNeedsQr(null);
    setWrongLotExit(null);
    setPlate('');
    setOcrStatus('idle');
    setOcrError('');
    setLastSnapshot('');
    setOcrConfidence(null);
    resetRfid();
    resetQr();
  };

  // ---- RFID verification ----
  const [rfidInput, setRfidInput] = useState('');
  const [rfidStatus, setRfidStatus] = useState<RfidStatus>('idle');
  const [rfidError, setRfidError] = useState('');
  const [rfidInfo, setRfidInfo] = useState<RfidInfo | null>(null);
  const [linkPlate, setLinkPlate] = useState('');
  const [linking, setLinking] = useState(false);
  const [autoPipelineNote, setAutoPipelineNote] = useState('');

  const resetRfid = () => {
    setRfidInput('');
    setRfidStatus('idle');
    setRfidError('');
    setRfidInfo(null);
    setLinkPlate('');
    setAutoPipelineNote('');
    setEntryScan(null);
    setMatchedReservation(null);
  };

  // Trạm xe ra: chỉ tra vé khi CAMERA đã đọc được biển số (hoặc staff nhập
  // tay) — không hiển thị trước thông tin từ thẻ khi chưa đối soát được biển.
  const exitPlate = activeDirection === 'exit' ? plate.trim() : '';

  useEffect(() => {
    let cancelled = false;
    if (!exitPlate) {
      setExitSession(null);
      return;
    }
    fetchActiveSessions()
      .then((list) => {
        if (cancelled) return;
        const hit = list.find((s) => normPlate(s.licensePlate) === normPlate(exitPlate));
        // VÀO BÃI NÀO RA BÃI ĐÓ. fetchActiveSessions trả vé của TOÀN HỆ THỐNG,
        // nên tra theo biển số thôi là nhân viên bãi B lôi được vé của bãi A ra.
        //
        // VẪN nạp vé để staff nhìn thấy xe này đang ở đâu, vé nào — giấu đi thì
        // họ không hiểu vì sao không thao tác được. Nhưng đánh dấu `wrongLotExit`
        // để KHOÁ nút "Thu tiền — Xác nhận & Mở cổng".
        setExitSession(hit ?? null);
        setWrongLotExit(
          hit && hit.parkingLot && !sameLot(hit.parkingLot, currentUser?.assignedParkingLot)
            ? { plate: hit.licensePlate, lot: hit.parkingLot, ticketCode: hit.ticketCode }
            : null,
        );
      })
      .catch(() => { if (!cancelled) setExitSession(null); });
    return () => { cancelled = true; };
  }, [exitPlate, currentUser?.assignedParkingLot]);

  // Xe ra + thẻ hợp lệ → nạp bản ghi quét lúc vào (ảnh + biển số) để đối soát.
  useEffect(() => {
    let cancelled = false;
    if (activeDirection !== 'exit' || rfidStatus !== 'found' || !rfidInfo) {
      setEntryScan(null);
      return;
    }
    fetchRfidScans(20, rfidInfo.rfidUid)
      .then((list) => {
        if (cancelled) return;
        setEntryScan(list.find((s) => s.direction === 'entry' && (s.imageData || s.licensePlate)) ?? null);
      })
      .catch(() => { if (!cancelled) setEntryScan(null); });
    return () => { cancelled = true; };
  }, [activeDirection, rfidStatus, rfidInfo]);

  // Trigger: RFID card tapped — manually (UID typed) or pushed by the Arduino
  // reader over the backend's IoT relay. Runs the full automated pipeline —
  //   1) Initial Save        → POST /api/rfid-scans
  //   2) Auto-Capture & OCR  → captureAndOCR() (PaddleOCR) if the camera is on
  //   3) UI auto-fill        → OCR'd plate lands in the recognition card
  //   4) Final Data Link     → PATCH the scan row with photo + plate + vehicle
  const runRfidPipeline = async (
    uid: string,
    opts?: { gateId?: string; direction?: ScanDirection; source?: 'manual' | 'iot' },
  ) => {
    if (!uid) return;
    const fromIot = opts?.source === 'iot';
    setRfidStatus('scanning');
    setRfidError('');
    setRfidInfo(null);
    setAutoPipelineNote(fromIot ? '📡 Thẻ quét từ đầu đọc IoT — đang xử lý...' : '');

    // Chụp ảnh NGAY — không đợi lưu DB xong mới chụp. Camera chưa bật thì tự
    // bật rồi chờ khung hình đầu tiên; staff không phải bấm gì thêm.
    const capturePromise = (async (): Promise<{ image: string; plate: string }> => {
      let camReady = Boolean(streamRef.current);
      if (!camReady) {
        setAutoPipelineNote(`${fromIot ? '📡 ' : ''}Đang tự bật camera để chụp biển số...`);
        await startWebcam();
        const t0 = Date.now();
        while (Date.now() - t0 < 4000) {
          const v = videoRef.current;
          if (streamRef.current && v && v.videoWidth > 0) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        camReady = Boolean(streamRef.current && videoRef.current && videoRef.current.videoWidth > 0);
      }
      if (camReady) setAutoPipelineNote('Đang tự động chụp ảnh & nhận diện biển số...');
      return camReady ? captureAndOCR() : { image: '', plate: '' };
    })();

    // Lưu lượt quét + tra thẻ chạy SONG SONG với chụp/OCR — tổng thời gian chỉ
    // bằng bước chậm nhất thay vì cộng dồn tuần tự.
    const [{ image, plate: ocrPlate }, scanRecord, lookupResult] = await Promise.all([
      capturePromise,
      createRfidScan({
        rfidUid: uid,
        gateId: opts?.gateId || gate.id,
        direction: opts?.direction ?? activeDirection,
        scannedById: currentUser?.id ?? '',
        scannedByName: currentUser?.fullName ?? '',
      }),
      fetchRfidInfo(uid),
    ]);

    // Thẻ trắng + biển số OCR khớp xe đã đặt chỗ → tự liên kết thẻ với xe đó
    // và mở rào luôn, như cổng tự động ở bãi xe thật.
    let finalLookup = lookupResult;
    let autoHandledEntry = false; // nhánh tự liên kết đã mở cổng rồi thì thôi
    if (finalLookup.ok === false && ocrPlate) {
      const matchedBooking = reservations.find(
        (r) =>
          (r.status === 'Confirmed' || r.status === 'Checked-in') &&
          normPlate(r.licensePlate) === normPlate(ocrPlate),
      );
      if (matchedBooking) {
        setAutoPipelineNote(`Biển số ${ocrPlate} khớp đặt chỗ ${matchedBooking.reservationCode} — đang liên kết thẻ...`);
        const link = await linkRfidCard(
          uid,
          matchedBooking.licensePlate,
          manualVehicleOptions.find((o) => o.key === matchedBooking.vehicleType)?.label,
          currentUser?.assignedParkingLot,
        );
        if (link.ok) {
          const relook = await fetchRfidInfo(uid);
          if (relook.ok === true) {
            finalLookup = relook;
            const gid = opts?.gateId || gate.id;
            const dirNow = opts?.direction ?? activeDirection;

            // CHỈ CHIỀU VÀO ĐƯỢC TỰ MỞ RÀO.
            //
            // Trước đây lệnh mở rào nằm ngoài mọi kiểm tra chiều, chỉ riêng
            // check-in mới bọc trong `=== 'entry'`. Nên ở CỔNG RA, một thẻ chưa
            // liên kết mà camera đọc ra biển trùng với đơn đặt chỗ đang mở là
            // servo bật lên ngay lúc quẹt — xe ra khỏi bãi trước khi staff kịp
            // thu tiền, và vé thì vẫn còn mở trong hệ thống.
            //
            // Rào cổng ra chỉ được mở ở đúng một chỗ: handleRfidConfirm(), sau
            // khi closeExitSession() chốt phí và đóng vé thành công.
            if (dirNow === 'entry') {
              sendGateCommand(gid, 'open');
            }
            onRfidVerified(
              gid,
              dirNow,
              relook.data.vehicle.licensePlate,
              labelToVehicleKey(relook.data.vehicle.vehicleType),
              relook.data.owner.fullName || 'Chủ thẻ RFID',
              uid,
            );
            if (dirNow === 'entry') {
              await checkInReservation(
                matchedBooking,
                relook.data.vehicle.licensePlate,
                labelToVehicleKey(relook.data.vehicle.vehicleType),
                gid,
              );
              autoHandledEntry = true;
            }
            addToast?.(
              dirNow === 'entry'
                ? `Thẻ đã tự liên kết với xe ${matchedBooking.licensePlate} (đặt chỗ ${matchedBooking.reservationCode}) — đã mở rào & check-in.`
                : `Thẻ đã tự liên kết với xe ${matchedBooking.licensePlate} — CHƯA mở rào. Bấm "Thu tiền — Xác nhận & Mở cổng" để cho xe ra.`,
              'success',
            );
          }
        }
      }
    }

    if (finalLookup.ok === true) {
      setRfidInfo(finalLookup.data);
      setRfidStatus('found');
      const dir = opts?.direction ?? activeDirection;
      // Xe ra: KHÔNG tự điền biển số từ thẻ — biển số phải do camera đọc được
      // (hoặc staff nhập tay) rồi đối soát với thẻ thì thông tin mới hiện.
      // CỔNG VÀO TỰ ĐỘNG: thẻ hợp lệ → mở cổng + ghi nhật ký + mở vé ngay,
      // không cần staff bấm xác nhận (đã auto-open ở nhánh tự liên kết ở trên,
      // nhánh này xử lý thẻ ĐÃ liên kết sẵn).
      if (dir === 'entry' && !autoHandledEntry) {
        const gid = opts?.gateId || gate.id;
        const cardPlate = finalLookup.data.vehicle.licensePlate;

        // XE ĐÃ Ở TRONG BÃI → dừng NGAY, trước khi mở rào và trước khi ghi
        // nhật ký. Trước đây thứ tự ngược lại: rào mở + nhật ký ghi "GRANTED —
        // xe vào", rồi openEntrySession mới phát hiện xe đã ở trong và từ chối.
        // Hậu quả mỗi lần quẹt lại: rào mở cho một chiếc xe đang đỗ, và nhật ký
        // ghi thêm một lượt vào không có thật.
        const active = await fetchActiveSessions().catch(() => []);
        const inside = active.find((s) => normPlate(s.licensePlate) === normPlate(cardPlate));
        const monthly = findActiveMonthlyReservation(cardPlate, reservations);
        if (inside) {
          setAlreadyInside({
            plate: cardPlate,
            slotCode: inside.slotCode || '',
            checkInTime: inside.checkInTime || '',
            ticketCode: inside.ticketCode || '',
          });
          addToast?.(
            `Xe ${cardPlate} đang ở trong bãi${inside.slotCode ? ` (ô ${inside.slotCode})` : ''} — không mở rào.`,
            'error',
          );
        } else if (monthly) {
          // Xe thẻ tháng phải vào bằng QR — không mở rào ở luồng RFID.
          setMonthlyNeedsQr({
            plate: cardPlate,
            code: monthly.reservationCode,
            slotCode: monthly.slotCode || '',
            expiry: addOneMonth(monthly.date.split('T')[0]),
          });
          addToast?.(`Xe ${cardPlate} là XE THẺ THÁNG — hãy quét mã QR thẻ tháng, không mở rào bằng thẻ RFID.`, 'error');
        } else if (!ocrPlate) {
          // CHƯA ĐỌC ĐƯỢC BIỂN SỐ → chưa mở rào.
          //
          // Trước đây nhánh này tin hoàn toàn vào biển ghi trên thẻ: quẹt phát
          // là mở cổng, camera đọc được hay không cũng mặc kệ. Thẻ đưa nhầm xe,
          // hoặc thẻ gắn với biển cũ, đều lọt qua mà không ai đối soát được.
          // Cổng RA đã bắt buộc có biển camera từ trước; cổng VÀO nay theo cùng
          // quy tắc đó.
          setAutoPipelineNote(
            `Thẻ hợp lệ (${cardPlate}) — đang chờ camera đọc biển số để đối soát. Bấm "Chụp & OCR" nếu cần quét lại.`,
          );
          addToast?.(`Thẻ hợp lệ nhưng CHƯA đọc được biển số — chưa mở rào, hãy quét biển số.`, 'error');
        } else if (normPlate(ocrPlate) !== normPlate(cardPlate)) {
          // Camera đọc ra một biển KHÁC biển đã gắn với thẻ — không tự mở rào,
          // để staff kiểm tra xem có phải thẻ bị đưa nhầm xe không.
          setAutoPipelineNote(
            `Biển camera đọc (${ocrPlate}) KHÁC biển đã gắn với thẻ (${cardPlate}) — chưa mở rào, kiểm tra lại xe.`,
          );
          addToast?.(`Biển số ${ocrPlate} khác biển đã gắn với thẻ (${cardPlate}) — chưa mở rào.`, 'error');
        } else {
          sendGateCommand(gid, 'open');
          onRfidVerified(
            gid,
            dir,
            cardPlate,
            labelToVehicleKey(finalLookup.data.vehicle.vehicleType),
            finalLookup.data.owner.fullName || 'Chủ thẻ RFID',
            uid,
          );
          const vKey = labelToVehicleKey(finalLookup.data.vehicle.vehicleType);
          const matched = await checkInIfReserved(cardPlate, vKey, gid);
          if (!matched) openEntrySession(cardPlate, vKey, gid);
        }
      }
    } else {
      setRfidError(finalLookup.error);
      setRfidStatus('not_found');
      // Biển số OCR được thì điền sẵn vào ô "Liên kết biển số" — staff chỉ
      // cần liếc xác nhận rồi bấm Liên kết, khỏi gõ tay.
      if (ocrPlate) setLinkPlate(ocrPlate);

      // XE CHƯA LIÊN KẾT TÀI KHOẢN vẫn được vào bãi diện KHÁCH VÃNG LAI, miễn
      // camera đọc được biển số hợp lệ. Trước đây nhánh này chỉ điền sẵn ô
      // "Liên kết biển số" rồi dừng: rào không mở, không mở vé, nên xe lạ bắt
      // buộc phải gắn thẻ vào một tài khoản mới qua cổng được.
      const dir = opts?.direction ?? activeDirection;

      // THẺ TRẮNG NHƯNG BIỂN SỐ LÀ XE THÁNG — đây chính là tình huống báo lỗi:
      // camera đọc ra biển của khách tháng, thẻ thì chưa liên kết, nên luồng bên
      // dưới coi là khách vãng lai, mở rào và mở vé theo lượt. Chặn trước.
      const monthlyByOcr = ocrPlate ? findActiveMonthlyReservation(ocrPlate, reservations) : undefined;
      // XE THÁNG THÌ CẢ HAI CHIỀU đều phải đi bằng QR.
      //
      // Trước đây nhánh này còn kèm `dir === 'entry'`, nên ở CỔNG RA màn hình
      // rơi thẳng xuống ô "Thẻ chưa được liên kết với phương tiện nào" và mời
      // nhân viên gắn thẻ RFID cho chính chiếc xe tháng — đúng thứ không được
      // phép làm. Gắn được thì lượt sau xe tháng vào bãi diện vãng lai và mất ô
      // riêng; không gắn được thì nhân viên vẫn phải mò mới biết vì sao.
      if (monthlyByOcr) {
        setMonthlyNeedsQr({
          plate: ocrPlate,
          code: monthlyByOcr.reservationCode,
          slotCode: monthlyByOcr.slotCode || '',
          expiry: addOneMonth(monthlyByOcr.date.split('T')[0]),
        });
        addToast?.(
          dir === 'entry'
            ? `Xe ${ocrPlate} là XE THẺ THÁNG — hãy quét mã QR thẻ tháng, không mở rào bằng thẻ RFID.`
            : `Xe ${ocrPlate} là XE THẺ THÁNG — hãy quét mã QR thẻ tháng để cho ra, không dùng thẻ RFID.`,
          'error',
        );
      } else if (dir === 'entry' && ocrPlate && !validateLicensePlate(ocrPlate)) {
        const gid = opts?.gateId || gate.id;

        // CHƯA mở rào. Rào chỉ mở SAU KHI staff chọn loại xe (finishWalkIn).
        //
        // Loại xe quyết định cỡ ô đỗ và bảng giá, nên phải chốt trước khi cho xe
        // vào — mở rào rồi mới hỏi thì xe đã lăn bánh vào bãi mà hệ thống chưa
        // biết xếp nó vào đâu và thu bao nhiêu.
        setAutoPipelineNote(`Khách vãng lai ${ocrPlate} — chọn loại xe để mở rào & mở vé.`);
        setWalkIn({ plate: ocrPlate, uid, gateId: gid });
        setWalkInSeconds(WALKIN_FALLBACK_SECONDS);
        addToast?.(`Khách vãng lai ${ocrPlate} — hãy chọn loại xe để mở rào.`, 'info');
      }
    }

    const matchedVehicleId = finalLookup.ok === true ? finalLookup.data.vehicle.id : '';
    if (scanRecord) {
      updateRfidScan(scanRecord.id, {
        imageData: image || undefined,
        licensePlate: ocrPlate || undefined,
        vehicleId: matchedVehicleId || undefined,
      }).catch(() => {});
    }

    const prefix = fromIot ? '📡 ' : '';
    setAutoPipelineNote(
      !scanRecord
        ? `${prefix}Không lưu được lượt quét vào hệ thống — kiểm tra kết nối backend.`
        : ocrPlate
          ? `${prefix}Đã nhận diện biển số "${ocrPlate}" & lưu vào hồ sơ lượt quét.`
          : image
            ? `${prefix}Đã lưu lượt quét, nhưng không đọc được biển số từ camera.`
            : `${prefix}Đã lưu lượt quét — không bật được camera (kiểm tra quyền camera của trình duyệt).`,
    );
  };

  const handleRfidScan = () => runRfidPipeline(rfidInput.trim());

  // ── IoT bridge: Arduino tap → auto pipeline ────────────────────────────────
  const runPipelineRef = useRef(runRfidPipeline);
  useEffect(() => { runPipelineRef.current = runRfidPipeline; });
  const rfidBusyRef = useRef(false);
  useEffect(() => { rfidBusyRef.current = rfidStatus === 'scanning'; }, [rfidStatus]);

  useEffect(() => {
    const unsubscribe = subscribeToRfidTaps((tap) => {
      if (rfidBusyRef.current) return;
      setRfidInput(tap.rfidUid);
      runPipelineRef.current(tap.rfidUid, {
        gateId: tap.gateId || undefined,
        direction: tap.direction,
        source: 'iot',
      });
    });
    return unsubscribe;
  }, []);

  // Nút "Xác nhận & Mở cổng" chỉ còn render cho chiều RA (chiều vào đã tự động
  // hoàn toàn ở runRfidPipeline — xem "CỔNG VÀO TỰ ĐỘNG" phía trên).
  const handleRfidConfirm = async () => {
    if (!rfidInfo) return;
    // Xe ra: chốt phí, đóng vé/hoàn tất đặt chỗ, trả ô đỗ, trả thẻ về trạng
    // thái trắng — và đẩy lệnh mở rào xuống ESP32 thật (rào cổng ra chỉ mở
    // SAU khi staff xác nhận thu tiền).
    //
    // ĐÓNG VÉ TRƯỚC, ghi nhật ký sau. Trước đây onRfidVerified() chạy ngay dòng
    // đầu nên nhật ký ghi "RA — Thành công" bất kể vé có đóng được hay không;
    // xe bị server từ chối vẫn để lại một dòng ra thành công giả trong sổ.
    const closed = await closeExitSession(rfidInfo.rfidUid);
    if (!closed) {
      // Vé không đóng được: sai bãi, đã ra rồi, hoặc không có vé đang mở.
      // KHÔNG mở rào và KHÔNG ghi nhật ký — closeExitSession đã báo lý do.
      if (!exitSession && !matchedRes) {
        addToast?.(
          `Xe ${rfidInfo.vehicle.licensePlate} không có vé đang mở trong bãi — có thể đã ra rồi. Không mở cổng.`,
          'error',
        );
      }
      return;
    }
    onRfidVerified(
      gate.id,
      'exit',
      rfidInfo.vehicle.licensePlate,
      labelToVehicleKey(rfidInfo.vehicle.vehicleType),
      rfidInfo.owner.fullName || 'Chủ thẻ RFID',
      rfidInfo.rfidUid,
      dueAmount,
    );
    sendGateCommand(gate.id, 'open');
    addToast?.(
      dueAmount != null
        ? `Đã thu ${formatCurrency(dueAmount)}, mở cổng cho xe ${rfidInfo.vehicle.licensePlate} ra & gỡ liên kết thẻ.`
        : `Đã mở cổng cho xe ${rfidInfo.vehicle.licensePlate} ra & gỡ liên kết thẻ.`,
      'success',
    );
    resetRfid();
  };

  const handleLinkCard = async () => {
    const uid = rfidInput.trim();
    if (!uid || !linkPlate.trim()) return;
    const plateErr = validateLicensePlate(linkPlate);
    if (plateErr) { setRfidError(plateErr); return; }
    setLinking(true);
    const result = await linkRfidCard(
      uid,
      linkPlate.trim().toUpperCase(),
      manualVehicleOptions.find((o) => o.key === manualType)?.label,
      currentUser?.assignedParkingLot,
    );
    setLinking(false);
    if (result.ok) {
      if (result.created) {
        addToast?.(`Chưa có hồ sơ cho biển số này — đã tạo hồ sơ xe vãng lai & liên kết thẻ.`, 'success');
      }
      await runRfidPipeline(uid);
    } else {
      setRfidError(result.error ?? 'Không thể liên kết thẻ.');
    }
  };

  // ── Quét QR thẻ tháng ───────────────────────────────────────────────────────
  // Khách gửi tháng đưa mã QR (màn hình "Lịch sử đặt chỗ") vào camera; hoặc
  // staff dán nội dung mã vào ô nhập khi dùng đầu quét QR rời (bắn chuỗi).
  const [qrScanning, setQrScanning] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [qrResult, setQrResult] = useState<QrResult | null>(null);
  const qrTimersRef = useRef<{ interval?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> }>({});

  const stopQrScan = useCallback(() => {
    if (qrTimersRef.current.interval) clearInterval(qrTimersRef.current.interval);
    if (qrTimersRef.current.timeout) clearTimeout(qrTimersRef.current.timeout);
    qrTimersRef.current = {};
    setQrScanning(false);
  }, []);

  const resetQr = useCallback(() => {
    stopQrScan();
    setQrInput('');
    setQrResult(null);
  }, [stopQrScan]);

  useEffect(() => () => stopQrScan(), [stopQrScan]);

  // Đổi trạm Vào/Ra → phiên quét QR cũ không còn ý nghĩa
  useEffect(() => {
    resetQr();
  }, [activeDirection, resetQr]);

  const verifyMonthlyQr = useCallback((text: string) => {
    stopQrScan();
    const parsed = parseMonthlyQr(text);
    if (!parsed) {
      setQrResult({ ok: false, reason: 'Mã QR không đúng định dạng thẻ tháng ParkFlow.' });
      return;
    }
    // reservations đã được lọc theo bãi staff phụ trách — thẻ tháng của bãi
    // khác sẽ không tra ra ở đây (đúng nguyên tắc cô lập theo bãi).
    const res = reservations.find((r) => r.reservationCode === parsed.code);
    if (!res) {
      setQrResult({ ok: false, reason: `Không tìm thấy thẻ tháng ${parsed.code} trong bãi này — kiểm tra khách có đăng ký ở bãi khác không.` });
      return;
    }
    if (res.note !== 'Theo tháng') {
      setQrResult({ ok: false, reason: `${parsed.code} là đặt chỗ thường, không phải thẻ gửi tháng.` });
      return;
    }
    if (res.status === 'Cancelled' || res.status === 'Expired') {
      setQrResult({ ok: false, reason: `Thẻ tháng ${parsed.code} đã bị ${res.status === 'Cancelled' ? 'hủy' : 'đánh dấu hết hạn'}.` });
      return;
    }
    if (normPlate(res.licensePlate) !== normPlate(parsed.plate)) {
      setQrResult({ ok: false, reason: `Biển số trên QR (${parsed.plate}) không khớp hồ sơ đăng ký (${res.licensePlate}).` });
      return;
    }
    const start = res.date.split('T')[0];
    const end = addOneMonth(res.date);
    const today = todayLocal();
    if (today < start) {
      setQrResult({ ok: false, reason: `Thẻ tháng chưa có hiệu lực — bắt đầu từ ngày ${start}.` });
      return;
    }
    if (today > end) {
      setQrResult({ ok: false, reason: `Thẻ tháng đã hết hạn ngày ${end}. Hướng dẫn khách gia hạn ở mục Đặt chỗ.` });
      return;
    }
    const daysLeft = Math.max(0, Math.round((new Date(end).getTime() - new Date(today).getTime()) / 86_400_000));
    setQrResult({ ok: true, res, start, end, daysLeft });
  }, [reservations, stopQrScan]);

  // Quét liên tục khung hình webcam (~2.5 fps) tới khi jsQR bắt được mã hoặc
  // hết 20 giây. Dùng canvas riêng để không giẫm lên canvas chụp OCR.
  const startQrScan = async () => {
    setQrResult(null);
    setQrInput('');
    if (!webcamActive) await startWebcam();
    setQrScanning(true);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    qrTimersRef.current.interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !ctx || !video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(img.data, img.width, img.height);
      if (found?.data) {
        setQrInput(found.data);
        verifyMonthlyQr(found.data);
      }
    }, 400);
    qrTimersRef.current.timeout = setTimeout(() => {
      stopQrScan();
      setQrResult({ ok: false, reason: 'Không bắt được mã QR sau 20 giây — đưa mã lại gần camera rồi quét lại.' });
    }, 20_000);
  };

  // Thẻ hợp lệ → check-in/check-out đặt chỗ tháng THẬT trong DB (trước đây chỗ
  // này chỉ ghi nhật ký cục bộ + mở rào, không hề tạo phiên gửi xe hay chuyển
  // đặt chỗ sang Checked-in, nên "Theo dõi bãi xe" và trang của driver không
  // bao giờ thấy xe tháng đã vào bãi) + đẩy lệnh mở rào xuống hàng đợi ESP32 thật.
  const handleQrConfirm = async () => {
    if (!qrResult?.ok) return;
    const { res } = qrResult;
    if (activeDirection === 'entry') {
      await checkInReservation(res, res.licensePlate, res.vehicleType, gate.id);
      // Ô của thẻ tháng nằm ở trạng thái 'Locked' giữa hai lần vào (giữ riêng
      // cho khách suốt tháng). openEntrySession chỉ đánh dấu Occupied khi nó
      // thật sự mở được vé mới; nếu vé đã có sẵn thì ô kẹt ở 'Locked' và sơ đồ
      // không hiện xe, dù danh sách "Xe đang đỗ trong bãi" vẫn có. Ghi lại một
      // lần nữa ở đây cho chắc — updateSlotStatus là thao tác không đổi kết quả
      // khi lặp lại.
      if (res.slotCode) updateSlotStatus(res.slotCode, 'Occupied').catch(() => {});
    } else {
      // Xe tháng ra: đóng phiên gửi xe đang hoạt động (nếu có) + hoàn tất đặt
      // chỗ — không thu thêm phí (đã bao trong gói tháng). Ô đỗ trả về
      // "Locked" (hiển thị "Xe tháng" trên sơ đồ), KHÔNG phải "Available" —
      // ô này vẫn đang giữ riêng cho khách suốt tháng, xe ra ăn trưa/về nhà
      // không có nghĩa ai khác được đặt/đỗ vào đó. Chỉ về Available thật khi
      // thẻ bị hủy hoặc hết hạn.
      try {
        const active = await fetchActiveSessions();
        const activeSession = active.find(
          (s) => s.sessionStatus === 'Active' && normPlate(s.licensePlate) === normPlate(res.licensePlate),
        );
        if (activeSession) {
          await updateSession(activeSession.id, {
            sessionStatus: 'Completed',
            paymentStatus: 'Paid',
            checkOutTime: localNowStr(),
          }).catch(() => {});
          // CHỈ ô đăng ký trên thẻ mới được giữ 'Locked'. Xe tháng vào bãi lúc
          // ô riêng đang bận (hoặc vào diện vãng lai) sẽ mượn một ô khác — ô
          // mượn đó phải trả lại cho bãi, không được đánh dấu "Xe tháng".
          if (activeSession.slotCode) {
            updateSlotStatus(
              activeSession.slotCode,
              activeSession.slotCode === res.slotCode ? 'Locked' : 'Available',
            ).catch(() => {});
          }
        }
        if (res.status === 'Checked-in') {
          await updateReservation(res.id, { status: 'Completed', staffId: currentUser?.id }).catch(() => {});
          if (res.slotCode && res.slotCode !== activeSession?.slotCode) {
            updateSlotStatus(res.slotCode, 'Locked').catch(() => {});
          }
        }
      } catch { /* backend offline — nhật ký ra vào vẫn được ghi, đồng bộ lại lần poll sau */ }
    }
    onManualEntry(gate.id, res.licensePlate, res.vehicleType, activeDirection);
    sendGateCommand(gate.id, 'open');
    addToast?.(
      `Thẻ tháng hợp lệ — đã mở rào cho xe ${res.licensePlate} ${activeDirection === 'entry' ? 'vào' : 'ra'} cổng.`,
      'success',
    );
    resetQr();
  };

  // ── Rào chắn & báo động ─────────────────────────────────────────────────────
  const [barrier, setBarrier] = useState<'open' | 'closed'>('closed');

  const handleBarrier = (cmd: 'open' | 'close') => {
    const sent = onGateCommand?.(gate.id, cmd) ?? false;
    setBarrier(cmd === 'open' ? 'open' : 'closed');
    // Push command to backend queue → ESP32 polls and controls servo
    sendGateCommand(gate.id, cmd);
    addToast?.(
      `${cmd === 'open' ? 'Đã mở rào' : 'Đã đóng rào'} tại ${gate.name}${sent ? '' : ' (thiết bị IoT chưa kết nối — trạng thái mô phỏng)'}.`,
      cmd === 'open' ? 'success' : 'info',
    );
  };

  // ── Thông tin lượt gửi cho thẻ "Biển số nhận diện" ─────────────────────────
  // Xe RA: tra lượt gửi Checked-in theo biển số → giờ vào, tổng thời gian và
  // tổng tiền (giá vé gói, cộng phụ phí quá giờ, trừ phần đã thanh toán).
  const matchedRes = useMemo(() => {
    const p = normPlate(plate);
    if (!p) return undefined;
    return reservations.find((r) => r.status === 'Checked-in' && normPlate(r.licensePlate) === p);
  }, [reservations, plate]);

  /**
   * Xe RA mang biển khác biển đã đăng ký cho thẻ.
   *
   * Thẻ có thể bị đưa nhầm sang xe khác, hoặc khách đổi xe mà quên báo. Dù lý
   * do gì, hiển thị biển đăng ký như thể mọi thứ bình thường là sai — staff cần
   * thấy biển THẬT của chiếc xe đang đứng trước rào.
   */
  /**
   * Loại khách của một lượt quét, suy từ dữ liệu đặt chỗ thật.
   *
   * Không dùng `scan.recognition` do đầu đọc gắn: nhãn đó được quyết định theo
   * từng lượt quét riêng lẻ nên cùng một xe tháng có thể lúc ra 'subscriber',
   * lúc ra 'casual' — hàng đợi khi đó hiện xe vừa là Khách tháng vừa là Khách
   * vãng lai. Thẻ tháng còn hiệu lực thì LUÔN là khách tháng.
   */
  const scanRecognitionOf = (scan: ScanEvent): RecognitionResult => {
    if (!scan.licensePlate) return 'unknown';
    if (findActiveMonthlyReservation(scan.licensePlate, reservations)) return 'subscriber';
    return scan.recognition === 'unknown' ? 'unknown' : 'casual';
  };

  /** Cổng VÀO: biển camera đọc khác biển đã gắn với thẻ → chưa được mở rào. */
  const plateMismatchEntry =
    activeDirection === 'entry' &&
    !!plate &&
    rfidStatus === 'found' &&
    !!rfidInfo &&
    normPlate(plate) !== normPlate(rfidInfo.vehicle.licensePlate);

  const plateMismatch =
    activeDirection === 'exit' &&
    !!plate &&
    rfidStatus === 'found' &&
    !!rfidInfo &&
    normPlate(plate) !== normPlate(rfidInfo.vehicle.licensePlate);

  const feeInfo = useMemo(() => {
    if (!matchedRes) return null;
    const fee = perVisitOverstay(matchedRes, pricingRules, now);
    const paid = isReservationPaid(matchedRes, payments);
    const due = fee.overstayed ? overstayDue(fee, paid) : paid ? 0 : fee.base;
    // Ưu tiên mốc check-in THẬT (staff quẹt thẻ lúc nào) — không phải khung
    // giờ dự kiến lúc đặt (matchedRes.date/startTime), vốn chỉ là kế hoạch và
    // có thể lệch xa giờ xe thực sự vào bãi (đến sớm/muộn hơn giờ đặt).
    const realCheckIn = matchedRes.checkedInAt ? new Date(matchedRes.checkedInAt.replace(' ', 'T')) : null;
    const entry =
      realCheckIn && !Number.isNaN(realCheckIn.getTime())
        ? realCheckIn
        : new Date(`${matchedRes.date.split('T')[0]}T${matchedRes.startTime.slice(0, 5)}:00`);
    return { fee, paid, due, entry: Number.isNaN(entry.getTime()) ? null : entry };
  }, [matchedRes, pricingRules, payments, now]);

  // Vé khách vãng lai (phiên gửi xe) — phí "theo lượt" là mức cố định, cộng
  // thêm giá qua đêm cho mỗi lần qua 00:00 (xem utils/reservationPricing).
  // `hours` ở đây chỉ để HIỂN THỊ thời gian đã đỗ, không dùng để tính `due`.
  const exitFee = useMemo(() => {
    if (!exitSession) return null;
    const entry = new Date(exitSession.checkInTime.replace(' ', 'T'));
    if (Number.isNaN(entry.getTime())) return null;
    const rule = pricingRules.find((p) => p.vehicleType === exitSession.vehicleType);
    const hours = Math.max(1, Math.ceil((now - entry.getTime()) / 3_600_000));
    const fee = realtimeParkingFee(exitSession.checkInTime, now, rule);
    return { entry, hours, due: fee.total, nights: fee.overstayed ? Math.round(fee.surcharge / (rule?.overnightPrice || 1)) : 0 };
  }, [exitSession, pricingRules, now]);

  // Số tiền THỰC THU khi xe ra — ưu tiên feeInfo (xe vào bằng đặt chỗ trước,
  // giá đã chốt lúc đặt + phụ phí qua đêm nếu có) hơn exitFee (xe vãng lai,
  // phí theo lượt cố định + qua đêm) — 2 nguồn khác công thức nên không trộn lẫn.
  const dueAmount = feeInfo ? feeInfo.due : exitFee ? exitFee.due : undefined;

  /**
   * Vé đang hiển thị ở cổng ra có thuộc bãi khác không.
   *
   * Suy TRỰC TIẾP từ `exitSession` đang render, không đọc cờ `wrongLotExit`.
   * Cờ đó được đặt trong một effect bất đồng bộ nên có khoảng ngắn giữa lúc OCR
   * điền biển số và lúc fetch trả về — trong khoảnh khắc đó nút vẫn xanh và bấm
   * được. Tính tại chỗ từ chính vé đang hiện thì hai thứ không thể lệch nhau:
   * đã thấy vé là đã biết vé thuộc bãi nào.
   */
  const exitLotMismatch =
    !!exitSession?.parkingLot &&
    !sameLot(exitSession.parkingLot, currentUser?.assignedParkingLot);

  /** Biển đang hiển thị có phải xe thẻ tháng còn hạn không — nguồn duy nhất
   *  cho cả băng cảnh báo lẫn khoá nút thu tiền. */
  const monthlyForPlate = useMemo(
    () => (plate.trim() ? findActiveMonthlyReservation(plate.trim(), reservations) : undefined),
    [plate, reservations],
  );

  /**
   * LÝ DO KHÔNG ĐƯỢC THU TIỀN & MỞ CỔNG — null nghĩa là hợp lệ, cho bấm.
   *
   * Gom MỌI trường hợp không hợp lệ về một chỗ để nút chỉ có đúng hai trạng
   * thái: xanh (bấm được) hoặc xám (không bấm được). Tất cả đều tính ngay tại
   * lúc render từ dữ liệu đang hiển thị — không đợi staff bấm rồi mới báo lỗi,
   * vì với thu tiền mặt thì bấm xong là đã nhận tiền của khách.
   */
  const exitBlockReason: string | null = (() => {
    // XE THÁNG KHÔNG RA BẰNG ĐƯỜNG NÀY. Thu tiền ở đây là thu sai (phí đã bao
    // trong gói tháng) và closeExitSession sẽ trả ô riêng về cho bãi. Đường
    // đúng là quét QR thẻ tháng — handleQrConfirm giữ nguyên ô và không thu phí.
    //
    // Tính LẠI từ biển số đang hiển thị, KHÔNG dựa vào state `monthlyNeedsQr`:
    // băng cảnh báo có nút "Đóng", mà bấm Đóng thì không được biến chiếc xe
    // tháng thành xe thu tiền được. Khoá phải bám vào dữ liệu, không bám vào
    // việc nhân viên đã tắt thông báo hay chưa.
    if (monthlyForPlate) {
      return `Xe ${plate.trim()} là XE THẺ THÁNG (${monthlyForPlate.reservationCode}) — phải cho ra bằng mã QR thẻ tháng, không thu tiền và không dùng thẻ RFID.`;
    }
    if (exitLotMismatch) {
      return `Sai bãi đỗ — xe đang đỗ ở ${exitSession?.parkingLot} (vé ${exitSession?.ticketCode}). Phải cho ra tại chính bãi đó.`;
    }
    if (plateMismatch) {
      return `Thẻ khác biển ban đầu — camera đọc ${plate}, thẻ đăng ký cho ${rfidInfo?.vehicle.licensePlate}. Kiểm tra lại xe trước khi cho ra.`;
    }
    if (!exitSession && !matchedRes) {
      return 'Không có vé đang mở cho biển số này — xe có thể đã ra rồi hoặc chưa từng vào bãi.';
    }
    return null;
  })();

  /** Ghi nhận hóa đơn ĐÃ THANH TOÁN cho đúng chủ xe — chỉ khi biết được chủ xe
   *  thật (qua thẻ đã liên kết hoặc đặt chỗ, không phải khách vãng lai không
   *  tài khoản) thì mới có "Thanh toán" của user để cập nhật. Tái dùng hóa đơn
   *  Unpaid đã tạo lúc đặt/vào cổng (nếu có) thay vì tạo hóa đơn trùng. */
  const recordExitPayment = async (
    userId: string,
    ticketCode: string,
    reservationCode: string | undefined,
    licensePlate: string,
    amount: number,
  ) => {
    try {
      const existing = payments?.find((p) => p.ticketCode === ticketCode && p.status !== 'Paid');
      const paidAt = localNowStr();
      if (existing) {
        await updatePayment(existing.id, { status: 'Paid', method: 'Cash', paidAt, totalAmount: amount, parkingFee: amount });
      } else {
        await createPayment({
          id: `PAY-${ticketCode}-${Date.now()}`,
          userId,
          ticketCode,
          reservationCode,
          licensePlate,
          parkingFee: amount,
          extraServiceFee: 0,
          lostTicketFee: 0,
          discount: 0,
          totalAmount: amount,
          method: 'Cash',
          status: 'Paid',
          createdAt: paidAt,
          paidAt,
        } as Payment);
      }
    } catch { /* backend offline — vé/đặt chỗ vẫn đóng, hóa đơn đồng bộ lại lần poll sau */ }
  };

  /** Đóng vé khi xe ra: chốt phí, đánh dấu đã thanh toán, trả ô đỗ, gỡ liên kết
   *  thẻ nếu có. Xe vào bằng đặt chỗ trước (đang Checked-in) thì đồng thời
   *  hoàn tất đặt chỗ đó (Completed, kèm staffId để backend kiểm tra đúng bãi)
   *  — driver nhận thông báo xe đã check-out VÀ hóa đơn "Đã thanh toán" ngay
   *  trong "Thanh toán" của họ. */
  /**
   * Cho xe ra. Trả về false nếu KHÔNG có gì để đóng — tức xe này không ở trong
   * bãi (chưa từng vào, hoặc đã ra rồi).
   *
   * Trước đây hàm này im lặng không làm gì trong trường hợp đó nhưng nơi gọi
   * vẫn báo "Đã ghi nhận xe ra cổng" — staff tưởng đã cho ra, còn hệ thống thì
   * không ghi gì. Xe ra hai lần cũng không ai biết.
   */
  const closeExitSession = async (unlinkUid?: string): Promise<boolean> => {
    const ticketCode = exitSession?.ticketCode || matchedRes?.reservationCode;
    const driverUserId = matchedRes?.userId || (rfidStatus === 'found' ? rfidInfo?.owner.id : undefined);
    const licensePlateForPayment = exitSession?.licensePlate || matchedRes?.licensePlate || plate;

    if (!exitSession && !matchedRes) return false;

    /**
     * XE THÁNG ra bãi KHÔNG được xử lý như khách vãng lai.
     *
     * Thẻ tháng còn hiệu lực nghĩa là ô đỗ vẫn thuộc về khách suốt tháng: xe về
     * nhà buổi tối rồi sáng mai quay lại, ô đó không ai được đặt vào. Trước đây
     * nhánh này trả ô về 'Available' và GỠ LUÔN liên kết thẻ RFID — sau lần ra
     * đầu tiên là khách mất trắng cả ô lẫn thẻ, đúng như báo lỗi "đăng ký xe
     * theo tháng khi ra bị mất luôn ô đăng ký tháng".
     *
     * Đường quét QR thẻ tháng (handleQrConfirm) đã làm đúng từ trước; nhánh
     * RFID này chỉ là chưa được đồng bộ theo.
     */
    const monthlyCard = findActiveMonthlyReservation(
      exitSession?.licensePlate || matchedRes?.licensePlate || plate,
      reservations,
    );
    /**
     * Chỉ giữ 'Locked' cho ĐÚNG Ô ĐÃ ĐĂNG KÝ trên thẻ tháng.
     *
     * Trước đây điều kiện chỉ là "chủ xe có thẻ tháng không", nên bất kỳ ô nào
     * chiếc xe đó đang đỗ cũng bị khoá lại khi ra. Khách tháng vào bãi diện
     * vãng lai (mượn tạm một ô khác) là ô mượn đó bị đánh dấu "Xe tháng" vĩnh
     * viễn — chính là ô LP-F1-B01 đang kẹt: không đặt chỗ nào trỏ tới nó, chỉ
     * toàn vé đã đóng, mà vẫn hiện màu thẻ tháng.
     *
     * Ô đăng ký thì giữ; ô đi mượn thì trả lại cho bãi.
     */
    const releasedStatusFor = (slotCode?: string) =>
      monthlyCard && slotCode && slotCode === monthlyCard.slotCode ? 'Locked' : 'Available';

    if (exitSession) {
      // CHỜ server trả lời rồi mới coi là đã cho ra.
      //
      // Trước đây lệnh này chạy "bắn rồi quên": hàm trả về true ngay, nên dù
      // server từ chối (403 sai bãi / 409 đã ra rồi) thì cổng vẫn mở và nhật ký
      // vẫn ghi "Thành công". Đúng hiện tượng đang gặp: xe đỗ ở bãi Nhà Văn Hóa
      // mà quẹt ra được ở Long Phước.
      try {
        await updateSession(exitSession.id, {
          sessionStatus: 'Completed',
          paymentStatus: 'Paid',
          checkOutTime: localNowStr(),
          estimatedFee: dueAmount ?? exitSession.estimatedFee,
          // Kèm staffId để backend chặn cho xe ra ở bãi khác với bãi đã vào.
          staffId: currentUser?.id,
        });
      } catch (e) {
        const err = e as Error & { code?: string; session?: { parkingLot?: string; ticketCode?: string } };
        if (err?.code === 'WRONG_LOT_EXIT') {
          setWrongLotExit({
            plate: exitSession.licensePlate,
            lot: err.session?.parkingLot || exitSession.parkingLot || '—',
            ticketCode: err.session?.ticketCode || exitSession.ticketCode,
          });
        }
        addToast?.(err?.message || 'Không thể đóng vé — vui lòng thử lại.', 'error');
        // KHÔNG trả ô, KHÔNG gỡ thẻ, KHÔNG ghi hóa đơn: server đã từ chối.
        return false;
      }
      if (exitSession.slotCode) updateSlotStatus(exitSession.slotCode, releasedStatusFor(exitSession.slotCode)).catch(() => {});
      setExitSession(null);
    }
    if (matchedRes) {
      updateReservation(matchedRes.id, { status: 'Completed', staffId: currentUser?.id }).catch(() => {});
      if (matchedRes.slotCode && matchedRes.slotCode !== exitSession?.slotCode) {
        updateSlotStatus(matchedRes.slotCode, releasedStatusFor(matchedRes.slotCode)).catch(() => {});
      }
    }
    // dueAmount > 0: có tiền THỰC THU tại cổng mới cần ghi hóa đơn mới — xe đã
    // trả trước đủ (feeInfo.due === 0) thì hóa đơn Paid cũ đã là bằng chứng rồi.
    if (driverUserId && driverUserId.toUpperCase() !== 'GUEST' && ticketCode && dueAmount != null && dueAmount > 0) {
      recordExitPayment(driverUserId, ticketCode, matchedRes?.reservationCode, licensePlateForPayment, dueAmount);
    }
    // Thẻ tháng phải GIỮ liên kết với xe suốt thời hạn — gỡ thẻ chỉ đúng với
    // thẻ mượn phát cho khách vãng lai ở cổng, thu lại khi xe ra.
    if (unlinkUid && !monthlyCard) unlinkRfidCard(unlinkUid);

    // XE ĐÃ RA → DỌN ẢNH ĐÃ LƯU TRÊN THẺ.
    //
    // Ảnh biển số chụp ở cổng chỉ phục vụ việc đối soát người–xe trong lúc xe
    // còn trong bãi. Xe ra rồi thì chúng chỉ còn là dữ liệu tồn: mỗi khung
    // base64 nặng vài trăm KB nằm thẳng trong rfid_scans.image_data, và thẻ
    // mượn quay vòng liên tục nên đống ảnh cũ cứ dồn lại mãi.
    //
    // Kèm biển số để chỉ xóa ảnh CỦA ĐÚNG XE VỪA RA — cùng một thẻ mượn có thể
    // đã phục vụ xe khác đang còn trong bãi, ảnh của xe đó phải giữ nguyên.
    // Chạy nền: xóa ảnh hỏng cũng không được cản việc mở rào cho xe ra.
    if (unlinkUid) {
      clearRfidScanImages(unlinkUid, licensePlateForPayment).catch(() => 0);
    }
    if (monthlyCard) {
      addToast?.(
        `Xe tháng ${monthlyCard.licensePlate} ra bãi — giữ nguyên thẻ và ô ${monthlyCard.slotCode || '—'} tới hết hạn ${addOneMonth(monthlyCard.date.split('T')[0])}.`,
        'info',
      );
    }
    return true;
  };

  const confidencePct =
    ocrStatus === 'done' && ocrConfidence != null ? Math.round(ocrConfidence * 100) : null;

  return (
    <div className="space-y-6">

      {/* KHÁCH VÃNG LAI — nhập thủ công loại xe. Rào đã mở, chỉ chờ chốt vé. */}
      {walkIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-800">Khách vãng lai — chọn loại xe để mở rào</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Thẻ chưa liên kết, biển số đọc được là{' '}
                  <span className="font-bold text-slate-800">{walkIn.plate}</span>.{' '}
                  <strong className="text-amber-700">Rào chưa mở</strong> — camera không nhận ra được loại xe.
                  Chọn loại xe để xếp đúng cỡ ô đỗ, tính đúng bảng giá, rồi rào mới mở.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {manualVehicleOptions.map((opt) => (
                <button
                  key={opt.key}
                  disabled={walkInBusy}
                  onClick={() => { setManualType(opt.key); void finishWalkIn(opt.key); }}
                  className="rounded-xl border-2 border-slate-200 px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                {walkInBusy
                  ? 'Đang gắn thẻ, mở vé & mở rào...'
                  : `Không chọn thì sau ${walkInSeconds}s sẽ tự chốt & mở rào theo "${manualVehicleOptions.find((o) => o.key === manualType)?.label}".`}
              </p>
              <button
                disabled={walkInBusy}
                onClick={() => void finishWalkIn(manualType)}
                className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                Dùng loại đang chọn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XE ĐÃ Ở TRONG BÃI — chặn vào lần hai, báo rõ đến khi staff tự đóng. */}
      {alreadyInside && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-4 text-rose-800">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">
              Xe {alreadyInside.plate} đã có trong bãi — không cho vào lần nữa.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-rose-700">
              {alreadyInside.slotCode ? <>Đang đỗ tại ô <strong className="font-mono">{alreadyInside.slotCode}</strong>. </> : null}
              {alreadyInside.checkInTime ? <>Vào lúc <strong>{alreadyInside.checkInTime}</strong>. </> : null}
              {alreadyInside.ticketCode ? <>Vé <strong className="font-mono">{alreadyInside.ticketCode}</strong>. </> : null}
              Xe phải ra khỏi bãi trước khi vào lại.
            </p>
          </div>
          <button
            onClick={() => setAlreadyInside(null)}
            className="shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            Đã hiểu
          </button>
        </div>
      )}

      {/* VÀO BÃI NÀO RA BÃI ĐÓ — vé thuộc bãi khác thì không cho ra ở đây. */}
      {wrongLotExit && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-4 text-rose-900">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">
              Xe {wrongLotExit.plate} không vào ở bãi này — không cho ra tại đây.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-rose-700">
              Xe đã vào tại <strong>{wrongLotExit.lot}</strong> (vé{' '}
              <strong className="font-mono">{wrongLotExit.ticketCode}</strong>). Xe phải ra đúng bãi đã vào —
              cho ra ở bãi khác sẽ nhả oan ô đỗ bên đó và tính sai tiền.
            </p>
          </div>
          <button
            onClick={() => setWrongLotExit(null)}
            className="shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            Đã hiểu
          </button>
        </div>
      )}

      {/* XE THẺ THÁNG — phải đi bằng QR ở CẢ HAI CHIỀU, không dùng thẻ RFID. */}
      {monthlyNeedsQr && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-pink-300 bg-pink-50 px-5 py-4 text-pink-900">
          <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-pink-600" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">
              Xe {monthlyNeedsQr.plate} là XE THẺ THÁNG — chưa mở rào.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-pink-800">
              Thẻ <strong className="font-mono">{monthlyNeedsQr.code}</strong>
              {monthlyNeedsQr.slotCode ? <>, ô riêng <strong className="font-mono">{monthlyNeedsQr.slotCode}</strong></> : null}
              , hạn đến <strong>{monthlyNeedsQr.expiry}</strong>.{' '}
              {activeDirection === 'entry' ? (
                <>
                  Xe tháng phải vào bằng <strong>mã QR thẻ tháng</strong> để giữ đúng ô đã đăng ký và kiểm tra hạn thẻ —
                  vào bằng thẻ RFID sẽ bị tính như khách vãng lai và xếp nhầm ô.
                </>
              ) : (
                <>
                  Xe tháng phải ra bằng <strong>mã QR thẻ tháng</strong> — phí đã bao trong gói tháng và ô riêng phải
                  được giữ lại tới hết hạn. Cho ra bằng thẻ RFID sẽ thu tiền như khách vãng lai và trả ô về cho bãi.
                  <strong> Không gắn thẻ RFID cho xe này.</strong>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => { setMonthlyNeedsQr(null); void startQrScan(); }}
              className="rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700"
            >
              Quét QR thẻ tháng
            </button>
            <button
              onClick={() => setMonthlyNeedsQr(null)}
              className="rounded-xl border border-pink-300 bg-white px-4 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {isUnderMaintenance && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            <strong>Bãi đang tạm ngưng để bảo trì.</strong> Quét thẻ, mở cổng và nhập tay đều bị khóa cho đến khi
            quản lý mở lại hoạt động — bạn chỉ có thể xem màn hình này.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {activeDirection === 'entry' ? 'Trạm OCR - Xe vào' : 'Trạm OCR - Xe ra'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {gate.name} · {gate.location} — nhận diện biển số PaddleOCR, điều khiển rào chắn và ghi nhận lượt xe.
          </p>
        </div>
        {/* Entry / Exit station switcher */}
        <div className="flex gap-2">
          {DIRECTION_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveDirection(key)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                activeDirection === key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">

        {/* ── LEFT: hai khung camera + điều khiển thủ công ── */}
        <div className="space-y-5">

          {/* CAM-01 — cận biển (webcam + PaddleOCR) */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-sm aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${webcamActive ? 'opacity-100' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!webcamActive && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-800">
                {webcamError ? (
                  <>
                    <AlertCircle className="h-10 w-10 text-rose-400" />
                    <p className="max-w-70 text-center text-xs text-rose-300">{webcamError}</p>
                    <button
                      onClick={startWebcam}
                      className="mt-1 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                    >
                      Thử lại
                    </button>
                  </>
                ) : (
                  <>
                    <Camera className="h-10 w-10 text-slate-500" />
                    <p className="text-xs text-slate-400">Nhấn "Bật Camera" để mở CAM-01 (cận biển)</p>
                    <button
                      onClick={startWebcam}
                      className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Bật Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* REC badge */}
            <div className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold text-white ${webcamActive ? 'bg-rose-600' : 'bg-slate-600/80'}`}>
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${webcamActive ? 'animate-pulse' : ''}`} />
              {webcamActive ? 'REC: CAM-01 (CẬN BIỂN)' : 'CAM-01 (CẬN BIỂN) — TẮT'}
            </div>
            {/* Timestamp overlay */}
            <div className="absolute right-3 top-3 z-10 text-right text-[10px] font-semibold tracking-wider text-white/90">
              {fmtClock(new Date(now), true)}
              <span className="block">{gate.camLabel || 'CAM 1: PLATE'}</span>
            </div>

            {/* OCR scanning overlay */}
            {ocrStatus === 'scanning' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <p className="text-xs font-semibold text-white">Đang nhận diện biển số (PaddleOCR)...</p>
                <div className="absolute inset-x-8 top-1/2 h-px animate-bounce bg-blue-400/80 shadow-[0_0_8px_2px_rgba(96,165,250,0.8)]" />
              </div>
            )}

            {/* Camera controls */}
            <div className="absolute bottom-3 right-3 z-10 flex gap-2">
              {webcamActive && ocrStatus !== 'scanning' && (
                <button
                  onClick={captureAndOCR}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-blue-700 transition"
                >
                  <Scan className="h-3.5 w-3.5" /> Chụp & OCR
                </button>
              )}
              {webcamActive && (
                <button
                  onClick={stopWebcam}
                  title="Tắt camera"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-700/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-slate-600 transition"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Snapshot thumbnail */}
            {lastSnapshot && ocrStatus !== 'idle' && (
              <img
                src={lastSnapshot}
                alt="Ảnh chụp"
                className="absolute bottom-3 left-3 z-10 h-14 w-20 rounded-lg border-2 border-white/60 object-cover shadow-lg"
              />
            )}
          </div>

          {/* Điều khiển thủ công */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 pb-2.5 text-sm font-bold text-slate-700">
                <Radio className="h-4 w-4 text-blue-600" />
                Điều khiển thủ công
              </div>
              <div className="min-w-36 flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Biển số xe</label>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="Nhập biển số..."
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm tracking-wider focus:outline-none transition ${
                    ocrStatus === 'done'
                      ? 'border-blue-400 bg-blue-50 font-bold text-blue-700 focus:border-blue-500'
                      : 'border-slate-200 focus:border-blue-400'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Loại phương tiện</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as VehicleKey)}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                >
                  {manualVehicleOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleManualSubmit}
                // Sai bãi thì khoá luôn đường nhập tay — nếu không, chặn ở nút
                // RFID xong staff vẫn cho ra được bằng cách gõ biển số.
                disabled={!plate.trim() || (activeDirection === 'exit' && !!exitBlockReason)}
                title={activeDirection === 'exit' ? exitBlockReason ?? undefined : undefined}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {activeDirection === 'entry' ? 'Xác nhận vào cổng' : 'Xác nhận ra cổng'}
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                <RefreshCw className="h-4 w-4" /> Làm mới
              </button>
            </div>

            {/* Quẹt thẻ RFID thủ công (đầu đọc IoT tự kích hoạt qua backend) */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <IdCard className="h-4 w-4 text-slate-400" />
              <input
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRfidScan()}
                placeholder="UID thẻ RFID (vd: 04A2B1C3)..."
                className="min-w-0 w-56 rounded-xl border border-slate-200 px-3 py-2 text-xs tracking-wider focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={handleRfidScan}
                disabled={!rfidInput.trim() || rfidStatus === 'scanning'}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-40"
              >
                {rfidStatus === 'scanning' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                Quét thẻ
              </button>
              <span className="text-[11px] text-slate-400">
                Đầu đọc Arduino quẹt thẻ sẽ tự kích hoạt chụp ảnh & OCR.
              </span>
            </div>
            {autoPipelineNote && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                {rfidStatus === 'scanning' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
                {autoPipelineNote}
              </p>
            )}

            {/* Quét QR thẻ tháng — khách đưa mã trên màn hình điện thoại vào camera */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <QrCode className="h-4 w-4 text-slate-400" />
                <button
                  onClick={qrScanning ? stopQrScan : startQrScan}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    qrScanning
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  {qrScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                  {qrScanning ? 'Đang quét QR... (bấm để dừng)' : 'Quét QR thẻ tháng'}
                </button>
                <input
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && qrInput.trim() && verifyMonthlyQr(qrInput)}
                  placeholder="hoặc dán nội dung mã QR (PARKFLOW-MONTHLY|...)..."
                  className="min-w-0 flex-1 basis-64 rounded-xl border border-slate-200 px-3 py-2 text-xs tracking-wide focus:border-violet-400 focus:outline-none"
                />
                <button
                  onClick={() => verifyMonthlyQr(qrInput)}
                  disabled={!qrInput.trim()}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition disabled:opacity-40"
                >
                  Kiểm tra
                </button>
              </div>
              {qrScanning && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Nhờ khách đưa mã QR thẻ tháng (mục "Lịch sử đặt chỗ" trên điện thoại) vào giữa khung camera phía trên.
                </p>
              )}

              {/* Kết quả xác thực thẻ tháng */}
              {qrResult?.ok === true && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CalendarCheck className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-wide">Thẻ tháng hợp lệ</span>
                    <span className="ml-auto rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      Còn {qrResult.daysLeft} ngày
                    </span>
                  </div>
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <p><span className="text-slate-400">Mã thẻ:</span> <span className="font-mono font-bold text-slate-800">{qrResult.res.reservationCode}</span></p>
                    <p><span className="text-slate-400">Biển số:</span> <span className="font-mono font-bold text-slate-800">{qrResult.res.licensePlate}</span></p>
                    <p><span className="text-slate-400">Loại xe:</span> <span className="font-semibold text-slate-700">{manualVehicleOptions.find((o) => o.key === qrResult.res.vehicleType)?.label ?? qrResult.res.vehicleType}</span></p>
                    <p><span className="text-slate-400">Hiệu lực:</span> <span className="font-semibold text-slate-700">{qrResult.start} → {qrResult.end}</span></p>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2 border-t border-emerald-100 pt-2.5">
                    <button
                      onClick={handleQrConfirm}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      Mở rào — xe {activeDirection === 'entry' ? 'vào' : 'ra'} cổng
                    </button>
                    <button
                      onClick={resetQr}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}
              {qrResult?.ok === false && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-rose-700">Không cho xe qua cổng</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-rose-600">{qrResult.reason}</p>
                  </div>
                  <button
                    onClick={resetQr}
                    className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition"
                  >
                    Quét lại
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: biển số nhận diện + rào chắn ── */}
        <div className="space-y-5">

          {/* Biển số nhận diện */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-700">
                <CreditCard className="h-4 w-4" /> Biển số nhận diện
              </h3>
              {ocrStatus === 'scanning' ? (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang quét
                </span>
              ) : confidencePct != null ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  KHỚP {confidencePct}%
                </span>
              ) : ocrStatus === 'done' && ocrEngine === 'gemini' ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Gemini dự phòng</span>
              ) : ocrStatus === 'no_plate' ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Không thấy biển</span>
              ) : ocrStatus === 'error' ? (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">Lỗi OCR</span>
              ) : null}
            </div>

            {/* Plate display */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/70 px-4 py-3">
              <span className="text-xs font-semibold text-slate-500">Biển số xe</span>
              <span className="font-mono text-lg font-black tracking-wider text-blue-700">
                {plate || '— — —'}
              </span>
            </div>
            {ocrStatus === 'error' && (
              <p className="mt-2 text-[11px] text-rose-500">{ocrError}</p>
            )}

            {/* Thời gian & phí */}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-slate-400">Thời gian vào</p>
                <p className="font-semibold text-slate-800">
                  {feeInfo?.entry ? fmtClock(feeInfo.entry) : exitFee ? fmtClock(exitFee.entry) : activeDirection === 'entry' && plate ? fmtClock(new Date(now)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thời gian ra</p>
                <p className="font-semibold text-slate-800">
                  {activeDirection === 'exit' && (feeInfo?.entry || exitFee) ? fmtClock(new Date(now), true) : '—'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-500">Tổng thời gian</span>
              <span className="font-bold text-slate-800">
                {feeInfo?.entry
                  ? fmtDuration(now - feeInfo.entry.getTime())
                  : exitFee
                    ? fmtDuration(now - exitFee.entry.getTime())
                    : '—'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700">Tổng tiền</span>
              {feeInfo ? (
                <span className={`text-lg font-black ${feeInfo.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {feeInfo.due > 0 ? formatCurrency(feeInfo.due) : 'Đã thanh toán'}
                </span>
              ) : exitFee ? (
                <span className="text-lg font-black text-rose-600">
                  {formatCurrency(exitFee.due)}
                  <span className="ml-1 text-[10px] font-medium text-slate-400">
                    ({exitFee.hours} giờ{exitFee.nights > 0 ? ` · ${exitFee.nights} đêm` : ''} · vé {exitSession?.ticketCode || '—'})
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            {feeInfo?.fee.overstayed && (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                Xe đã qua đêm — đã cộng thêm phí qua đêm ({formatCurrency(feeInfo.fee.surcharge)}).
              </p>
            )}
            {activeDirection === 'exit' && plate && !matchedRes && !exitSession && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Không tìm thấy lượt gửi đang hoạt động cho biển số này trong bãi.
              </p>
            )}

            {/* RFID owner info */}
            {rfidStatus === 'found' && rfidInfo && (
              <div className={`mt-3 rounded-xl border p-3 space-y-2 ${plateMismatch ? 'border-amber-300 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/60'}`}>
                {/* Biển camera đọc được khác biển đã đăng ký cho thẻ → KHÔNG được
                    báo "hợp lệ", vì thẻ đang đi cùng một chiếc xe khác. */}
                <div className={`flex items-center gap-2 ${plateMismatch ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {plateMismatch ? <AlertCircle className="h-4 w-4 shrink-0" /> : <UserCheck className="h-4 w-4 shrink-0" />}
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {plateMismatch ? 'Thẻ khác biển ban đầu' : 'Thẻ RFID hợp lệ'}
                  </span>
                </div>
                <div className="space-y-0.5 text-xs text-slate-600">
                  {/* Ưu tiên biển THẬT camera vừa đọc; biển đăng ký lùi xuống dòng
                      phụ. Trước đây chỉ hiện biển đăng ký nên xe ra mang biển khác
                      vẫn hiển thị biển cũ, staff không có cách nào nhận ra. */}
                  <p className="break-words">
                    <span className="font-mono text-sm font-bold text-slate-800">
                      {plateMismatch ? plate : rfidInfo.vehicle.licensePlate}
                    </span>
                    <span className="ml-1.5">· {rfidInfo.vehicle.vehicleType}</span>
                  </p>
                  {plateMismatch && (
                    <p className="break-words text-[11px] font-semibold text-amber-700">
                      Biển đăng ký cho thẻ: <span className="font-mono">{rfidInfo.vehicle.licensePlate}</span>
                    </p>
                  )}
                  <p className="break-words">{rfidInfo.owner.fullName || '—'} · {rfidInfo.owner.phone || '—'}</p>
                </div>

                {/* Xe khớp đặt chỗ trước → không phải khách vãng lai, staff cần thấy rõ */}
                {activeDirection === 'entry' && matchedReservation && (
                  <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                      <CalendarCheck className="h-3.5 w-3.5" /> Xe đặt trước — đã check-in
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-700">
                      Mã: <strong className="font-mono">{matchedReservation.reservationCode}</strong>
                      {' · '}Ô: <strong className="font-mono">{matchedReservation.slotCode || '—'}</strong>
                      {' · '}{matchedReservation.floor} · {matchedReservation.area}
                    </p>
                    {isReservationPaid(matchedReservation, payments) ? (
                      <p className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Đã thanh toán trước — không cần thu thêm
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        <AlertCircle className="h-3 w-3" /> Chưa thanh toán — thu phí lúc xe ra
                      </p>
                    )}
                  </div>
                )}

                {/* Xe ra: camera CHƯA đọc được biển → chỉ báo đang chờ, không hiện trước thông tin vé */}
                {activeDirection === 'exit' && !plate && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-semibold leading-relaxed text-amber-700">
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                    Đang chờ camera đọc biển số để đối soát với thẻ — đưa biển xe vào khung hình hoặc bấm "Chụp &amp; OCR" quét lại.
                  </p>
                )}

                {/* Xe ra: đối soát ảnh + biển số + giờ vào với thông tin lúc quẹt vào */}
                {activeDirection === 'exit' && plate && (
                  <div className="space-y-1.5 rounded-lg border border-emerald-100 bg-white/70 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đối soát với lúc vào</p>
                    <div className="flex items-center gap-2">
                      {entryScan?.imageData && (
                        <img
                          src={entryScan.imageData}
                          alt="Ảnh chụp lúc vào"
                          className="h-14 w-20 shrink-0 rounded-md border border-slate-200 object-cover"
                        />
                      )}
                      <div className="min-w-0 text-[11px] leading-relaxed text-slate-600">
                        <p>Giờ vào: <strong>{exitSession?.checkInTime || entryScan?.createdAt || '—'}</strong></p>
                        <p>Biển lúc vào: <strong className="font-mono">{entryScan?.licensePlate || rfidInfo.vehicle.licensePlate}</strong></p>
                        <p>Vé: <strong className="font-mono">{exitSession?.ticketCode || matchedRes?.reservationCode || '—'}</strong>{dueAmount != null ? <> · phải thu <strong className="text-rose-600">{formatCurrency(dueAmount)}</strong></> : null}</p>
                      </div>
                    </div>
                    {plate && (normPlate(plate) === normPlate(rfidInfo.vehicle.licensePlate) ? (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <Check className="h-3 w-3" /> Biển số khớp thông tin lúc vào
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <AlertCircle className="h-3 w-3" /> Biển OCR ({plate}) khác biển đã liên kết ({rfidInfo.vehicle.licensePlate}) — kiểm tra trước khi mở cổng
                      </p>
                    ))}
                  </div>
                )}

                {activeDirection === 'exit' ? (
                  // Chỉ cho xác nhận khi đã có biển số từ camera để đối soát.
                  plate ? (
                    // SAI BÃI → nút chuyển XÁM và không bấm được. Giữ nút ở
                    // nguyên chỗ (thay vì ẩn đi) để staff thấy rõ đúng thao tác
                    // nào đang bị khoá; để bấm được rồi mới báo lỗi là quá muộn
                    // vì tiền mặt đã thu của khách trước khi server từ chối.
                    <div className="space-y-1.5">
                      {exitBlockReason && (
                        <p className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold leading-relaxed text-rose-700">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{exitBlockReason}</span>
                        </p>
                      )}
                      <button
                        onClick={handleRfidConfirm}
                        disabled={!!exitBlockReason}
                        title={exitBlockReason ?? undefined}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                          exitBlockReason
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {exitBlockReason ? <Lock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        {dueAmount != null ? `Thu ${formatCurrency(dueAmount)} — Xác nhận & Mở cổng` : 'Xác nhận & Mở cổng'}
                      </button>
                    </div>
                  ) : null
                ) : monthlyNeedsQr || alreadyInside ? (
                  // KHÔNG được báo "đã mở cổng" khi lượt vào vừa bị chặn.
                  // Trước đây dòng này hiện vô điều kiện ở cổng vào, nên màn hình
                  // tự mâu thuẫn: băng trên báo "chưa mở rào", bảng dưới lại báo
                  // "đã tự động mở cổng — xe vào bãi".
                  <p className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600/10 py-2 text-xs font-bold text-rose-700">
                    <Lock className="h-3.5 w-3.5" /> Chưa mở rào — xem cảnh báo phía trên
                  </p>
                ) : !plate ? (
                  // Chưa có biển camera → cổng vào CHƯA mở. Nói đúng trạng thái
                  // thay vì báo "đã tự động mở cổng" như trước.
                  <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] font-semibold leading-relaxed text-amber-700">
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                    Đang chờ camera đọc biển số để đối soát với thẻ — chưa mở rào. Đưa biển xe vào khung hình
                    hoặc bấm "Chụp &amp; OCR".
                  </p>
                ) : plateMismatchEntry ? (
                  <p className="flex items-start gap-1.5 rounded-xl bg-rose-50 p-2.5 text-[11px] font-semibold leading-relaxed text-rose-700">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Biển camera đọc ({plate}) khác biển đã gắn với thẻ ({rfidInfo.vehicle.licensePlate}) — chưa mở rào,
                    kiểm tra lại xe.
                  </p>
                ) : (
                  // Cổng vào tự động — quét thẻ hợp lệ là cổng đã mở, không cần bấm
                  <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/10 py-2 text-xs font-bold text-emerald-700">
                    <Unlock className="h-3.5 w-3.5" /> Đã tự động mở cổng — xe vào bãi
                  </p>
                )}
              </div>
            )}
            {/* BIỂN SỐ LÀ XE THÁNG → KHÔNG mời gắn thẻ.
                Ô "Liên kết biển số" trước đây hiện cho mọi thẻ trắng, kể cả khi
                camera vừa đọc ra một biển đang có thẻ tháng còn hạn. Nhân viên
                bấm Liên kết thì server chặn (MONTHLY_CANNOT_LINK_RFID) nhưng
                màn hình vẫn mời làm việc đó — nay ẩn hẳn và chỉ đường sang QR. */}
            {rfidStatus === 'not_found' && (
              monthlyNeedsQr ? (
                <div className="mt-3 rounded-xl border border-pink-200 bg-pink-50/70 p-3 space-y-2">
                  <p className="flex items-start gap-1.5 text-xs font-bold text-pink-700">
                    <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Xe {monthlyNeedsQr.plate} là xe thẻ tháng — không gắn thẻ RFID cho xe này.
                  </p>
                  <button
                    onClick={() => { setMonthlyNeedsQr(null); void startQrScan(); }}
                    className="w-full rounded-lg bg-pink-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-pink-700"
                  >
                    Quét mã QR thẻ tháng
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" /> {rfidError}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={linkPlate}
                      onChange={(e) => setLinkPlate(e.target.value.toUpperCase())}
                      placeholder="Liên kết biển số: 29C1-38383"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      onClick={handleLinkCard}
                      disabled={!linkPlate.trim() || linking}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-40"
                    >
                      {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Liên kết'}
                    </button>
                  </div>
                </div>
              )
            )}

            {/* PaddleOCR service status */}
            {paddleOnline === false ? (
              <p className="mt-3 flex items-center gap-1 text-[11px] text-amber-600">
                <AlertCircle className="h-3 w-3" />
                PaddleOCR ({getOcrServiceUrl()}) chưa chạy — chạy ocr-service/start.ps1 để bật.
              </p>
            ) : paddleOnline === true ? (
              <p className="mt-3 flex items-center gap-1 text-[11px] text-emerald-600">
                <Check className="h-3 w-3" /> PaddleOCR sẵn sàng ({getOcrServiceUrl()})
              </p>
            ) : null}
          </div>

          {/* Rào chắn — đã bỏ nút "Báo động" */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleBarrier('open')}
              className={`flex flex-col items-center gap-2 rounded-2xl px-3 py-5 text-sm font-bold transition ${
                barrier === 'open'
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                  : 'bg-blue-600 text-white shadow hover:bg-blue-700'
              }`}
            >
              <Unlock className="h-6 w-6" />
              Mở rào
            </button>
            <button
              onClick={() => handleBarrier('close')}
              className={`flex flex-col items-center gap-2 rounded-2xl px-3 py-5 text-sm font-bold transition ${
                barrier === 'closed'
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <Lock className="h-6 w-6" />
              Đóng rào
            </button>
          </div>

          {/* Trạng thái rào + IoT */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              {barrier === 'open'
                ? <><Unlock className="h-3.5 w-3.5 text-emerald-600" /> Rào chắn: <span className="text-emerald-600 font-bold">ĐANG MỞ</span></>
                : <><Lock className="h-3.5 w-3.5 text-slate-500" /> Rào chắn: <span className="font-bold">ĐÓNG</span></>}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 font-bold ${
              iotStatus === 'online' ? 'bg-emerald-100 text-emerald-700'
              : iotStatus === 'simulated' ? 'bg-blue-100 text-blue-700'
              : iotStatus === 'connecting' ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
            }`}>
              IoT: {iotStatus === 'online' ? 'Trực tuyến' : iotStatus === 'simulated' ? 'Mô phỏng' : iotStatus === 'connecting' ? 'Đang nối' : 'Ngoại tuyến'}
            </span>
          </div>
        </div>
      </div>

      {/* Live scan queue (simulator/hardware pushes) */}
      {liveScans.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ScanLine className="h-5 w-5 text-blue-600" /> Lượt quét đang chờ xử lý
            </h3>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
              {liveScans.length} mới
            </span>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto px-5 pb-5">
            {liveScans.map((scan) => {
              // Loại khách suy từ DỮ LIỆU THẬT (xe này có thẻ tháng còn hiệu
              // lực không), không tin trường `recognition` của lượt quét: đầu
              // đọc gắn nhãn theo từng lượt nên cùng một xe tháng quét hai lần
              // có thể ra 'subscriber' lần này, 'casual' lần sau — màn hình khi
              // đó hiện xe vừa là Khách tháng vừa là Khách vãng lai.
              const pill = recognitionPill[scanRecognitionOf(scan)];
              return (
                <div key={scan.id} className="rounded-xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                        {scan.gateId}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {scan.licensePlate || 'BIỂN SỐ KHÔNG ĐỌC ĐƯỢC'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {scan.direction === 'entry' ? 'Vào' : 'Ra'}
                          {scan.confidence != null ? ` · OCR ${Math.round(scan.confidence * 100)}%` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => onConfirmScan(scan, scan.vehicleType ?? 'motorbike', 'GRANTED')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Cho qua & ghi nhận
                    </button>
                    {scan.recognition === 'unknown' && (
                      <button
                        onClick={() => onConfirmScan(scan, scan.vehicleType ?? 'motorbike', 'OVERRIDE')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <ArrowRight className="h-3.5 w-3.5" /> Mở thủ công
                      </button>
                    )}
                    <button
                      onClick={() => onDenyScan(scan)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <X className="h-3.5 w-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
