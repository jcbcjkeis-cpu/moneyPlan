// 빠른 입력 / 음성 입력 문장 해석
//   "이마트 5만 2천"                       → 오늘, 이마트, 52,000원
//   "어제 스타벅스 4500원, 다이소 만2천"     → 2건
//   "이마트 5만 2천 스타벅스 4500"          → 쉼표 없이 말해도 2건 (음성 입력)
//   "월급 300만 수입" / "+당근마켓 2만"      → 수입
//   "쿠팡 3만 개인"                        → 개인 지출

const KDIGIT = '일이삼사오육칠팔구';
const AMOUNT_RE = /^[0-9,일이삼사오육칠팔구십백천만억]+원?$/;
const DATE_WORDS = { 오늘: 0, 어제: -1, 그제: -2, 그저께: -2 };
const FILLERS = new Set(['원', '썼어', '썼어요', '결제', '결제했어', '지출', '샀어', '쓴거', '그리고', '하고', '또']);

// "5만2천" → 52000, "오천원" → 5000, "52,000원" → 52000, "만5천" → 15000
export function parseKoreanAmount(input) {
  const s = String(input ?? '').replace(/[,\s원]/g, '');
  if (!s) return null;
  let total = 0;
  let section = 0;
  let num = 0;
  let hasNum = false;
  let digits = '';
  const flushDigits = () => { if (digits) { num = Number(digits); hasNum = true; digits = ''; } };
  for (const c of s) {
    if (/[0-9]/.test(c)) { digits += c; continue; }
    flushDigits();
    const k = KDIGIT.indexOf(c);
    if (k >= 0) { num = k + 1; hasNum = true; continue; }
    const unit = { 십: 10, 백: 100, 천: 1000 }[c];
    if (unit) { section += (hasNum ? num : 1) * unit; num = 0; hasNum = false; continue; }
    if (c === '만' || c === '억') {
      const mult = c === '만' ? 10000 : 100000000;
      total += ((section + num) || 1) * mult;
      section = 0; num = 0; hasNum = false;
      continue;
    }
    return null;
  }
  flushDigits();
  total += section + num;
  return total > 0 ? total : null;
}

const isAmountToken = (t) => AMOUNT_RE.test(t) && parseKoreanAmount(t) !== null;

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return ymd(d); };

function cleanMerchant(words) {
  return words.join(' ').replace(/(에서|에서요|에)$/, '').trim();
}

// 한 문장 → 여러 건
export function parseQuickText(text, now = new Date()) {
  const groups = [];
  let dateOffset = 0;
  let cur = null;
  const fresh = () => ({ merchant: [], amount: [], dateOffset, income: false, joint: null });
  const close = () => { if (cur && (cur.merchant.length || cur.amount.length)) groups.push(cur); cur = null; };

  // 쉼표·줄바꿈·"그리고"로 먼저 나누고, 그 안에서는 "사용처 금액" 묶음 단위로 다시 나눔
  const chunks = String(text ?? '').split(/[,\n;·]|\s그리고\s/).map((c) => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const tokens = chunk.replace(/[.!?]/g, ' ').split(/\s+/).filter(Boolean);
    for (let raw of tokens) {
      if (!cur) cur = fresh();
      if (raw.startsWith('+')) { cur.income = true; raw = raw.slice(1); if (!raw) continue; }
      if (raw in DATE_WORDS) {
        close();
        dateOffset = DATE_WORDS[raw];
        continue;
      }
      if (raw === '수입') { cur.income = true; continue; }
      if (raw === '공용' || raw === '생활비') { cur.joint = true; continue; }
      if (raw === '개인' || raw === '개인지출') { cur.joint = false; continue; }
      if (FILLERS.has(raw)) continue;
      if (isAmountToken(raw)) { cur.amount.push(raw); continue; }
      // 금액이 끝난 뒤 새 단어가 나오면 다음 건 시작 ("이마트 5만 스타벅스 4500")
      if (cur.amount.length) { close(); cur = fresh(); }
      cur.merchant.push(raw);
    }
    close();
  }

  // "5만 2천 이마트" 처럼 금액을 먼저 말한 경우: [금액만] + [사용처만] 을 한 건으로 합침
  const merged = [];
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    const next = groups[i + 1];
    if (!g.merchant.length && g.amount.length && next && next.merchant.length && !next.amount.length) {
      merged.push({ ...next, amount: g.amount, income: g.income || next.income, joint: next.joint ?? g.joint, dateOffset: g.dateOffset });
      i += 1;
    } else {
      merged.push(g);
    }
  }

  const items = [];
  const errors = [];
  for (const g of merged) {
    const amount = parseKoreanAmount(g.amount.join(''));
    const name = cleanMerchant(g.merchant);
    if (!amount) errors.push(name ? `'${name}' 금액을 못 찾았어요` : '금액을 못 알아들었어요');
    else if (!name) errors.push(`${amount.toLocaleString('ko-KR')}원은 어디서 썼는지 빠졌어요`);
    else items.push({ date: shiftDays(now, g.dateOffset), amount, merchant: name, income: g.income, joint: g.joint });
  }
  return { items, errors };
}

