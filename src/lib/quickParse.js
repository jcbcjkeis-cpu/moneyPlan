// 빠른 입력 / 음성 입력 문장 해석
//   "이마트 5만 2천"                          → 오늘, 이마트, 52,000원
//   "이마트 52,000원, 스타벅스 4,500원"         → 2건 (천 단위 콤마는 금액으로)
//   "이마트 5만 2천 스타벅스 4500"             → 쉼표 없이 말해도 2건 (음성 입력)
//   "어제 우리카드로 다이소 만2천"              → 어제, 우리카드
//   "3일 전 / 지난주 금요일 / 11월 3일 / 11/3"  → 날짜
//   "커피 4500원 2잔 / 치킨 48000/2 / 4500+3000" → 수량·계산
//   "이마트 5만 장보기 / #식비"                → 카테고리 지정
//   "와이프가 스타벅스 4500"                   → 결제자 지정
//   "쿠팡 3만 개인 / 월급 300만 수입 / 쿠팡 환불 2만" → 개인 / 수입 / 환불(수입)
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import { guessCategory } from './autoCategory';

const KNUM = '일이삼사오육칠팔구';
const D = `(?:\\d+(?:\\.\\d+)?|[${KNUM}])`;
const SECTION = `(?:${D}?천)?(?:${D}?백)?(?:${D}?십)?${D}?`;
const AMOUNT_RE = new RegExp(`^(?:${SECTION}억)?(?:${SECTION}만)?${SECTION}$`);
const UNIT_RE = /[십백천만억]/;
// 금액 뒤에 붙는 말끝: "4500원이요", "5만원어치", "3천원짜리", "만원 정도"
const AMOUNT_SUFFIX = /(원)?(어치|이요|이에요|예요|요|짜리|정도|쯤|가량|씩|이고|이랑|랑|하고|입니다|이었어|였어|나왔어|나옴|들었어|줬어|냈어|결제)?$/;
const MERCHANT_PARTICLE = /(에서요|에서는|에서|에다|에|랑|이랑|하고|으로|로|에서산|에서샀어)$/;
const DATE_WORDS = { 오늘: 0, 금일: 0, 어제: -1, 어저께: -1, 엊그제: -2, 그제: -2, 그저께: -2, 그끄제: -3 };
const WEEKDAYS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const NATIVE_COUNT = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 이틀: 2, 사흘: 3, 나흘: 4 };
const COUNTER = '(?:개|잔|병|인분|장|권|봉지|팩|캔|마리|그릇|박스|켤레|벌|판|세트|통|줄|대)';
const TIME_WORDS = new Set(['아침', '점심', '저녁', '오전', '오후', '밤', '새벽', '낮', '아침에', '점심에', '저녁에', '밤에', '새벽에', '아까', '방금', '좀전에']);
const FILLERS = new Set([
  '원', '썼어', '썼어요', '썼음', '씀', '결제', '결제했어', '결제함', '결제한', '지출', '샀어', '샀음', '산', '산거', '거', '것',
  '쓴거', '쓴', '먹은', '먹은거', '먹었어', '마신', '마심', '사먹음', '사먹은', '했어', '함', '낸', '냈어', '나왔어', '그리고', '또',
  '하고', '이랑', '랑', '정도', '쯤', '요', '이요', '입니다', '예요', '총', '합계', '전부', '다해서', '해서', '에서', '좀', '대충', '약',
]);
const INCOME_WORDS = /^(수입|수입으로|입금|입금됨|들어옴|들어온|받음|받았어|받은)$/;
const REFUND_WORDS = /^(환불|환불됨|환불받음|취소|결제취소|환급)$/;
const JOINT_WORDS = /^(공용|공용으로|생활비|생활비로|같이|함께)$/;
const PERSONAL_WORDS = /^(개인|개인으로|개인지출|내꺼|내돈)$/;
const PAY_WORDS = /^(카카오|카톡|네이버|삼성|애플|토스|페이코|쿠팡|스마일|ssg|쓱|엘|L|제로|하나|KB|국민|신한|우리|현대|롯데)페이(로|으로|결제)?$/i;
const CASH_WORDS = /^(현금|현금으로|현금결제|계좌이체|이체|송금|무통장|계좌로)$/;

