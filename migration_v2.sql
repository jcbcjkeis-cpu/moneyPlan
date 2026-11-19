-- 부부로그 v2: 정산 이력 + 즐겨찾기 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.

-- 1) 정산 이력
create table if not exists public.settlements (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  sender        text   not null check (sender in ('husband', 'wife', 'none')),
  receiver      text   not null check (receiver in ('husband', 'wife', 'none')),
  amount        bigint not null default 0,
  husband_paid  bigint not null default 0,
  wife_paid     bigint not null default 0,
  item_count    int    not null default 0,
  period_start  date,
  period_end    date,
  expense_ids   jsonb  not null default '[]'::jsonb
);

-- 2) 즐겨찾기 (부부가 같이 씀)
create table if not exists public.favorites (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  content           text    not null,
  category          text    not null,
  amount            bigint,
  card_id           text,
  is_income         boolean not null default false,
  is_joint_expense  boolean not null default true
);

-- 3) 실시간 동기화 (배우자 화면에 정산 이력 반영)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settlements'
  ) then
    alter publication supabase_realtime add table public.settlements;
  end if;
end $$;

-- 4) 기존 expenses 테이블에 RLS를 켜 두셨다면, 새 테이블에도 같은 정책이 필요합니다.
--    (기존 테이블에 RLS가 꺼져 있다면 이 부분은 실행하지 않아도 됩니다.)
-- alter table public.settlements enable row level security;
-- alter table public.favorites   enable row level security;
-- create policy "anon all" on public.settlements for all to anon using (true) with check (true);
-- create policy "anon all" on public.favorites   for all to anon using (true) with check (true);
