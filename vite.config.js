import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'shortcut-quick.png', 'shortcut-mic.png', 'shortcut-add.png', 'shortcut-search.png'],
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
        // 안드로이드: 홈 화면 아이콘을 길게 누르면 나오는 바로가기
        shortcuts: [
          { name: '빠른 입력', short_name: '빠른 입력', description: '"이마트 5만 2천"처럼 한 줄로 입력', url: '/?quick=1', icons: [{ src: 'shortcut-quick.png', sizes: '96x96', type: 'image/png' }] },
          { name: '말로 입력', short_name: '말로 입력', description: '말하면 바로 입력', url: '/?mic=1', icons: [{ src: 'shortcut-mic.png', sizes: '96x96', type: 'image/png' }] },
          { name: '자세히 입력', short_name: '자세히 입력', url: '/?add=1', icons: [{ src: 'shortcut-add.png', sizes: '96x96', type: 'image/png' }] },
          { name: '내역 검색', short_name: '검색', url: '/?search=1', icons: [{ src: 'shortcut-search.png', sizes: '96x96', type: 'image/png' }] },
        ],
        // 아이콘 파일은 public/ 폴더에 있어야 설치가 가능함 (없으면 크롬이 "설치할 수 없습니다" 표시)
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        importScripts: ['push-sw.js'], // 푸시 알림 받기/누르기 처리 (public/push-sw.js)
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