// 카테고리 이름·줄임말 → 카테고리
const CATEGORY_ALIASES = (() => {
  const map = new Map();
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].forEach((c) => {
    map.set(c.replace(/\s/g, ''), c);
    c.split('/').forEach((part) => { if (part.length >= 2) map.set(part, c); });
  });
  const extra = {
    식비: ['외식', '밥값', '식사', '식대'],
    장보기: ['장', '장본거', '식재료', '장바구니'],
    '카페/간식': ['커피값', '카페', '간식비'],
    '교통/주유/차량': ['교통', '교통비', '주유비', '기름값', '주차비', '차량비', '톨비'],
    '쇼핑/뷰티/의류': ['쇼핑', '옷값', '화장품'],
    '문화/여가/여행': ['여행비', '문화생활', '놀이'],
    '의료/건강': ['병원비', '약값', '의료비'],
    '교육/육아': ['학원비', '육아비'],
    '경조사/선물/용돈': ['축의금', '부의금', '조의금', '세뱃돈'],
    '보험/세금': ['보험료', '세금', '자동차세', '재산세'],
    공과금: ['관리비', '전기세', '전기요금', '가스비', '수도세', '통신비', '폰요금', '인터넷요금', '월세'],
    회비: ['모임비', '동호회비', '곗돈', '후원', '헌금'],
    취미: ['운동', '헬스비', 'pt비', '게임'],
    생필품: ['생활용품', '생필'],
    '급여/월급': ['월급', '급여'],
  };
  Object.entries(extra).forEach(([cat, words]) => words.forEach((w) => map.set(w, cat)));
  return map;
})();

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const shiftDays = (base, n) => { const d = startOfDay(base); d.setDate(d.getDate() + n); return d; };
const squash = (s) => String(s ?? '').toLowerCase().replace(/[\s/·.\-_()]/g, '');

// ---------- 금액 ----------
// "5만2천"=52000, "오천"=5000, "만5천"=15000, "1.5만"=15000, "2천500"=2500, "4.5k"=4500
export function parseKoreanAmount(input) {
  let s = String(input ?? '').replace(/[,\s원₩]/g, '');
  if (!s) return null;
  const k = s.match(/^(\d+(?:\.\d+)?)[kK]$/);
  if (k) return Math.round(Number(k[1]) * 1000) || null;
  if (!AMOUNT_RE.test(s)) return null;
  const val = (d) => (d === undefined || d === '' ? null : /\d/.test(d) ? Number(d) : KNUM.indexOf(d) + 1);
  let total = 0;
  for (const [unit, mult] of [['억', 1e8], ['만', 1e4]]) {
    const i = s.indexOf(unit);
    if (i >= 0) {
      const part = s.slice(0, i);
      total += (part ? sectionValue(part, val) : 1) * mult;
      s = s.slice(i + 1);
    }
  }
  if (s) total += sectionValue(s, val);
  total = Math.round(total);
  return total > 0 ? total : null;
}

function sectionValue(part, val) {
  const m = part.match(new RegExp(`^(?:(${D})?(천))?(?:(${D})?(백))?(?:(${D})?(십))?(${D})?$`));
  if (!m) return 0;
  let v = 0;
  if (m[2]) v += (val(m[1]) ?? 1) * 1000;
  if (m[4]) v += (val(m[3]) ?? 1) * 100;
  if (m[6]) v += (val(m[5]) ?? 1) * 10;
  if (m[7]) v += val(m[7]);
  return v;
}

// 계산식: "12000+3500", "48000/2", "5만-3천", "4500×2", "(1만+2만)/3" → 정수 (실패하면 null)
export function evaluateAmountExpr(input) {
  const s = String(input ?? '')
    .replace(/[,\s원₩]/g, '')
    .replace(/[×xX*]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–]/g, '-');
  if (!s) return null;
  if (!/[+\-*/()]/.test(s)) return parseKoreanAmount(s);
  const tokens = s.match(/[+\-*/()]|[^+\-*/()]+/g);
  if (!tokens) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const factor = () => {
    const t = next();
    if (t === '(') { const v = expr(); if (next() !== ')') throw new Error('paren'); return v; }
    if (t === '-') return -factor();
    const v = /^\d+(\.\d+)?$/.test(t) ? Number(t) : parseKoreanAmount(t);
    if (v === null || Number.isNaN(v)) throw new Error('num');
    return v;
  };
  const term = () => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    if (pos !== tokens.length || !Number.isFinite(v)) return null;
    const r = Math.round(v);
    return r > 0 ? r : null;
  } catch {
    return null;
  }
}

const OP_TOKEN = /^[+×xX*÷/\-]$/;
const hasOperator = (t) => /\d[+×*÷/xX]\d|[십백천만억k][+×*÷/xX]\d?|\d[+×*÷/][일이삼사오육칠팔구십백천만]/.test(t);

