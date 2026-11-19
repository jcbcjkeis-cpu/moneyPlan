-- 부부로그 v4: 푸시 알림
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요. (여러 번 실행해도 안전합니다)

-- 1) 필요한 확장 기능 (DB에서 서버 함수 호출 / 매일 예약 실행)
create extension if not exists pg_net with schema extensions;

-- 2) 컬럼 추가
alter table public.expenses     add column if not exists created_by   text;         -- 어느 휴대폰에서 입력했는지 (husband / wife)
alter table public.expenses     add column if not exists push_sent_at timestamptz;  -- 알림 중복 방지
alter table public.app_settings add column if not exists vapid_public_key  text;    -- 알림 공개 키 (비밀 키는 서버 Secret에만)
alter table public.app_settings add column if not exists vapid_subject     text;
alter table public.app_settings add column if not exists push_function_url text;    -- 앱에서 연결 확인 시 자동 저장
alter table public.app_settings add column if not exists push_state jsonb not null default '{}'::jsonb;

-- 3) 알림 받을 휴대폰 목록
create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  role        text not null check (role in ('husband', 'wife')),
  prefs       jsonb not null default '{"partner": true, "budget": true, "settlement": true}'::jsonb,
  user_agent  text
);

-- 기존 테이블에 RLS를 켜 두셨다면 아래 두 줄의 주석(--)을 지우고 실행하세요.
-- alter table public.push_subscriptions enable row level security;
-- create policy "anon all" on public.push_subscriptions for all to anon using (true) with check (true);

-- 4) 새 내역이 들어오면 서버 함수 호출 (알림 실패가 입력을 막지 않도록 오류는 무시)
create or replace function public.notify_push_on_expense()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
begin
  select push_function_url into v_url from public.app_settings where id = 1;
  if coalesce(v_url, '') = '' then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('type', 'expense', 'id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists expenses_push_notify on public.expenses;
create trigger expenses_push_notify
  after insert on public.expenses
  for each row execute function public.notify_push_on_expense();

-- 5) (정산 기능 제거) 예전에 만든 월말 정산 알림 예약이 있으면 삭제
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'bubolog-daily') then
      perform cron.unschedule('bubolog-daily');
    end if;
  end if;
exception when others then
  null;
end;
$$;

-- API가 새 컬럼/테이블을 바로 인식하도록
notify pgrst, 'reload schema';
