# 부부로그 v7.1: 빌드 오류 수정

Vercel 빌드 오류("Could not resolve ../../../supabase/functions/push/index.ts?raw") 수정.
서버 함수 코드와 SQL을 src 안에 넣어서, supabase 폴더를 GitHub에 올리지 않아도 빌드됩니다.

## 올릴 파일 (2개만 올려도 됩니다)
- 새 파일: src/setup/pushServerFiles.js
- 수정: src/components/modal/NotificationSettings.jsx

설정 → 알림 → 1단계에 "SQL 복사" 버튼도 생겼습니다.