// 금액 단어인지 (한글 숫자만 있으면 단위가 있어야 함: "구이", "이", "일"은 금액 아님)
function amountWord(raw) {
  const t = raw.replace(/^₩/, '').replace(AMOUNT_SUFFIX, '');
  if (!t) return null;
  if (hasOperator(t)) return evaluateAmountExpr(t) ? t : null;
  if (/^\d+(\.\d+)?[kK]$/.test(t)) return t;
  if (!/\d/.test(t) && !UNIT_RE.test(t)) return null;
  if (/^\d+\.\d+$/.test(t)) return null; // "4.5" 처럼 단위 없는 소수는 애매해서 제외
  return parseKoreanAmount(t) ? t : null;
}

// 수량: "2잔", "두 잔"(두 토큰), "x2", "2개"
function quantityOf(raw, nextRaw) {
  const m = raw.match(new RegExp(`^(\\d+)${COUNTER}(씩|이요|요)?$`));
  if (m) return { qty: Number(m[1]), used: 1 };
  const x = raw.match(/^[xX×*](\d+)$/);
  if (x) return { qty: Number(x[1]), used: 1 };
  const n = raw.match(new RegExp(`^(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)${COUNTER}$`));
  if (n) return { qty: NATIVE_COUNT[n[1]], used: 1 };
  if (NATIVE_COUNT[raw] && nextRaw && new RegExp(`^${COUNTER}(씩|이요|요)?$`).test(nextRaw)) return { qty: NATIVE_COUNT[raw], used: 2 };
  return null;
}

// ---------- 날짜 ----------
function resolveMonthDay(month, day, now) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const today = startOfDay(now);
  let d = new Date(today.getFullYear(), month - 1, day);
  if (d.getMonth() !== month - 1) return null;
  if (d > today) d = new Date(today.getFullYear() - 1, month - 1, day);
  return d;
}

// 토큰(들)이 날짜면 { date, used } (used = 사용한 토큰 수)
function dateOf(tokens, i, now) {
  const raw = tokens[i];
  const nx = tokens[i + 1] || '';
  const nx2 = tokens[i + 2] || '';
  const strip = (t) => t.replace(/(은|는|에|에는|날)$/, '');
  const bare = strip(raw);
  const today = startOfDay(now);

  if (bare in DATE_WORDS) return { date: shiftDays(today, DATE_WORDS[bare]), used: 1 };

  // "3일 전", "3일전", "이틀 전"
  let m = raw.match(/^(\d+)일전(에)?$/);
  if (m) return { date: shiftDays(today, -Number(m[1])), used: 1 };
  if ((/^\d+일$/.test(raw) || /^(이틀|사흘|나흘)$/.test(raw)) && /^전(에)?$/.test(nx)) {
    const n = NATIVE_COUNT[raw] || Number(raw.replace('일', ''));
    return { date: shiftDays(today, -n), used: 2 };
  }
  if (/^(이틀|사흘|나흘)전(에)?$/.test(raw)) return { date: shiftDays(today, -NATIVE_COUNT[raw.replace(/전(에)?$/, '')]), used: 1 };

  // 요일: "금요일", "금욜", "지난주 금요일", "저번주 금요일", "이번주 월요일"
  const wd = (t) => { const w = strip(t).match(/^([일월화수목금토])(요일|욜)$/); return w ? WEEKDAYS[w[1]] : null; };
  const lastWeek = /^(지난주|저번주|지난주에|저번주에)$/.test(raw);
  const thisWeek = /^(이번주|이번주에)$/.test(raw);
  if ((lastWeek || thisWeek) && wd(nx) !== null) {
    const target = wd(nx);
    const mondayOffset = (today.getDay() + 6) % 7; // 이번 주 월요일까지 며칠
    const thisMonday = shiftDays(today, -mondayOffset);
    const base = lastWeek ? shiftDays(thisMonday, -7) : thisMonday;
    return { date: shiftDays(base, (target + 6) % 7), used: 2 };
  }
  if (wd(raw) !== null) {
    const diff = (today.getDay() - wd(raw) + 7) % 7; // 가장 최근의 그 요일 (오늘 포함)
    return { date: shiftDays(today, -diff), used: 1 };
  }

  // "11월 3일", "11월3일", "11/3"
  m = raw.match(/^(\d{1,2})월(\d{1,2})일(에|날)?$/);
  if (m) { const d = resolveMonthDay(Number(m[1]), Number(m[2]), now); if (d) return { date: d, used: 1 }; }
  m = raw.match(/^(\d{1,2})월$/);
  const dm = nx.match(/^(\d{1,2})일(에|날)?$/);
  if (m && dm && !/^전/.test(nx2)) { const d = resolveMonthDay(Number(m[1]), Number(dm[1]), now); if (d) return { date: d, used: 2 }; }
  m = raw.match(/^(\d{1,2})\/(\d{1,2})(에|일)?$/);
  if (m) { const d = resolveMonthDay(Number(m[1]), Number(m[2]), now); if (d) return { date: d, used: 1 }; }
  // "3일" (이번 달 3일, 미래면 지난달) — 뒤에 "전"이 오면 위에서 처리됨
  m = raw.match(/^(\d{1,2})일(에|날)?$/);
  if (m && !/^전/.test(nx)) {
    const day = Number(m[1]);
    let d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d.getDate() !== day) return null;
    if (d > today) d = new Date(today.getFullYear(), today.getMonth() - 1, day);
    return { date: d, used: 1 };
  }
  return null;
}

