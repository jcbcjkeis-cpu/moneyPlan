# 부부로그 v7: 푸시 알림

## 적용 순서
1. `moneyPlan_v7` 폴더 안의 내용물 전체를 GitHub에 업로드 → Commit (Vercel 자동 배포)
2. 배포 후 앱 → 설정 → **알림** 탭 → "처음 한 번: 서버 설정" 1~5단계 (한 사람만, PC 추천)
3. 두 사람 모두 각자 휴대폰에서 설정 → 알림 → **알림 받기** 켜기 → 테스트 알림

아이폰은 반드시 **홈 화면에 추가한 앱**으로 열어서 켜야 합니다 (iOS 16.4 이상).

## 바뀐 파일
- 새 파일: supabase/migration_v4_push.sql, supabase/functions/push/index.ts,
  public/push-sw.js, src/lib/push.js, src/components/modal/NotificationSettings.jsx
- 수정: src/App.jsx, src/hooks/useSettings.js, src/hooks/useExpenses.js,
  src/components/modal/SettingsModal.jsx, vite.config.js
