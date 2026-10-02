# 부부로그 v7.2: 알림 진단

설정 → 알림 탭에 "알림이 안 올 때 → 알림 진단하기"가 생겼습니다.
서버 / 이 휴대폰 / 배우자 휴대폰 / 새 내역 전달 여부를 확인하고, 어디서 막혔는지와 해결 방법을 알려줍니다.

## 올릴 파일 (3개)
- 새 파일: src/components/modal/PushDiagnostics.jsx
- 수정: src/lib/push.js, src/components/modal/NotificationSettings.jsx
(SQL·서버 함수는 바뀐 것 없음)
