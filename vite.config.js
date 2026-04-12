import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import crypto from 'crypto-js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Naver Search Ad Credentials with fallback values
  const LICENSE_KEY = env.VITE_NAVER_SEARCHAD_LICENSE || '01000000000c0941d2c71e0667d5da49ea25352b60d9bf313e683d709ecaecfaaec9cccf9c';
  const CUSTOMER_ID = env.VITE_NAVER_SEARCHAD_CUSTOMER_ID || '3462476';
  const SECRET_KEY = env.VITE_NAVER_SEARCHAD_SECRET || 'AQAAAAAMCUHSxx4GZ9XaSeolNStg8RgYtE150z1Is9UQ2+q0dw==';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/naver-searchad': {
          target: 'https://api.searchad.naver.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/naver-searchad/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Sign the request for Search Ad API
              const timestamp = Date.now().toString();
              const method = req.method.toUpperCase();
              
              // Extract target URI for signature (without query params and prefix)
              // Vite's proxyReq has the full path including the prefix sometimes depending on config
              // But here we need the relative path starting from /
              const urlParts = req.url.split('?');
              const pathOnly = urlParts[0].replace('/api/naver-searchad', '');
              
              const message = timestamp + "." + method + "." + pathOnly;
              const signature = crypto.enc.Base64.stringify(crypto.HmacSHA256(message, SECRET_KEY));

              proxyReq.setHeader('X-Timestamp', timestamp);
              proxyReq.setHeader('X-API-KEY', LICENSE_KEY);
              proxyReq.setHeader('X-Signature', signature);
              proxyReq.setHeader('X-Customer', CUSTOMER_ID);
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          }
        },
        '/api/naver-datalab': {
          target: 'https://openapi.naver.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/naver-datalab/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const id = env.VITE_NAVER_CLIENT_ID || '';
              const secret = env.VITE_NAVER_CLIENT_SECRET || '';
              
              if (!id || !secret) {
                 console.warn('[Proxy Warning] Naver DataLab API keys are missing in .env');
              }

              proxyReq.setHeader('X-Naver-Client-Id', id);
              proxyReq.setHeader('X-Naver-Client-Secret', secret);
              proxyReq.setHeader('Content-Type', 'application/json');
              
              console.log(`[Proxy] Naver DataLab -> ${req.method} ${req.url.replace('/api/naver-datalab', '')}`);
            });
          }
        }
      }
    }
  }
})
