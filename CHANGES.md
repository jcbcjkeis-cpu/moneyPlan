# v6: 앱 설치 문제 해결 (+ v5 달력 겹침 수정 포함)

## 꼭 확인
- **public 폴더**가 GitHub 저장소 맨 위(src 폴더와 같은 위치)에 올라가야 합니다.
- public 안에 png 4개 + favicon.ico 1개가 있어야 합니다.

## 바뀐 파일
- 새 폴더: public/ (icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon.ico)
- 수정: vite.config.js, index.html
- v5 수정분: src/components/calendar/CalendarHome.jsx, src/lib/format.js, src/index.css
