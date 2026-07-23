import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CloudRun 公网地址（部署时通过环境变量传入，或直接在 EdgeOne Pages 构建时设置）
const API_BASE = process.env.VITE_API_BASE_URL || '/api'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 注入 API 地址到客户端代码
    __API_BASE_URL__: JSON.stringify(API_BASE),
  },

  // 开发服务器配置
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  // 生产构建配置
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
})
