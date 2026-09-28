// 금액/날짜 표시용 공통 함수

export const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const formatWon = (v) => `${toNumber(v).toLocaleString('ko-KR')}원`;

export const formatNumber = (v) => toNumber(v).toLocaleString('ko-KR');

// 입력값에서 숫자만 남김 ("12,000원" → "12000")
export const onlyDigits = (s) => String(s ?? '').replace(/[^\d]/g, '');

// 12000 → "1만 2천원", 1234567 → "123만 4,567원" (0 입력 실수 방지용 읽기 표시)
export function formatKoreanAmount(v) {
  const n = Math.floor(toNumber(v));
  if (n <= 0) return '';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  const parts = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) {
    if (rest % 1000 === 0) parts.push(`${rest / 1000}천`);
    else parts.push(rest.toLocaleString('ko-KR'));
  }
  return `${parts.join(' ')}원`;
}

// 달력 칸용 짧은 표시 (좁은 칸에 들어가도록 최대 5글자 안팎)
// 800 → "800", 3000 → "3천", 4500 → "4.5천", 12000 → "1.2만", 133000 → "13만", 1500000 → "150만", 12000000 → "1200만"
export function formatShort(v) {
  const n = Math.round(toNumber(v));
  if (n < 1000) return n.toLocaleString('ko-KR');
  if (n < 10000) {
    const k = Math.round(n / 100) / 10;
    if (k >= 10) return '1만';
    return `${Number.isInteger(k) ? k : k.toFixed(1)}천`;
  }
  if (n < 100000) {
    const m = Math.round(n / 1000) / 10;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}만`;
  }
  return `${Math.round(n / 10000)}만`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, '0')}` };
}

export function shiftYearMonth(ym, offset) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-09-23" → "9월 23일 (수)"
export function formatDateLabel(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${wd})`;
}

// "2026-09-03T..." → "9/3"
export function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