// ---------- 과거 기록으로 카테고리·카드·공용 여부 채우기 ----------
const KEYWORD_CATEGORY = [
  [/이마트24|GS25|CU|세븐일레븐|편의점/i, '카페/간식'],
  [/커피|카페|스타벅스|투썸|메가|컴포즈|이디야|빽다방|베이커리|빵|파리바게뜨|뚜레쥬르|꽈배기/i, '카페/간식'],
  [/마트|홈플러스|코스트코|트레이더스|쿠팡|컬리|시장|농협|노브랜드/i, '장보기'],
  [/배민|배달|요기요|쿠팡이츠|식당|치킨|피자|김밥|국밥|고기|분식|점심|저녁|외식/i, '식비'],
  [/주유|택시|카카오T|버스|지하철|주차|톨게이트|하이패스|세차/i, '교통/주유/차량'],
  [/약국|병원|의원|치과|한의원/i, '의료/건강'],
  [/다이소|올리브영|생활용품|휴지|세제/i, '생필품'],
  [/관리비|전기|가스|수도|통신|인터넷/i, '공과금'],
];
const INCOME_KEYWORD = /월급|급여|보너스|상여|이자|배당|환급|용돈받|당근|중고판매/;

export function enrichItem(item, { merchants = [], cards = [], cardMap, role, lastCardId }) {
  const nameLower = item.merchant.toLowerCase();
  const income = item.income || INCOME_KEYWORD.test(item.merchant)
    || merchants.some((m) => m.is_income && m.content.toLowerCase() === nameLower);
  const pool = merchants.filter((m) => m.is_income === income);
  const exact = pool.find((m) => m.content.toLowerCase() === nameLower);
  const similar = exact || pool.find((m) => m.content.length >= 2 && (m.content.toLowerCase().startsWith(nameLower) || nameLower.startsWith(m.content.toLowerCase())));

  let category = similar?.category;
  if (!category && !income) category = KEYWORD_CATEGORY.find(([re]) => re.test(item.merchant))?.[1];
  if (!category) category = income ? '기타 수입' : '기타';

  // 카드: 같은 사용처에서 쓴 카드(내 카드나 공용카드일 때만) → 마지막에 쓴 카드 → 내 카드
  const usable = (c) => c && c.is_active && (c.owner === role || c.owner === 'joint');
  let card = null;
  if (!income) {
    const fromHistory = similar?.card_id != null ? cardMap?.get(String(similar.card_id)) : null;
    const last = lastCardId ? cardMap?.get(String(lastCardId)) : null;
    card = [fromHistory, last, cards.find((c) => c.owner === role), cards.find((c) => c.owner === 'joint')].find(usable) || null;
  }

  const joint = income ? false : item.joint !== null && item.joint !== undefined ? item.joint : similar ? similar.is_joint_expense !== false : true;

  return {
    ...item,
    income,
    category,
    joint,
    cardId: card ? card.id : null,
    cardName: card ? card.card_name : null,
    known: Boolean(exact),
  };
}
