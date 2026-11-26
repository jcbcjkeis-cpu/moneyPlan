// 통계 기간 계산 (월 / 주 / 최근 30일 / 올해) — 날짜는 모두 'YYYY-MM-DD' (한국 시간 기준 로컬 날짜)
import { toYmd } from './format';

const d0 = (y, m, d) => new Date(y, m, d);
const addDays = (date, n) => { const x = new Date(date); x.setDate(x.getDate() + n); return x; };
const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));
const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

// 현재 기간, 비교할 이전 기간, 추이 막대(buckets)
export function buildRange(mode, { yearMonth, weekOffset = 0, year }) {
  const today = today0();
  if (mode === 'week') {
    const start = addDays(mondayOf(today), weekOffset * 7);
    const end = addDays(start, 6);
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const s = addDays(start, (i - 7) * 7);
      return { key: toYmd(s), start: toYmd(s), end: toYmd(addDays(s, 6)), label: `${s.getMonth() + 1}/${s.getDate()}`, current: i === 7 };
    });
    return {
      title: weekOffset === 0 ? '이번 주' : weekOffset === -1 ? '지난주' : `${start.getMonth() + 1}/${start.getDate()} 주`,
      sub: `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`,
      start: toYmd(start), end: toYmd(end), prevStart: toYmd(addDays(start, -7)), prevEnd: toYmd(addDays(start, -1)), prevLabel: '지난주',
      fetchStart: buckets[0].start, buckets, trendTitle: '최근 8주', canNext: weekOffset < 0,
    };
  }
  if (mode === 'days30') {
    const start = addDays(today, -29);
    const buckets = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(start, i);
      return { key: toYmd(d), start: toYmd(d), end: toYmd(d), label: i % 7 === 2 || i === 29 ? `${d.getMonth() + 1}/${d.getDate()}` : '', fullLabel: `${d.getMonth() + 1}/${d.getDate()}`, current: i === 29 };
    });
    return {
      title: '최근 30일', sub: `${start.getMonth() + 1}/${start.getDate()} ~ 오늘`,
      start: toYmd(start), end: toYmd(today), prevStart: toYmd(addDays(start, -30)), prevEnd: toYmd(addDays(start, -1)), prevLabel: '그 전 30일',
      fetchStart: toYmd(addDays(start, -30)), buckets, trendTitle: '하루별 지출', canNext: false,
    };
  }
  if (mode === 'year') {
    const y = year;
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      key: `${y}-${String(i + 1).padStart(2, '0')}`, start: toYmd(d0(y, i, 1)), end: toYmd(d0(y, i + 1, 0)), label: `${i + 1}`, fullLabel: `${i + 1}월`,
      current: y === today.getFullYear() && i === today.getMonth(),
    }));
    return {
      title: `${y}년`, sub: y === today.getFullYear() ? `1월 1일 ~ 오늘` : '1년 전체',
      start: `${y}-01-01`, end: `${y}-12-31`, prevStart: `${y - 1}-01-01`, prevEnd: `${y - 1}-12-31`, prevLabel: `${y - 1}년`,
      fetchStart: `${y - 1}-01-01`, buckets, trendTitle: '월별 지출', canNext: y < today.getFullYear(),
    };
  }
  // month
  const [y, m] = yearMonth.split('-').map(Number);
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const s = d0(y, m - 1 - (5 - i), 1);
    return { key: toYmd(s).slice(0, 7), start: toYmd(s), end: toYmd(d0(s.getFullYear(), s.getMonth() + 1, 0)), label: `${s.getMonth() + 1}월`, current: i === 5 };
  });
  const prev = d0(y, m - 2, 1);
  return {
    title: `${y}년 ${m}월`, sub: null,
    start: toYmd(d0(y, m - 1, 1)), end: toYmd(d0(y, m, 0)), prevStart: toYmd(prev), prevEnd: toYmd(d0(y, m - 1, 0)), prevLabel: `${prev.getMonth() + 1}월`,
    fetchStart: buckets[0].start, buckets, trendTitle: '최근 6개월', canNext: true,
  };
}

// 기간 중 오늘까지 지난 날 수 (하루 평균 계산용)
export function elapsedDays(start, end) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const last = Math.min(e.getTime(), today0().getTime());
  if (last < s.getTime()) return 0;
  return Math.round((last - s.getTime()) / 86400000) + 1;
}

// 요일별 그 요일이 몇 번 있었는지 (오늘까지)
export function weekdayCounts(start, end) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const s = new Date(`${start}T00:00:00`);
  const n = elapsedDays(start, end);
  for (let i = 0; i < n; i += 1) counts[addDays(s, i).getDay()] += 1;
  return counts;
}
