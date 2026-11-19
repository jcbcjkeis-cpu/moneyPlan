-- 부부로그 v3: Siri 음성 입력용 함수
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.
--
-- 아이폰 단축어가 "이마트 5만 2천" 같은 문장을 보내면
-- 사용처/금액/날짜를 해석해서 공용 생활비로 저장하고, Siri가 읽어줄 문장을 돌려줍니다.

-- 1) 한국어 금액 해석: "5만 2천" → 52000, "오천원" → 5000, "52,000원" → 52000, "만5천" → 15000
create or replace function public.parse_korean_amount(p text)
returns bigint
language plpgsql
immutable
as $$
declare
  s text := replace(replace(replace(coalesce(p, ''), ',', ''), '원', ''), ' ', '');
  c text;
  i int;
  total bigint := 0;   -- 만 단위 이상 누적
  section bigint := 0; -- 만 미만 누적
  num bigint := 0;
  has_num boolean := false;
  digits text := '';
  kdigit int;
begin
  if s = '' then return null; end if;
  for i in 1..char_length(s) loop
    c := substr(s, i, 1);
    if c ~ '[0-9]' then
      digits := digits || c;
      continue;
    end if;
    if digits <> '' then num := digits::bigint; has_num := true; digits := ''; end if;

    kdigit := position(c in '일이삼사오육칠팔구');
    if kdigit > 0 then
      num := kdigit; has_num := true;
    elsif c = '십' then
      section := section + (case when has_num then num else 1 end) * 10; num := 0; has_num := false;
    elsif c = '백' then
      section := section + (case when has_num then num else 1 end) * 100; num := 0; has_num := false;
    elsif c = '천' then
      section := section + (case when has_num then num else 1 end) * 1000; num := 0; has_num := false;
    elsif c = '만' then
      total := total + (case when section + num > 0 then section + num else 1 end) * 10000;
      section := 0; num := 0; has_num := false;
    else
      return null; -- 숫자가 아닌 글자가 섞이면 금액 아님
    end if;
  end loop;
  if digits <> '' then num := digits::bigint; end if;
  total := total + section + num;
  return nullif(total, 0);
end;
$$;

-- 2) 음성 입력 저장
--    p_text  : "이마트 5만 2천", "어제 스타벅스 4500원" 등
--    p_payer : 'husband' 또는 'wife' (단축어마다 고정)
--    p_dry_run : true면 저장하지 않고 해석 결과만 돌려줌 (앱 설정 화면의 테스트용)
create or replace function public.quick_add(p_text text, p_payer text default 'wife', p_dry_run boolean default false)
returns json
language plpgsql
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date; -- DB 서버는 UTC라서 한국 날짜로 변환
  v_date date;
  v_text text;
  tokens text[];
  amount_tokens text[] := '{}';
  merchant_tokens text[] := '{}';
  tok text;
  i int;
  n int;
  v_amount bigint;
  v_merchant text;
  v_category text;
  v_card expenses.card_id%type;
  v_card_name text;
  v_owner text;
  v_id expenses.id%type;
  amount_re constant text := '^[0-9,일이삼사오육칠팔구십백천만]+원?$';
  fillers constant text[] := array['공용', '생활비', '원', '썼어', '썼어요', '결제', '지출'];
