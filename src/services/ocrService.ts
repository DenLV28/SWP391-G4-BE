import { GoogleGenAI } from '@google/genai';

const PROMPT = `Bạn là hệ thống đọc biển số xe Việt Nam.
Nhìn vào ảnh, hãy tìm và đọc biển số xe (nếu có nhiều xe, lấy biển số xe rõ nhất / gần nhất).
Chỉ trả về chuỗi biển số xe (ví dụ: 51G-123.45 hoặc 29A-456.78).
Không giải thích, không thêm bất kỳ chữ nào khác.
Nếu không tìm thấy biển số, chỉ trả về: KHÔNG_TÌM_THẤY`;

export async function readLicensePlate(imageBase64: string, mimeType = 'image/jpeg'): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình VITE_GEMINI_API_KEY trong file .env');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
  });

  const text = (response.text ?? '').trim();
  if (!text || text === 'KHÔNG_TÌM_THẤY') return '';
  return text;
}

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:image/jpeg;base64,XXXX"
      const [header, base64] = result.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