// ---------- 카드 이름 일부로 카드 찾기 ----------
// "우리카드로", "현대", "음성페이", "진천" → 등록된 카드 이름과 일부만 맞아도 찾음 (한 장만 맞을 때)
export function buildCardAliases(cards = []) {
  return cards.filter((c) => c.is_active !== false).map((c) => {
    const name = squash(c.card_name);
    const words = String(c.card_name || '').toLowerCase().split(/[\s/·,()-]+/).filter((w) => w.length >= 2);
    const aliases = new Set([name, name.replace(/카드$/, ''), ...words, ...words.map((w) => w.replace(/(카드|페이|체크)$/, ''))]);
    return { card: c, aliases: [...aliases].filter((a) => a.length >= 2) };
  });
}

export function matchCardToken(token, cardAliases) {
  const hits = matchCardCandidates(token, cardAliases);
  return hits.length === 1 ? hits[0] : null;
}

// 이 말에 맞는 카드들 (이름이 같은 카드가 두 사람에게 있으면 둘 다)
export function matchCardCandidates(token, cardAliases) {
  const t = squash(token).replace(/(으로|로|에서|결제)$/, '');
  if (t.length < 2) return [];
  const core = t.replace(/(카드|체크카드|체크|페이)$/, '');
  const hits = cardAliases.filter(({ card, aliases }) => {
    const name = squash(card.card_name);
    // 정확히 같음 → "카드/페이"를 뗀 이름 → 카드 이름이나 단어의 앞부분 ("현대" → "현대M", "음성" → "음성페이")
    return aliases.includes(t) || (core.length >= 2 && aliases.includes(core))
      || (core.length >= 2 && (name.startsWith(core) || aliases.some((a) => a.startsWith(core))))
      || ((/(카드|페이|체크)$/.test(t)) && core.length >= 2 && name.includes(core));
  });
  return hits.map((h) => h.card);
}

// ---------- 카드 주인 ("내", "와이프", "남편꺼", "찬범", "파덕") ----------
const OWN_SUFFIX = /(꺼로|거로|걸로|껄로|꺼|거|것|의)$/;
const CARD_WORD = /^(카드|페이|체크|체크카드)(로|으로|결제)?$/;
function ownerOf(raw, nicknames) {
  const r = String(raw || '').replace(OWN_SUFFIX, '');
  if (/^(내|나|제|저|나의)$/.test(r)) return 'me';
  return r ? payerOf(r, nicknames) : null;
}

// 같은 이름 카드가 여럿이면 주인으로 고름. 주인이 안 맞으면 말한 카드 이름을 우선
function pickByOwner(list, owner) {
  if (!owner || owner === 'me') return list;
  const own = list.filter((c) => c.owner === owner);
  return own.length ? own : list;
}

/**
 * i번째 단어부터 "주인 + 카드" 읽기
 *  - "와이프 삼성카드", "내 우리카드로", "남편꺼 음성페이", "파덕 거 삼성", "와이프 현금"
 *  - 한 단어: "와이프카드", "남편카드로", "내카드", "찬범꺼"
 * 결과: { owner, candidates?, cash?, used }
 */
