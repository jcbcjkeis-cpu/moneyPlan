# 부부로그 v8

1. 배경 사진: 올리기 전에 화면 크기(최대 1280×1600)로 줄이고 JPEG로 변환 → 버벅임·화면 깨짐 해결, HEIC 사진은 안내 후 차단
2. 정산 기능 제거: 정산 탭/알림/문구 삭제, 하단 메뉴 정산 자리에 '검색', 카드별 사용액은 통계 탭 맨 아래로 이동
3. 빠른 입력: 홈 화면 "빠른 입력" → "이마트 5만 2천 스타벅스 4500"처럼 한 줄로 여러 건 저장
4. 마이크 입력: 홈 화면 🎤 버튼 → 말하면 바로 빠른 입력에 채워짐

## 올릴 파일
- 새 파일: src/lib/image.js, src/lib/cards.js, src/lib/quickParse.js, src/hooks/useSpeech.js,
  src/components/quick/QuickAddSheet.jsx
- 수정: src/App.jsx, src/hooks/useSettings.js, src/hooks/useRealtimeSync.js,
  src/components/calendar/CalendarHome.jsx, src/components/common/BottomNav.jsx,
  src/components/expense/ExpenseItem.jsx, src/components/modal/ExpenseInputModal.jsx,
  src/components/modal/SettingsModal.jsx, src/components/modal/NotificationSettings.jsx,
  src/components/statistics/StatisticsTab.jsx, src/utils/exportToCsv.js, src/setup/pushServerFiles.js

## GitHub에서 지워도 되는 파일 (안 지워도 동작에는 문제 없음)
- src/components/settlement/CardSettlementTab.jsx
- src/hooks/useSettlements.js
- src/lib/settlement.js

## Supabase에서 한 번 실행 (월말 정산 알림 끄기)
select cron.unschedule(jobid) from cron.job where jobname = 'bubolog-daily';
