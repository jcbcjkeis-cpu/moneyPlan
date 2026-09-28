import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        id: '/',
        name: '부부로그 - 부부 전용 커스텀 가계부',
        short_name: '부부로그',
        description: '우리 부부만의 공용 생활비 가계부',
        lang: 'ko',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        shortcuts: [{ name: '지출 입력', short_name: '입력', url: '/?add=1', icons: [{ src: 'icon-192.png', sizes: '192x192' }] }],
        // 아이콘 파일은 public/ 폴더에 있어야 설치가 가능함 (없으면 크롬이 "설치할 수 없습니다" 표시)
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // 가계부 데이터(API)는 캐시하지 않음 → 오래된 금액이 최신처럼 보이는 문제 방지
        // 배경 사진 같은 공개 파일만 캐시
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-public-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});