// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const LAN_IP  = env.LAN_IP || '127.0.0.1';
  const BACKEND = env.BACKEND_ORIGIN || `http://${LAN_IP}:8080`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: { host: LAN_IP, port: 5173 },

      proxy: {
        // 백엔드 API (세션 쿠키 포함)
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
          // 쿠키의 Domain 속성을 제거해서 현재 호스트로 귀속
          cookieDomainRewrite: { '*': '' },
          // X-Forwarded-* 헤더 세팅 (서버에서 원본 오리진/프로토콜 파악용)
          xfwd: true,
        },

        // 업로드 정적 리소스 (예: /static/uploads/2025-09-13/xxx.jpg)
        '/static': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
          xfwd: true,
        },
      },
    },
  };
});
