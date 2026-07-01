import { useRef, useState } from 'react';
import { fileToBase64, readLicensePlate } from '../services/ocrService';

interface Props {
  onResult: (plate: string) => void;
}

export default function LicensePlateScanner({ onResult }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    setLastResult('');

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const plate = await readLicensePlate(base64, mimeType);
      if (!plate) {
        setError('Không nhận diện được biển số. Hãy chụp rõ hơn hoặc nhập tay.');
      } else {
        setLastResult(plate);
        onResult(plate);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi OCR';
      setError(msg);
    } finally {
      setScanning(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 bg-blue-50 space-y-3">
      <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        OCR Biển Số Xe (Gemini AI)
      </div>

      {/* Drop zone / preview */}
      <div
        className="relative rounded-lg overflow-hidden bg-white border border-blue-200 cursor-pointer"
        style={{ minHeight: 120 }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {preview ? (
          <img src={preview} alt="preview" className="w-full object-contain max-h-48" />
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-1">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Nhấn để chụp / chọn ảnh xe</span>
            <span className="text-xs">hoặc kéo thả ảnh vào đây</span>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
            <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-blue-600 text-sm font-medium">Đang nhận diện biển số...</span>
          </div>
        )}
      </div>

      {/* Hidden file input — capture="environment" opens back camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={scanning}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          {preview ? 'Chụp lại' : 'Chụp ảnh / Chọn file'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => { setPreview(null); setLastResult(''); setError(''); }}
            className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition"
          >
            Xóa
          </button>
        )}
      </div>

      {lastResult && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800 text-sm">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Nhận diện: <strong className="font-mono">{lastResult}</strong></span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
