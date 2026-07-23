import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发服务器代理：将 /api 转发到 FastAPI 后端（8000 端口）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
