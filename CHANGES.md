# 부부로그 v4: Siri 음성 입력

## 적용 순서
1. Supabase → SQL Editor에서 `supabase/migration_v3_siri.sql` 실행 (Success 확인)
2. `moneyPlan_v4` 폴더 안의 내용물 전체를 GitHub에 업로드 → Commit
3. 배포 후 아이폰에서 앱 → 설정 → 앱 탭 → "Siri로 입력하기" 안내대로 단축어 만들기

## 바뀐 파일
- 새 파일: supabase/migration_v3_siri.sql, src/components/modal/SiriSetup.jsx
- 수정: src/lib/supabase.js, src/components/modal/SettingsModal.jsx
