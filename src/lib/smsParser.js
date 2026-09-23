// 카드 승인 문자 파서
// 예) "신한카드(1234)승인 홍*동 12,000원(일시불)09/23 14:30 이마트 누적1,234,567원"

const ISSUERS = [
  { key: '신한', patterns: ['신한'] },
  { key: '삼성', patterns: ['삼성'] },
  { key: '현대', patterns: ['현대'] },
  { key: '국민', patterns: ['kb', '국민'] },
  { key: '롯데', patterns: ['롯데'] },
  { key: '하나', patterns: ['하나'] },
  { key: '우리', patterns: ['우리'] },
  { key: '농협', patterns: ['nh', '농협'] },
  { key: 'BC', patterns: ['bc', '비씨'] },
  { key: '씨티', patterns: ['씨티', '시티'] },
  { key: '카카오', patterns: ['카카오'] },
  { key: '토스', patterns: ['토스'] },
  { key: '케이뱅크', patterns: ['케이뱅크', 'k뱅크'] },
  { key: '기업', patterns: ['ibk', '기업'] },
];

const STOP_RE = /(총\s*)?(누적|잔액|사용가능|한도|잔여)/;
const NOISE_RE = /^(승인|일시불|체크|결제|사용|취소|\d+\s*개월|할부\s*\d*\s*개월?|\(.*?\)|[|:\-·,\s])+|(승인|일시불|체크|결제|사용|\(.*?\)|[|:\-·,\s])+$/g;

function detectIssuer(text) {
  const lower = text.toLowerCase();
  let best = null;
  ISSUERS.forEach((issuer) => {
    issuer.patterns.forEach((p) => {
      const idx = lower.indexOf(p);
      if (idx !== -1 && (best === null || idx < best.index)) best = { key: issuer.key, index: idx };
    });
  });
  return best;
}

function cleanMerchant(segment) {
  if (!segment) return '';
  let s = segment.split(STOP_RE)[0];
  const line = s.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || '';
  let prev;
  s = line;
  do { prev = s; s = s.replace(NOISE_RE, '').trim(); } while (s !== prev);
  return s;
}

function resolveDate(month, day, now = new Date()) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (candidate > tomorrow) year -= 1; // 1월에 12월 문자를 붙여넣은 경우
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseCardSms(raw, now = new Date()) {
  if (!raw || !raw.trim()) return null;
  const text = raw.replace(/\[web발신\]/gi, '').replace(/\r/g, '').trim();

  // 금액: 누적/잔액/한도 뒤에 붙은 금액은 제외하고 첫 번째 "숫자원"
  let amount = null;
  let amountIndex = -1;
  let amountEnd = -1;
  const amountRe = /(누적|잔액|한도|사용가능|잔여)?\s*:?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;
  let m;
  while ((m = amountRe.exec(text)) !== null) {
    if (!m[1]) {
      amount = Number(m[2].replace(/,/g, ''));
      amountIndex = m.index;
      amountEnd = m.index + m[0].length;
      break;
    }
  }
  if (!amount) return { ok: false, reason: '문자에서 결제 금액을 찾지 못했어요.' };

  // 날짜/시간: 09/23 14:30, 09.23 14:30
  let date = null;
  let dtIndex = -1;
  let dtEnd = -1;
  const dtRe = /(\d{1,2})[/.](\d{1,2})(?:\s*(\d{1,2}:\d{2}))?/g;
  while ((m = dtRe.exec(text)) !== null) {
    const resolved = resolveDate(Number(m[1]), Number(m[2]), now);
    if (resolved) { date = resolved; dtIndex = m.index; dtEnd = m.index + m[0].length; break; }
  }

  // 사용처: 보통 날짜·시간 뒤, 아니면 금액 뒤
  let merchant = '';
  if (dtIndex > amountIndex && dtEnd !== -1) merchant = cleanMerchant(text.slice(dtEnd));
  if (!merchant) merchant = cleanMerchant(text.slice(amountEnd).replace(/(\d{1,2})[/.](\d{1,2})(\s*\d{1,2}:\d{2})?/, ''));

  const issuer = detectIssuer(text.slice(0, amountIndex > 0 ? amountIndex : text.length));
  const installment = text.match(/(\d{1,2})\s*개월/);

  return {
    ok: true,
    amount,
    date,
    merchant,
    issuerKey: issuer?.key ?? null,
    isCancel: /취소/.test(text),
    installmentMonths: installment ? Number(installment[1]) : null,
  };
}

// 문자 속 카드사 이름과 등록된 카드 별칭을 비교해 카드 찾기
export function matchCardByIssuer(issuerKey, cards = []) {
  if (!issuerKey) return null;
  const issuer = ISSUERS.find((i) => i.key === issuerKey);
  if (!issuer) return null;
  return cards.find((c) => issuer.patterns.some((p) => (c.card_name || '').toLowerCase().includes(p))) || null;
}
