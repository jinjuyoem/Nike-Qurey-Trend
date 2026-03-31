import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/naver-searchad': {
          target: 'https://api.searchad.naver.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/naver-searchad/, '')
        },
        '/api/naver-datalab': {
          target: 'https://openapi.naver.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/naver-datalab/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('X-Naver-Client-Id', env.VITE_NAVER_CLIENT_ID);
              proxyReq.setHeader('X-Naver-Client-Secret', env.VITE_NAVER_CLIENT_SECRET);
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          }
        }
      }
    }
  }
})
