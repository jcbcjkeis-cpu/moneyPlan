# 부부로그 v3 변경사항 (UI/UX 개선 + 아이폰 대응)

## 적용 방법
지난번과 똑같이 `moneyPlan_v3` 폴더 **안의 내용물 전체**를 GitHub "Add file → Upload files"에 끌어다 놓고 Commit 하면 됩니다.
- DB(SQL)는 이번에 바꿀 것이 없습니다.
- package.json에 아이콘 라이브러리(lucide-react)가 추가됐습니다. Vercel이 배포할 때 자동으로 설치합니다.
- 삭제할 파일은 없습니다.

## 새로 추가된 파일
- src/components/common/Sheet.jsx — 하단 시트 (키보드 대응, 끌어서 닫기)
- src/components/common/SwipeRow.jsx — 밀어서 삭제
- src/components/calendar/DaySheet.jsx — 날짜를 누르면 뜨는 그날 내역
- src/hooks/useTheme.js — 다크 모드
- src/hooks/useKeyboardInset.js — 아이폰 키보드 높이 계산
- src/lib/haptic.js — 진동 피드백 (안드로이드 + iOS 18)

## 아이폰 단축어 설정 (선택)
설정 → 앱 탭 → "아이폰: 카드 문자 자동 입력" 안내를 따라 하면 됩니다.