function readCardPhrase(tokens, i, { cardAliases, merchantWords, nicknames }) {
  const t0 = tokens[i];
  const one = t0.match(/^(.+?)(꺼|거|의)?(카드|페이|체크카드|체크)(로|으로|결제)?$/);
  if (one) {
    const o = ownerOf(one[1], nicknames);
    if (o) return { owner: o, used: 1 };
  }
  const owner = ownerOf(t0, nicknames);
  if (!owner) return null;
  let j = i + 1;
  if (/^(꺼|거|것|꺼로|거로)$/.test(tokens[j] || '')) j += 1; // "와이프 거 삼성"
  const next = tokens[j];
  if (next !== undefined) {
    if (CARD_WORD.test(next)) return { owner, used: j - i + 1 };
    if (CASH_WORDS.test(next)) return { owner, cash: true, used: j - i + 1 };
    if (!merchantWords.has(squash(next))) {
      const hits = matchCardCandidates(next, cardAliases);
      const picked = pickByOwner(hits, owner);
      if (picked.length && new Set(picked.map((c) => squash(c.card_name))).size === 1) return { owner, candidates: picked, used: j - i + 1 };
    }
  }
  // "나 이마트 5만" → 말하는 사람 본인
  if (owner === 'me' && /^(나|내|제|저)$/.test(t0)) return { owner, used: 1 };
  // "이마트 5만 남편꺼" → 남편 카드 (단, "내꺼"는 원래대로 '개인')
  if (owner !== 'me' && OWN_SUFFIX.test(t0)) return { owner, used: 1 };
  return null;
}

// ---------- 결제자 ("와이프가", "찬범이", "남편") ----------
function payerOf(raw, nicknames) {
  const t = raw.replace(/(이가|께서|님이|님|씨가|씨|이는|는|가|이|도|이도)$/, '');
  const h = String(nicknames?.husband || '').trim();
  const w = String(nicknames?.wife || '').trim();
  if (/^(남편|신랑)$/.test(t) || (h && (t === h || raw === h))) return 'husband';
  if (/^(아내|와이프|부인|마누라)$/.test(t) || (w && (t === w || raw === w))) return 'wife';
  return null;
}

