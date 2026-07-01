import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBaseUrl, saveApiBaseUrl } from '../services/apiConfig';

type ConnStatus = 'checking' | 'ok' | 'error';

interface HealthResponse {
  status: string;
  lanIPs?: string[];
}

async function fetchHealth(baseUrl: string): Promise<HealthResponse | null> {
  try {
    const target = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/health` : '/api/health';
    const res = await fetch(target, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return res.json() as Promise<HealthResponse>;
  } catch {
    return null;
  }
}

export default function NetworkSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [connStatus, setConnStatus] = useState<ConnStatus>('checking');
  const [lanIPs, setLanIPs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const autoOpenedRef = useRef(false);

  const runHealthCheck = useCallback(async () => {
    const data = await fetchHealth(getApiBaseUrl());
    if (data?.status === 'ok') {
      setConnStatus('ok');
      if (data.lanIPs?.length) setLanIPs(data.lanIPs);
    } else {
      setConnStatus('error');
      // Auto-open once when the page first loads and backend is unreachable
      if (!autoOpenedRef.current) {
        autoOpenedRef.current = true;
        setOpen(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    runHealthCheck();
    const id = setInterval(runHealthCheck, 30_000);
    return () => clearInterval(id);
  }, [runHealthCheck]);

  useEffect(() => {
    if (open) { setUrl(getApiBaseUrl()); setTestResult(null); }
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const data = await fetchHealth(url.trim());
    setTestResult(data?.status === 'ok');
    setTesting(false);
  };

  const handleSave = () => {
    saveApiBaseUrl(url);
    setOpen(false);
    window.location.reload();
  };

  const isConfigured = !!getApiBaseUrl();

  const btnRing =
    connStatus === 'checking' ? '' :
    connStatus === 'ok'       ? '' :
                                'animate-ping bg-rose-400 opacity-40';

  const btnIcon =
    connStatus === 'checking' ? 'text-slate-400' :
    connStatus === 'ok'       ? 'text-emerald-500' :
                                'text-rose-500';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Cài đặt kết nối Backend"
        className="fixed bottom-5 left-5 z-[9998] flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md hover:bg-slate-50 transition"
      >
        {connStatus === 'error' && (
          <span className={`absolute inset-0 rounded-full ${btnRing}`} />
        )}
        <svg className={`relative h-5 w-5 ${btnIcon}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Đồng bộ sơ đồ bãi đỗ</h3>
                <p className="mt-0.5 text-xs text-slate-400">Cần thiết để tất cả máy tính hiển thị cùng một trạng thái</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status banner */}
            <div className={`rounded-xl border px-4 py-3 text-xs ${
              connStatus === 'ok'       ? 'border-emerald-200 bg-emerald-50' :
              connStatus === 'error'    ? 'border-rose-200 bg-rose-50' :
                                         'border-amber-200 bg-amber-50'
            }`}>
              <p className={`font-bold ${
                connStatus === 'ok' ? 'text-emerald-700' : connStatus === 'error' ? 'text-rose-700' : 'text-amber-700'
              }`}>
                {connStatus === 'checking' && '⏳ Đang kiểm tra kết nối backend…'}
                {connStatus === 'ok'       && `✓ Backend kết nối thành công${isConfigured ? ` — ${getApiBaseUrl()}` : ' (localhost)'}`}
                {connStatus === 'error'    && '✗ Không kết nối được backend — sơ đồ sẽ KHÔNG đồng bộ giữa các máy'}
              </p>
              {connStatus === 'error' && (
                <p className="mt-1 text-rose-600">Máy này đang chạy frontend riêng nhưng không có backend. Hãy dùng một trong 2 cách bên dưới.</p>
              )}
            </div>

            {/* Method 1: access Machine A's Vite server directly */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs space-y-2">
              <p className="font-bold text-blue-800">Cách 1 — Dễ nhất (Khuyến nghị)</p>
              <p className="text-blue-700">Thay vì chạy Vite riêng, hãy mở trình duyệt tại máy này và truy cập máy chủ chính:</p>
              {lanIPs.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-semibold text-blue-800">Địa chỉ của máy chủ backend:</p>
                  {lanIPs.map((ip) => (
                    <div key={ip} className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-blue-100 px-2 py-1 font-mono text-blue-900">http://{ip}:5173</code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(`http://${ip}:5173`)}
                        className="rounded border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-100 transition text-[10px] font-semibold"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                  <p className="text-blue-600">Gửi địa chỉ trên cho máy khác — họ chỉ cần mở URL đó là xong.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-blue-700">Trên máy chủ chính (nơi backend đang chạy), mở terminal và dùng lệnh:</p>
                  <code className="block rounded bg-blue-100 px-2 py-1 font-mono text-blue-900">ipconfig  (Windows)  hoặc  ip a  (Linux)</code>
                  <p className="text-blue-700">Tìm địa chỉ IPv4 LAN (vd: 192.168.1.100), rồi cho máy khác truy cập:</p>
                  <code className="block rounded bg-blue-100 px-2 py-1 font-mono text-blue-900">http://192.168.1.100:5173</code>
                </div>
              )}
            </div>

            {/* Method 2: configure backend URL */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Cách 2 — Cấu hình Backend URL (nếu mỗi máy chạy Vite riêng)</p>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
                  placeholder="http://192.168.1.100:4000"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {testing ? '…' : 'Test'}
                </button>
              </div>
              {testResult !== null && (
                <p className={`text-xs font-semibold ${testResult ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {testResult ? '✓ Kết nối thành công! Nhấn Lưu để áp dụng.' : '✗ Không kết nối được. Kiểm tra IP và đảm bảo backend đang chạy.'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setUrl(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Xóa URL
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Lưu &amp; Tải lại trang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
