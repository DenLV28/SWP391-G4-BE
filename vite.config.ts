import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        // Dịch vụ PaddleOCR chạy riêng ở cổng 8868. Phải đi qua proxy giống /api
        // thì khi mở app qua ngrok (HTTPS) trình duyệt mới gọi được — gọi thẳng
        // http://localhost:8868 từ trang HTTPS bị chặn vì mixed content.
        '/ocr': {
          target: process.env.VITE_OCR_PROXY_TARGET || 'http://127.0.0.1:8868',
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000',
          changeOrigin: true,
          secure: false,
          // Required for SSE: disable response buffering so event chunks flow through instantly
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const ct = proxyRes.headers['content-type'] ?? '';
              if (ct.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache';
              }
            });
          },
        },
      },
      // Allow all hosts — required so LAN machines can access via http://<MachineA-IP>:5173
      allowedHosts: true,
    },
  };
});