// ---------- 문장 → 여러 건 ----------
export function parseQuickText(text, now = new Date(), { cards = [], merchants = [], nicknames = null } = {}) {
  const cardAliases = buildCardAliases(cards);
  // 전에 사용처로 쓴 단어는 카드·카테고리로 보지 않음 (예: "이마트" 카드가 있어도 사용처 이마트는 그대로)
  const merchantWords = new Set(merchants.map((m) => squash(m.content)));
  const normalized = String(text ?? '')
    .replace(/₩\s*/g, '')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1') // 천 단위 콤마(52,000)는 숫자로
    .replace(/(\d)\s*,\s*(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d)\s*([+×*÷])\s*(?=\d|[일이삼사오육칠팔구십백천만])/g, '$1$2') // "4500 + 3000" → 하나로
    .replace(/(\d)\s+[xX]\s*(\d)/g, '$1 x$2'); // "4500 x 2" → 수량
  const groups = [];
  let date = startOfDay(now);
  let cur = null;
  const fresh = () => ({ merchant: [], amount: [], date, income: false, refund: false, joint: null, card: undefined, cardCandidates: null, cardOwner: null, category: null, catAfter: false, payer: null, qty: 1 });
  const close = () => { if (cur && (cur.merchant.length || cur.amount.length)) groups.push(cur); cur = null; };

  const chunks = normalized.split(/[,，\n;]|\s그리고\s|\s또\s|\s그다음\s/).map((c) => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const tokens = chunk.replace(/[!?。]/g, ' ').replace(/(\D)\.(?=\s|$)/g, '$1 ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      let raw = tokens[i];
      if (!cur) cur = fresh();
      if (raw === '+') { cur.income = true; continue; }
      if (raw.startsWith('+')) { cur.income = true; raw = raw.slice(1); }
      if (/^-\d/.test(raw)) raw = raw.slice(1);
      if (raw.startsWith('#') && raw.length > 1) {
        const cat = CATEGORY_ALIASES.get(raw.slice(1).replace(/(으로|로)$/, ''));
        if (cat) { cur.category = cat; cur.catAfter = true; continue; }
        raw = raw.slice(1);
      }

      // 날짜
      const dt = dateOf(tokens, i, now);
      if (dt) {
        if (cur.merchant.length || cur.amount.length) { close(); cur = null; }
        date = dt.date;
        if (cur) cur.date = date; // 아직 빈 건이면 날짜만 바꿈
        i += dt.used - 1;
        continue;
      }
      if (TIME_WORDS.has(raw)) { cur.timeWord = raw.replace(/에$/, ''); continue; } // "점심 1만"처럼 이것만 있으면 사용처로

      // "와이프 삼성카드", "내 우리카드", "남편꺼" → 카드 + 주인
      const cp = cardAliases.length || /카드|페이|체크|꺼|거|의$/.test(raw) || CASH_WORDS.test(tokens[i + 1] || '')
        ? readCardPhrase(tokens, i, { cardAliases, merchantWords, nicknames }) : null;
      if (cp) {
        const target = cur;
        if (cp.cash) target.card = null;
        else if (cp.candidates?.length === 1) target.card = cp.candidates[0];
        else if (cp.candidates) target.cardCandidates = cp.candidates;
        target.cardOwner = cp.owner;
        if (cp.owner !== 'me') target.payer = cp.owner;
        i += cp.used - 1;
        if (target.amount.length && target.merchant.length) close(); // "이마트 5만 와이프 삼성카드" → 앞 건의 카드
        continue;
      }

      if (INCOME_WORDS.test(raw)) { cur.income = true; continue; }
      if (REFUND_WORDS.test(raw)) { cur.income = true; cur.refund = true; continue; }
      if (JOINT_WORDS.test(raw)) { cur.joint = true; continue; }
      if (PERSONAL_WORDS.test(raw)) { cur.joint = false; continue; }
      if (CASH_WORDS.test(raw)) { cur.card = null; continue; }
      if (FILLERS.has(raw)) continue;

      // 수량 ("2잔", "두 잔", "x2"): 금액 뒤면 곱하고, 금액 앞이면 설명이라 버림
      const q = quantityOf(raw, tokens[i + 1]);
      if (q) {
        if (cur.amount.length) cur.qty *= q.qty;
        i += q.used - 1;
        continue;
      }

      const amt = amountWord(raw);
      if (amt) {
        // "이마트 24 5천": 단위 없이 끝난 숫자 뒤에 또 금액이 오면 앞 숫자는 상호의 일부
        const last = cur.amount[cur.amount.length - 1];
        if (last && !/[십백천만억kK]$/.test(last) && !OP_TOKEN.test(last) && !hasOperator(last)) { cur.merchant.push(...cur.amount); cur.amount = []; }
        // 앞 건에 이미 금액+사용처가 있고 수량/카테고리 뒤에 또 금액이 오면 새 건
        cur.amount.push(amt);
        continue;
      }

      const payer = payerOf(raw, nicknames);
      if (payer) {
        const nextTok = tokens[i + 1];
        const trailing = nextTok === undefined || JOINT_WORDS.test(nextTok) || PERSONAL_WORDS.test(nextTok);
        if (cur.amount.length && cur.merchant.length && trailing) { cur.payer = payer; continue; } // "이마트 5만 와이프"
        if (cur.amount.length && cur.merchant.length) { close(); cur = fresh(); }
        cur.payer = payer;
        continue;
      }

      const sq = squash(raw).replace(/(으로|로)$/, '');
      const catAlias = !merchantWords.has(squash(raw)) ? CATEGORY_ALIASES.get(sq) : null;
      if (catAlias && cur.amount.length && !amountWord(tokens[i + 1] || '')) {
        // "이마트 5만 장보기" → 앞 건의 카테고리
        cur.category = catAlias; cur.catAfter = true;
        continue;
      }

      const hits = cardAliases.length && !merchantWords.has(squash(raw)) ? matchCardCandidates(raw, cardAliases) : [];
      const sameName = hits.length > 1 && new Set(hits.map((c) => squash(c.card_name))).size === 1;
      if (hits.length === 1 || sameName) {
        // "이마트 5만 우리카드로" → 앞 건의 카드, "우리카드로 이마트 5만" → 뒤 건의 카드
        const set = (g) => { if (hits.length === 1) g.card = hits[0]; else g.cardCandidates = hits; };
        if (cur.amount.length && cur.merchant.length) { if (cur.card === undefined && !cur.cardCandidates) set(cur); close(); } else set(cur);
        continue;
      }
      // 등록 안 된 간편결제 이름은 사용처가 아님 ("카카오페이로 편의점 5천")
      if (PAY_WORDS.test(raw)) continue;
      // 금액이 끝난 뒤 새 단어가 나오면 다음 건 시작 ("이마트 5만 스타벅스 4500")
      if (cur.amount.length) { close(); cur = fresh(); }
      if (catAlias && !cur.category) cur.category = catAlias; // "엄마 선물 5만" → 사용처 그대로, 카테고리만
      cur.merchant.push(raw);
    }
    close();
  }

  // "5만 2천 이마트" 처럼 금액을 먼저 말한 경우 합치기
  const merged = [];
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    const next = groups[i + 1];
    if (g.merchant.length && !g.amount.length && next && !next.merchant.length && next.amount.length) {
      // "스타벅스 어제 4500" → 한 건 (날짜는 뒤에 말한 것)
      merged.push({ ...g, amount: next.amount, qty: g.qty * next.qty, income: g.income || next.income, refund: g.refund || next.refund,
        joint: g.joint ?? next.joint, card: g.card !== undefined ? g.card : next.card, category: g.category || next.category,
        cardCandidates: g.cardCandidates || next.cardCandidates, cardOwner: g.cardOwner || next.cardOwner,
        payer: g.payer || next.payer, date: next.date });
      i += 1;
      continue;
    }
    if (!g.merchant.length && g.amount.length && next && next.merchant.length && !next.amount.length) {
      merged.push({
        ...next,
        amount: g.amount,
        qty: g.qty * next.qty,
        income: g.income || next.income,
        refund: g.refund || next.refund,
        joint: next.joint ?? g.joint,
        card: next.card !== undefined ? next.card : g.card,
        cardCandidates: next.cardCandidates || g.cardCandidates,
        cardOwner: next.cardOwner || g.cardOwner,
        category: next.category || g.category,
        payer: next.payer || g.payer,
        date: g.date,
      });
      i += 1;
    } else {
      merged.push(g);
    }
  }
  // 카드·공용 같은 말만 있던 빈 묶음은 앞 건에 합침
  const finalGroups = [];
  for (const g of merged) {
    const empty = !g.merchant.length && !g.amount.length;
    if (empty && finalGroups.length) {
      const prev = finalGroups[finalGroups.length - 1];
      if (g.card !== undefined && prev.card === undefined) prev.card = g.card;
      if (g.joint !== null && prev.joint === null) prev.joint = g.joint;
      if (g.income) prev.income = true;
      if (g.refund) prev.refund = true;
      if (g.category && !prev.category) prev.category = g.category;
      if (g.payer && !prev.payer) prev.payer = g.payer;
    } else if (!empty) finalGroups.push(g);
  }

  const items = [];
  const errors = [];
  for (const g of finalGroups) {
    const base = evaluateAmountExpr(g.amount.join(''));
    const amount = base ? Math.round(base * (g.qty || 1)) : null;
    let words = g.merchant.map((w, idx) => (idx < g.merchant.length - 1 ? w.replace(/(에서요|에서)$/, '') || w : w));
    if (words.length) words[words.length - 1] = words[words.length - 1].replace(MERCHANT_PARTICLE, '') || words[words.length - 1];
    words = words.filter(Boolean);
    const name = words.join(' ').trim() || g.timeWord || '';
    if (!amount) errors.push(name ? `'${name}' 금액을 못 찾았어요` : '금액을 못 알아들었어요');
    else if (!name) errors.push(`${amount.toLocaleString('ko-KR')}원은 어디서 썼는지 빠졌어요`);
    else {
      items.push({
        date: ymd(g.date),
        amount,
        merchant: name,
        income: g.income,
        refund: g.refund,
        joint: g.joint,
        card: g.card,
        cardCandidates: g.card === undefined ? g.cardCandidates : null,
        cardOwner: g.cardOwner,
        category: g.category || (g.refund ? '기타 수입' : null),
        payer: g.payer,
        qty: g.qty > 1 ? g.qty : null,
      });
    }
  }
  return { items, errors };
}

