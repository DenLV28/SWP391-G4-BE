import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DoorOpen,
  Lock,
  Camera,
  CameraOff,
  Wallet,
  ShieldCheck,
  ScanLine,
  Check,
  X,
  ArrowRight,
  Scan,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Gate, ScanEvent, AccessLog } from '../../types/staff';
import { manualVehicleOptions } from '../../types/staff';
import type { VehicleKey, PricingRule } from '../../data/mockData';
import { formatCurrency } from '../../utils/helpers';
import { readLicensePlate } from '../../services/ocrService';

interface GateControlProps {
  gates: Gate[];
  liveScans: ScanEvent[];
  accessLogs: AccessLog[];
  iotStatus: 'connecting' | 'online' | 'offline' | 'simulated';
  iotTransport: string;
  pricingRules: PricingRule[];
  onGateCommand: (gateId: string, command: 'open' | 'close' | 'override') => void;
  onGateCommandAll: (command: 'open-all' | 'close-all') => void;
  onConfirmScan: (scan: ScanEvent, vehicleType: VehicleKey, status: 'GRANTED' | 'OVERRIDE') => void;
  onDenyScan: (scan: ScanEvent) => void;
  onManualEntry: (gateId: string, plate: string, vehicleType: VehicleKey, direction: 'entry' | 'exit') => void;
  onNavigate?: (view: string) => void;
}

const recognitionPill: Record<string, { label: string; cls: string }> = {
  subscriber: { label: 'Khách tháng',     cls: 'bg-emerald-100 text-emerald-700' },
  casual:     { label: 'Khách lượt',      cls: 'bg-blue-100   text-blue-700'     },
  unknown:    { label: 'Không nhận diện', cls: 'bg-rose-100   text-rose-700'     },
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  GRANTED: { label: 'CHẤP NHẬN', cls: 'text-emerald-600' },
  DENIED:  { label: 'TỪ CHỐI',   cls: 'text-rose-500'    },
  OVERRIDE:{ label: 'GHI ĐÈ',    cls: 'text-amber-600'   },
  PENDING: { label: 'CHỜ XỬ LÝ', cls: 'text-slate-500'   },
};

const actionVi: Record<string, string> = {
  'Auto-Recognized':          'Tự động nhận diện',
  'Staff Badge Sweep':        'Quẹt thẻ nhân viên',
  'OCR Recognition Failed':   'OCR lỗi nhận diện',
  'Manual Trigger (Chen)':    'Mở thủ công (Chon)',
  'Nhân viên xác nhận':       'Nhân viên xác nhận',
  'Nhận diện tự động':        'Nhận diện tự động',
};

function translateAction(action: string) {
  return actionVi[action] ?? action;
}

type OcrStatus = 'idle' | 'scanning' | 'done' | 'error' | 'no_plate';

