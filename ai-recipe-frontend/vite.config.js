import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const LAN_IP = env.LAN_IP || '127.0.0.1'
  const BACKEND = env.BACKEND_ORIGIN || `http://${LAN_IP}:8080`

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: { host: LAN_IP, port: 5173 },
      proxy: {
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: { '*': '' }, // ← 도메인 속성 제거(호스트 전용 쿠키)
        },
      },
    },
  }
})