begin
  if p_payer not in ('husband', 'wife') then
    return json_build_object('ok', false, 'message', '단축어 설정의 p_payer 값은 husband 또는 wife 여야 해요.');
  end if;

  v_text := trim(regexp_replace(coalesce(p_text, ''), '[.!?]', ' ', 'g'));
  v_date := today;
  if v_text ~ '(그저께|그제)' then v_date := today - 2;
  elsif v_text ~ '어제' then v_date := today - 1;
  end if;
  v_text := trim(regexp_replace(v_text, '(그저께|그제|어제|오늘)', ' ', 'g'));

  tokens := array(select t from unnest(regexp_split_to_array(v_text, '\s+')) t where t <> '' and not (t = any(fillers)));
  n := coalesce(array_length(tokens, 1), 0);

  -- 금액은 보통 문장 끝: 뒤에서부터 금액처럼 생긴 토큰을 모음
  i := n;
  while i >= 1 and tokens[i] ~ amount_re loop
    amount_tokens := tokens[i] || amount_tokens;
    i := i - 1;
  end loop;
  if i >= 1 and array_length(amount_tokens, 1) is not null then
    merchant_tokens := tokens[1:i];
  else
    -- "5만 2천 이마트"처럼 금액이 앞에 온 경우
    amount_tokens := '{}';
    i := 1;
    while i <= n and tokens[i] ~ amount_re loop
      amount_tokens := amount_tokens || tokens[i];
      i := i + 1;
    end loop;
    if i <= n then merchant_tokens := tokens[i:n]; end if;
  end if;

  v_amount := public.parse_korean_amount(array_to_string(amount_tokens, ''));
  v_merchant := trim(regexp_replace(array_to_string(merchant_tokens, ' '), '(에서|에)$', ''));

  if v_amount is null then
    return json_build_object('ok', false, 'message', '금액을 못 알아들었어요. "이마트 5만 2천"처럼 말해주세요.');
  end if;
  if v_merchant is null or v_merchant = '' then
    return json_build_object('ok', false, 'message', '어디서 썼는지 못 알아들었어요. "이마트 5만 2천"처럼 말해주세요.');
  end if;
  if v_amount > 5000000 then
    return json_build_object('ok', false, 'message', format('%s원은 너무 커서 저장하지 않았어요. 앱에서 직접 입력해주세요.', to_char(v_amount, 'FM999,999,999,999')));
  end if;

  -- 같은 사용처의 최근 기록으로 카테고리/카드 추정
  select e.category, e.card_id into v_category, v_card
  from expenses e
  where e.is_income = false and lower(trim(e.content)) = lower(v_merchant)
  order by e.expense_date desc, e.created_at desc
  limit 1;

  -- 사용처 이름에 흔한 단어가 있으면 그걸로
  if v_category is null then
    v_category := case
      when v_merchant ~* '(이마트24|GS25|CU|세븐일레븐|편의점)' then '카페/간식'
      when v_merchant ~* '(커피|카페|스타벅스|투썸|메가|컴포즈|이디야|빽다방|베이커리|빵|파리바게뜨|뚜레쥬르)' then '카페/간식'
      when v_merchant ~* '(마트|홈플러스|코스트코|트레이더스|쿠팡|컬리|시장|농협|노브랜드)' then '장보기'
      when v_merchant ~* '(배민|배달|요기요|쿠팡이츠|식당|치킨|피자|김밥|국밥|고기|분식)' then '식비'
      when v_merchant ~* '(주유|택시|카카오T|버스|지하철|주차|톨게이트|하이패스)' then '교통/주유/차량'
      when v_merchant ~* '(약국|병원|의원|치과|한의원)' then '의료/건강'
      when v_merchant ~* '(다이소|올리브영|생활용품)' then '생필품'
      when v_merchant ~* '(관리비|전기|가스|수도|통신|인터넷)' then '공과금'
    end;
  end if;

  -- 비슷한 이름의 과거 기록 (예: "이마트 성수점" ↔ "이마트")
  if v_category is null then
    select e.category into v_category
    from expenses e
    where e.is_income = false and char_length(e.content) >= 2
      and (e.content ilike v_merchant || '%' or v_merchant ilike e.content || '%')
    order by e.expense_date desc
    limit 1;
  end if;
  v_category := coalesce(v_category, '기타');

  -- 추정한 카드가 다른 사람 개인카드거나 숨긴 카드면 버리고, 이 사람이 최근에 쓴 카드로
  if v_card is not null then
    select c.owner into v_owner from payment_cards c where c.id = v_card and c.is_active;
    if v_owner is null or v_owner not in (p_payer, 'joint') then v_card := null; end if;
  end if;
  if v_card is null then
    select e.card_id into v_card
    from expenses e join payment_cards c on c.id = e.card_id
    where e.payer = p_payer and e.is_income = false and c.is_active and c.owner in (p_payer, 'joint')
    order by e.created_at desc
    limit 1;
  end if;
  if v_card is not null then select c.card_name into v_card_name from payment_cards c where c.id = v_card; end if;

  if not p_dry_run then
    insert into expenses (expense_date, is_income, amount, category, content, payer, card_id, is_joint_expense, is_settled)
    values (v_date, false, v_amount, v_category, v_merchant, p_payer, v_card, true, false)
    returning id into v_id;
  end if;

  return json_build_object(
    'ok', true,
    'id', v_id,
    'date', v_date,
    'amount', v_amount,
    'merchant', v_merchant,
    'category', v_category,
    'card', v_card_name,
    'message', format('%s%s %s원, 공용 생활비로 %s. %s%s',
      case when v_date = today then '' when v_date = today - 1 then '어제 ' else '그제 ' end,
      v_merchant,
      to_char(v_amount, 'FM999,999,999,999'),
      case when p_dry_run then '저장될 거예요' else '저장했어요' end,
      v_category,
      coalesce(', ' || v_card_name, ', 카드 없음'))
  );
end;
$$;

grant execute on function public.parse_korean_amount(text) to anon, authenticated;
grant execute on function public.quick_add(text, text, boolean) to anon, authenticated;

-- API가 새 함수를 바로 인식하도록
notify pgrst, 'reload schema';