export default function GateControl({
  gates,
  liveScans,
  accessLogs,
  iotStatus: _iotStatus,
  iotTransport: _iotTransport,
  pricingRules,
  onGateCommand,
  onGateCommandAll,
  onConfirmScan,
  onDenyScan,
  onManualEntry,
  onNavigate,
}: GateControlProps) {
  const gate = gates[0];
  const [plate, setPlate] = useState('');
  const [manualType, setManualType] = useState<VehicleKey>('motorbike');

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState('');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrError, setOcrError] = useState('');
  const [lastSnapshot, setLastSnapshot] = useState<string>('');

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

  const captureAndOCR = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !webcamActive) return;

    // Draw current frame to canvas
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 (without the data:image/jpeg;base64, prefix)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    setLastSnapshot(dataUrl);

    setOcrStatus('scanning');
    setOcrError('');

    try {
      const result = await readLicensePlate(base64, 'image/jpeg');
      if (result) {
        setPlate(result);
        setOcrStatus('done');
      } else {
        setOcrStatus('no_plate');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOcrError(msg);
      setOcrStatus('error');
    }
  };

  const selectedPricing = pricingRules.find((p) => p.vehicleType === manualType);

  const handleManualSubmit = () => {
    if (!plate.trim()) return;
    onManualEntry(gate.id, plate.trim().toUpperCase(), manualType, 'entry');
    setPlate('');
    setOcrStatus('idle');
    setLastSnapshot('');
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hệ thống Quản lý Cổng</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Theo dõi video thời gian thực, quản lý rào chắn và ghi nhận giao thức truy cập tại khu phức hợp bãi xe chính.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onGateCommandAll('open-all')}
            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition"
          >
            <DoorOpen className="h-4 w-4" /> Mở tất cả
          </button>
          <button
            onClick={() => onGateCommandAll('close-all')}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-600 transition"
          >
            <Lock className="h-4 w-4" /> Đóng tất cả
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

        {/* Gate panel */}
        <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">

          {/* Camera feed */}
          <div className="relative overflow-hidden bg-slate-900 aspect-video">
            {/* Webcam video (shown when active) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${webcamActive ? 'opacity-100' : 'hidden'}`}
            />
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Placeholder image (shown when webcam is off) */}
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
                    <p className="text-xs text-slate-400">Nhấn "Bật Camera" để xem webcam</p>
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

            {/* LIVE badge */}
            {webcamActive && (
              <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </div>
            )}

            {/* OCR scanning overlay */}
            {ocrStatus === 'scanning' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <p className="text-xs font-semibold text-white">Đang nhận diện biển số...</p>
                {/* Scanning line animation */}
                <div className="absolute inset-x-8 top-1/2 h-px animate-bounce bg-blue-400/80 shadow-[0_0_8px_2px_rgba(96,165,250,0.8)]" />
              </div>
            )}

            {/* Cam label */}
            <div className="absolute bottom-3 left-3 z-10 text-[11px] font-semibold text-white/90 tracking-widest">
              {gate.camLabel || 'CAM_R_ENTRANCE'}
            </div>

            {/* Capture button overlay (shown when webcam is active) */}
            {webcamActive && ocrStatus !== 'scanning' && (
              <button
                onClick={captureAndOCR}
                title="Chụp & nhận diện biển số"
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-blue-600/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-blue-700 transition"
              >
                <Scan className="h-3.5 w-3.5" /> Chụp & OCR
              </button>
            )}
          </div>

          {/* OCR result snapshot preview */}
          {lastSnapshot && ocrStatus !== 'idle' && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <img
                  src={lastSnapshot}
                  alt="Ảnh chụp"
                  className="h-14 w-20 rounded-lg object-cover border border-slate-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Kết quả OCR (Gemini AI)</p>
                  {ocrStatus === 'done' && (
                    <p className="mt-0.5 text-lg font-bold tracking-widest text-blue-700">{plate}</p>
                  )}
                  {ocrStatus === 'no_plate' && (
                    <p className="mt-0.5 text-sm text-slate-500">Không tìm thấy biển số trong ảnh</p>
                  )}
                  {ocrStatus === 'error' && (
                    <p className="mt-0.5 text-xs text-rose-500">{ocrError}</p>
                  )}
                </div>
                <button
                  onClick={() => { setLastSnapshot(''); setOcrStatus('idle'); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="p-4">
            {/* Gate name + status */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{gate.name}</h3>
                <p className="text-xs text-slate-400">{gate.location}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Hoạt động
              </span>
            </div>

            {/* Gate action buttons */}
            <div className="mt-4 grid grid-cols-[1fr_1fr_auto_auto] gap-2">
              <button
                onClick={() => onGateCommand(gate.id, 'open')}
                className="rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition"
              >
                Mở cổng
              </button>
              <button
                onClick={() => onGateCommand(gate.id, 'close')}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Đóng cổng
              </button>
              {/* Webcam toggle */}
              <button
                onClick={webcamActive ? stopWebcam : startWebcam}
                title={webcamActive ? 'Tắt camera' : 'Bật camera'}
                className={`rounded-xl border px-3 transition ${
                  webcamActive
                    ? 'border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {webcamActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              </button>
              {/* Capture & OCR button */}
              <button
                onClick={captureAndOCR}
                disabled={!webcamActive || ocrStatus === 'scanning'}
                title="Chụp ảnh & nhận diện biển số"
                className="rounded-xl border border-blue-200 px-3 text-blue-600 hover:bg-blue-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {ocrStatus === 'scanning'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Scan className="h-4 w-4" />
                }
              </button>
            </div>

            <div className="my-4 border-t border-slate-100" />

            {/* Manual plate entry */}
            <label className="text-xs font-semibold text-slate-500">Nhập biển số thủ công</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="51G-123.45"
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm tracking-wider focus:outline-none transition ${
                  ocrStatus === 'done'
                    ? 'border-blue-400 bg-blue-50 font-bold text-blue-700 focus:border-blue-500'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              />
              <button
                onClick={handleManualSubmit}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition"
              >
                Gửi
              </button>
            </div>
            {ocrStatus === 'done' && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-blue-600">
                <Check className="h-3 w-3" /> Biển số được điền tự động từ OCR — kiểm tra lại trước khi gửi
              </p>
            )}
            {!import.meta.env.VITE_GEMINI_API_KEY && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Chưa có VITE_GEMINI_API_KEY trong .env — OCR sẽ báo lỗi
              </p>
            )}

            <label className="mt-3 block text-xs font-semibold text-slate-500">Loại xe</label>
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value as VehicleKey)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
            >
              {manualVehicleOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <div className="my-4 border-t border-slate-100" />

            {/* Pricing */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <Wallet className="h-4 w-4" /> Chi tiết giá (Lối ra)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gửi theo lượt</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(selectedPricing?.firstHourPrice ?? 5000).replace('₫', 'đ')}
                  <span className="text-[10px] font-medium text-slate-400"> /lượt</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gửi qua đêm</p>
                <p className="text-lg font-bold text-slate-700">
                  {formatCurrency(selectedPricing?.overnightPrice ?? 30000).replace('₫', 'đ')}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" /> Khách tháng (Thuê bao)
              </span>
              <span className="text-sm font-bold text-emerald-700">0đ</span>
            </div>
          </div>
        </div>

        {/* Right column: live scans + activity log */}
        <div className="space-y-5">

          {/* Live scan queue */}
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
                  const pill = recognitionPill[scan.recognition];
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

          {/* Activity log */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-base font-bold text-slate-800">Hoạt động vào ra gần đây</h3>
              <button
                onClick={() => onNavigate?.('activitylog')}
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
              >
                Xem toàn bộ lịch sử <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Cổng</th>
                    <th className="px-5 py-3">Biển số</th>
                    <th className="px-5 py-3">Hành động</th>
                    <th className="px-5 py-3">Thời gian</th>
                    <th className="px-5 py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.slice(0, 6).map((log) => {
                    const st = statusLabel[log.status] ?? { label: log.status, cls: 'text-slate-500' };
                    const denied = log.status === 'DENIED';
                    return (
                      <tr key={log.id} className="border-b border-slate-50 last:border-0">
                        <td className={`px-5 py-3 font-semibold ${denied ? 'text-rose-500' : 'text-slate-700'}`}>
                          Cổng {log.gateId}
                        </td>
                        <td className={`px-5 py-3 font-bold ${denied ? 'text-rose-500' : 'text-slate-800'}`}>
                          {log.vehicleId}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{translateAction(log.action)}</td>
                        <td className="px-5 py-3 text-slate-500">{log.time}</td>
                        <td className={`px-5 py-3 text-right text-xs font-bold ${st.cls}`}>
                          {st.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