// ---------- 사용처 오타·띄어쓰기 보정 ("이 마트" → "이마트", "스타벅수" → "스타벅스") ----------
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}
export { editDistance, squash };

export function findKnownMerchant(name, merchants, income) {
  const key = squash(name);
  const pool = merchants.filter((m) => !!m.is_income === !!income);
  const exact = pool.find((m) => squash(m.content) === key);
  if (exact) return { match: exact, corrected: exact.content !== name };
  if (key.length >= 3) {
    const limit = key.length >= 6 ? 2 : 1;
    let best = null;
    for (const m of pool) {
      const d = editDistance(key, squash(m.content));
      if (d <= limit && (!best || d < best.d || (d === best.d && m.count > best.m.count))) best = { m, d };
    }
    if (best) return { match: best.m, corrected: true };
  }
  return null;
}

// ---------- 과거 기록으로 카테고리·카드·공용 여부 채우기 ----------
const INCOME_KEYWORD = /월급|급여|보너스|상여|성과급|인센티브|이자|배당|환급|용돈받|당근|중고판매|연말정산|실업급여|아동수당|부모급여/;

export function enrichItem(item, { merchants = [], cards = [], cardMap, role, lastCardId }) {
  const guessIncome = item.income || INCOME_KEYWORD.test(item.merchant);
  // 환불은 수입으로 넣되, 사용처는 원래 지출처 이름 그대로 (예: 쿠팡 환불)
  const found = findKnownMerchant(item.merchant, merchants, item.refund ? false : guessIncome);
  const knownAsIncome = !guessIncome && merchants.some((m) => m.is_income && squash(m.content) === squash(item.merchant));
  const income = guessIncome || knownAsIncome;
  const similar = found?.match || null;
  const merchant = similar && found.corrected ? similar.content : item.merchant;

  // 지난 기록이 '기타'면 정보가 없으니 이름으로 다시 추측
  const pastCat = !item.refund && similar?.category && !/^기타/.test(similar.category) ? similar.category : null;
  let category = item.category || pastCat;
  if (category && income && !INCOME_CATEGORIES.includes(category)) category = item.refund ? '기타 수입' : null;
  if (category && !income && !EXPENSE_CATEGORIES.includes(category)) category = null;
  if (!category && !(income && item.refund)) category = guessCategory(merchant, { income });
  if (!category) category = income ? '기타 수입' : '기타';

  // 결제자: 말한 사람("내"=이 폰 주인) → (카드 주인) → 이 폰 주인
  const owner = item.cardOwner === 'me' ? role : item.cardOwner;
  const speaker = item.payer || owner || role;
  // 카드: 말한 카드 → 같은 사용처에서 쓴 카드 → 마지막에 쓴 카드 → 그 사람 카드 → 공용 카드
  const usable = (c) => c && c.is_active !== false && (c.owner === speaker || c.owner === 'joint');
  let card = null;
  if (!income) {
    if (item.card !== undefined) card = item.card; // 직접 말한 카드(또는 "현금" = null)
    else if (item.cardCandidates?.length) {
      // 이름이 같은 카드 → 그 사람 카드 → 공용 → 첫 번째
      const list = item.cardCandidates.filter((c) => c.is_active !== false);
      card = list.find((c) => c.owner === speaker) || list.find((c) => c.owner === 'joint') || list[0] || null;
    } else if (owner) {
      // "와이프카드", "남편꺼": 그 사람 카드 중 이 사용처에서 쓴 것 → 마지막에 쓴 것 → 첫 번째
      const own = (c) => c && c.is_active !== false && c.owner === owner;
      const fromHistory = similar?.card_id != null ? cardMap?.get(String(similar.card_id)) : null;
      const last = lastCardId ? cardMap?.get(String(lastCardId)) : null;
      card = [fromHistory, last, cards.find(own)].find(own) || null;
    } else {
      const fromHistory = similar?.card_id != null ? cardMap?.get(String(similar.card_id)) : null;
      const last = !item.payer && lastCardId ? cardMap?.get(String(lastCardId)) : null;
      card = [fromHistory, last, cards.find((c) => c.owner === speaker), cards.find((c) => c.owner === 'joint')].find(usable) || null;
    }
  }
  const payer = card && (card.owner === 'husband' || card.owner === 'wife') ? card.owner : speaker;

  const joint = income ? false : item.joint !== null && item.joint !== undefined ? item.joint : similar ? similar.is_joint_expense !== false : true;

  return {
    ...item,
    merchant,
    originalMerchant: item.merchant,
    corrected: Boolean(similar && found.corrected),
    income,
    category,
    joint,
    payer,
    cardId: card ? card.id : null,
    cardName: card ? card.card_name : null,
    cardSaid: item.card !== undefined || Boolean(item.cardCandidates?.length) || Boolean(owner),
    known: Boolean(item.category) || Boolean(pastCat), // 이름 단어로만 고른 카테고리는 ·추정 표시
    lastAmount: similar?.amount ?? null,
  };
}

// 음성 인식 후보 중 가장 말이 되는 것 고르기
export function scoreTranscript(text, { merchants = [], cards = [], nicknames = null } = {}) {
  const { items, errors } = parseQuickText(text, new Date(), { cards, merchants, nicknames });
  let score = items.length * 10 - errors.length * 8;
  for (const it of items) if (findKnownMerchant(it.merchant, merchants, it.income)) score += 4;
  return score;
}
