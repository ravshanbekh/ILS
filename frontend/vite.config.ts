import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Yuklangan fayllar (avatar, do'kon rasmi, quiz musiqasi) backenddan keladi.
      // Bu bo'lmasa dev rejimida barcha rasmlar siniq ko'rinadi — Vite ularga
      // SPA'ning index.html ini qaytaradi. Productionda buni nginx qiladi.
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // "npm run preview" — build qilingan holatni productionga o'xshab sinash
  // uchun. Proxy bo'lmasa API so'rovlari ishlamaydi va tekshirib bo'lmaydi.
  preview: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
