-- 정산 기능 제거: 매달 말일 밤 9시 정산 알림 예약 삭제 (한 번만 실행, 없으면 아무 일도 안 함)
select cron.unschedule(jobid) from cron.job where jobname = 'bubolog-daily';
