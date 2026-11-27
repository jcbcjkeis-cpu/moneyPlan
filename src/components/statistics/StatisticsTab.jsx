import React, { useMemo, useState } from 'react';
import { HelpTitle } from '../common/Help';
import { ChevronLeft, ChevronRight, ChevronRight as Go } from 'lucide-react';
import { normalizeCategory } from '../../constants/categories';
import { formatNumber, toNumber } from '../../lib/format';
import { findCard } from '../../lib/cards';
import { buildRange, elapsedDays, weekdayCounts } from '../../lib/statsRange';
import { useStatsData } from '../../hooks/useStatsData';
import ColumnChart from './ColumnChart';

const TYPE_LABEL = { CREDIT: '신용카드', DEBIT: '체크카드', ACCOUNT: '계좌', CASH: '카드 미선택' };
const MODES = [
  { id: 'month', label: '월' },
  { id: 'week', label: '주' },
  { id: 'days30', label: '30일' },
  { id: 'year', label: '올해' },
];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const sum = (list) => list.reduce((a, c) => a + toNumber(c.amount), 0);
const inRange = (e, s, t) => e.expense_date >= s && e.expense_date <= t;

export default function StatisticsTab({
  budgetLimit, nicknames, yearMonth, onPrevMonth, onNextMonth, onCategoryClick, onMerchantClick, onEditExpense,
  allCards = [], cardMap, version, hiddenIds,
}) {
  const [mode, setMode] = useState('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const range = useMemo(() => buildRange(mode, { yearMonth, weekOffset, year }), [mode, yearMonth, weekOffset, year]);
  const { rows: rawRows, loading } = useStatsData(range.fetchStart, range.end, version);
  const rows = useMemo(() => (hiddenIds?.size ? rawRows.filter((r) => !hiddenIds.has(String(r.id))) : rawRows), [rawRows, hiddenIds]);

  const cur = useMemo(() => rows.filter((e) => inRange(e, range.start, range.end)), [rows, range]);
  const spend = useMemo(() => cur.filter((e) => !e.is_income), [cur]);
  const total = sum(spend);
  const income = sum(cur.filter((e) => e.is_income));
  const prevTotal = useMemo(() => sum(rows.filter((e) => !e.is_income && inRange(e, range.prevStart, range.prevEnd))), [rows, range]);
  const diff = total - prevTotal;
  const diffRate = prevTotal > 0 ? Math.round((diff / prevTotal) * 100) : null;
  const days = elapsedDays(range.start, range.end);
  const dailyAvg = days ? Math.round(total / days) : 0;
  const budgetRate = mode === 'month' && budgetLimit > 0 ? Math.round((total / budgetLimit) * 100) : null;

  // 추이
  const trend = useMemo(() => range.buckets.map((b) => ({
    ...b, value: sum(rows.filter((e) => !e.is_income && inRange(e, b.start, b.end))),
  })), [rows, range]);
  const trendAvg = trend.length ? Math.round(trend.reduce((a, b) => a + b.value, 0) / trend.length) : 0;

  // 요일별 하루 평균
  const weekday = useMemo(() => {
    if (mode === 'week') return null;
    const counts = weekdayCounts(range.start, range.end);
    const totals = [0, 0, 0, 0, 0, 0, 0];
    spend.forEach((e) => { totals[new Date(`${e.expense_date}T00:00:00`).getDay()] += toNumber(e.amount); });
    const order = [1, 2, 3, 4, 5, 6, 0]; // 월~일
    const data = order.map((d) => ({ key: String(d), label: WEEK[d], fullLabel: `${WEEK[d]}요일 하루 평균`, value: counts[d] ? Math.round(totals[d] / counts[d]) : 0 }));
    const max = Math.max(...data.map((d) => d.value));
    return max > 0 ? data.map((d) => ({ ...d, current: d.value === max })) : null;
  }, [mode, range, spend]);
  const topDay = weekday?.find((d) => d.current);

  // 누가 얼마나
  const share = useMemo(() => {
    let h = 0; let w = 0; let joint = 0;
    spend.forEach((e) => {
      const a = toNumber(e.amount);
      if (e.payer === 'husband') h += a; else if (e.payer === 'wife') w += a;
      if (e.is_joint_expense) joint += a;
    });
    const t = h + w;
    const hRate = t > 0 ? Math.round((h / t) * 100) : 50;
    return { h, w, joint, personal: t - joint, hRate, wRate: 100 - hRate };
  }, [spend]);

  const categoryStats = useMemo(() => {
    const map = {};
    spend.forEach((e) => {
      const cat = normalizeCategory(e.category, false);
      if (!map[cat]) map[cat] = { name: cat, amount: 0, count: 0 };
      map[cat].amount += toNumber(e.amount);
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, rate: total > 0 ? Math.round((c.amount / total) * 100) : 0 }));
  }, [spend, total]);

  // 사용처 TOP
  const merchantTop = useMemo(() => {
    const map = new Map();
    spend.forEach((e) => {
      const name = String(e.content || '').trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, amount: 0, count: 0 });
      const m = map.get(name);
      m.amount += toNumber(e.amount);
      m.count += 1;
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [spend]);

  // 가장 큰 지출
  const biggest = useMemo(() => [...spend].sort((a, b) => toNumber(b.amount) - toNumber(a.amount)).slice(0, 5), [spend]);

  // 결제수단별
  const cardSummary = useMemo(() => {
    const map = new Map();
    allCards.forEach((c) => map.set(String(c.id), { ...c, total: 0, count: 0 }));
    const cash = { id: 'cash', card_name: '현금 / 기타', owner: null, card_type: 'CASH', is_active: true, total: 0, count: 0 };
    spend.forEach((e) => {
      const c = cardMap ? findCard(cardMap, e.card_id) : null;
      const row = (c && map.get(String(c.id))) || cash;
      row.total += toNumber(e.amount);
      row.count += 1;
    });
    const list = [...map.values()].filter((c) => c.count > 0);
    if (cash.count > 0) list.push(cash);
    return list.sort((a, b) => b.total - a.total);
  }, [spend, allCards, cardMap]);
  const ownerName = (o) => (o === 'husband' ? nicknames.husband : o === 'wife' ? nicknames.wife : o === 'joint' ? '공용' : '');

  const prev = () => (mode === 'month' ? onPrevMonth() : mode === 'week' ? setWeekOffset((w) => w - 1) : mode === 'year' ? setYear((y) => y - 1) : null);
  const next = () => (mode === 'month' ? onNextMonth() : mode === 'week' ? setWeekOffset((w) => Math.min(0, w + 1)) : mode === 'year' ? setYear((y) => Math.min(new Date().getFullYear(), y + 1)) : null);
  const rangeForSearch = { start: range.start, end: range.end, label: range.title };

  const card = 'bg-card p-5 rounded-3xl border border-line';
  const navBtn = 'w-11 h-11 rounded-full flex items-center justify-center text-ink active:bg-fill disabled:opacity-30';
  const listCard = 'bg-card rounded-3xl border border-line overflow-hidden';

  return (
    <div className="flex flex-col w-full min-h-screen bg-app pb-28">
      <header className="bg-app/90 backdrop-blur-md px-3 sticky top-0 z-30 pt-safe">
        <div className="flex items-center justify-between pt-1.5">
          <div className="flex items-center min-w-0">
            {mode !== 'days30' && <button type="button" onClick={prev} className={navBtn} aria-label="이전 기간"><ChevronLeft size={22} /></button>}
            <div className={`px-1 text-center whitespace-nowrap ${mode === 'days30' ? 'pl-2 text-left' : ''}`}>
              <h1 className="text-[17px] font-bold text-ink num">{range.title}</h1>
              {range.sub && <p className="text-[11px] text-muted num -mt-0.5">{range.sub}</p>}
            </div>
            {mode !== 'days30' && <button type="button" onClick={next} disabled={!range.canNext} className={navBtn} aria-label="다음 기간"><ChevronRight size={22} /></button>}
          </div>
          <span className="text-[15px] font-bold text-ink pr-2 shrink-0">소비 통계</span>
        </div>
        <div className="flex bg-fill p-1 rounded-full mt-1 mb-2" role="tablist" aria-label="통계 기간">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} className={`flex-1 h-9 rounded-full text-[14px] font-bold whitespace-nowrap ${mode === m.id ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>
              {m.label === '30일' ? '최근 30일' : m.label}
            </button>
          ))}
        </div>
      </header>

      {loading && !rows.length ? (
        <div className="px-4 pt-2 space-y-3">
          {[120, 180, 160, 220].map((h) => <div key={h} className="rounded-3xl bg-card border border-line animate-shimmer" style={{ height: h }} />)}
        </div>
      ) : (
        <div className={`px-4 pt-1 space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* 요약 */}
          <div className={card}>
            <p className="text-[14px] text-muted">{range.title} 지출</p>
            <p className="num text-[30px] font-extrabold text-ink leading-tight mt-0.5">{formatNumber(total)}<span className="text-[17px] font-semibold text-muted ml-1">원</span></p>
            <p className={`text-[14px] font-semibold mt-1 ${diff > 0 && prevTotal > 0 ? 'text-danger' : 'text-ink2'}`}>
              {prevTotal === 0
                ? `${range.prevLabel} 기록이 없어 비교할 수 없어요`
                : diff === 0 ? `${range.prevLabel}과 똑같이 썼어요`
                  : diff < 0 ? `${range.prevLabel}보다 ${formatNumber(-diff)}원 덜 썼어요 (${diffRate}%)`
                    : `${range.prevLabel}보다 ${formatNumber(diff)}원 더 썼어요 (+${diffRate}%)`}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line num">
              <div><p className="text-[12px] text-muted">하루 평균</p><p className="text-[15px] font-bold text-ink">{formatNumber(dailyAvg)}</p></div>
              {budgetRate !== null
                ? <div><p className="text-[12px] text-muted">예산 대비</p><p className={`text-[15px] font-bold ${budgetRate >= 100 ? 'text-danger' : 'text-ink'}`}>{budgetRate}%</p></div>
                : <div><p className="text-[12px] text-muted">지출 건수</p><p className="text-[15px] font-bold text-ink">{spend.length}건</p></div>}
              <div><p className="text-[12px] text-muted">수입</p><p className="text-[15px] font-bold text-income">+{formatNumber(income)}</p></div>
            </div>
          </div>

          {/* 추이 */}
          <div className={card}>
            <HelpTitle
              className="text-[15px] font-bold text-ink"
              wrapClassName="mb-3"
              help="막대를 누르면 그 기간 금액이 보여요. '표로 보기'로 숫자만 볼 수도 있어요."
              right={<span className="text-[12px] text-muted num">평균 {formatNumber(trendAvg)}원</span>}
            >
              {range.trendTitle}
            </HelpTitle>
            <ColumnChart data={trend} ariaLabel={`${range.trendTitle} 지출 막대 그래프`} />
          </div>

          {/* 요일별 */}
          {weekday && (
            <div className={card}>
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-[15px] font-bold text-ink">요일별 하루 평균</h3>
                {topDay && <span className="text-[12px] text-muted">{topDay.label}요일에 가장 많이 써요</span>}
              </div>
              <ColumnChart data={weekday} height={96} ariaLabel="요일별 하루 평균 지출" />
            </div>
          )}

          {/* 누가 얼마나 */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-ink">누가 얼마나 썼나</h3>
              <span className="text-[13px] text-muted">{spend.length}건</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-fill gap-[2px]" aria-hidden="true">
              <div className="bg-husband h-full rounded-l-full" style={{ width: `${share.hRate}%` }} />
              <div className="bg-wife h-full rounded-r-full" style={{ width: `${share.wRate}%` }} />
            </div>
            <div className="flex justify-between mt-3 num">
              <div>
                <p className="text-[13px] font-semibold text-ink2 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-husband" />{nicknames.husband} {share.hRate}%</p>
                <p className="text-[16px] font-bold text-ink">{formatNumber(share.h)}원</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-ink2 flex items-center gap-1.5 justify-end"><span className="w-2.5 h-2.5 rounded-full bg-wife" />{nicknames.wife} {share.wRate}%</p>
                <p className="text-[16px] font-bold text-ink">{formatNumber(share.w)}원</p>
              </div>
            </div>
            <p className="text-[13px] text-muted mt-3 pt-3 border-t border-line num">
              공용 생활비 <strong className="text-ink">{formatNumber(share.joint)}원</strong> ({total ? Math.round((share.joint / total) * 100) : 0}%), 개인 지출 <strong className="text-ink2">{formatNumber(share.personal)}원</strong>
            </p>
          </div>

          {/* 카테고리별 */}
          <div className={listCard}>
            <div className="px-5 pt-4 pb-1"><HelpTitle className="text-[15px] font-bold text-ink" help="카테고리를 누르면 이 기간의 그 카테고리 내역만 검색해요.">카테고리별 지출</HelpTitle></div>
            {categoryStats.length > 0 ? (
              <ul>
                {categoryStats.map((cat) => (
                  <li key={cat.name}>
                    <button type="button" onClick={() => onCategoryClick(cat.name, rangeForSearch)} className="w-full text-left px-5 py-3 active:bg-fill flex items-center gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between items-baseline mb-1.5 num">
                          <span className="text-[15px] font-semibold text-ink truncate">{cat.name} <span className="text-[13px] font-normal text-muted">{cat.count}건</span></span>
                          <span className="text-[15px] font-bold text-ink shrink-0">{formatNumber(cat.amount)}원</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="flex-1 h-1.5 rounded-full bg-fill overflow-hidden"><span className="block h-full bg-ink2 rounded-full" style={{ width: `${cat.rate}%` }} /></span>
                          <span className="text-[12px] font-semibold text-muted w-9 text-right num">{cat.rate}%</span>
                        </span>
                      </span>
                      <Go size={18} className="text-muted shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-[14px] text-muted">이 기간 지출 내역이 없어요.</p>
            )}
          </div>

          {/* 사용처 TOP 10 */}
          {merchantTop.length > 0 && (
            <div className={listCard}>
              <div className="px-5 pt-4 pb-1"><HelpTitle className="text-[15px] font-bold text-ink" help="사용처를 누르면 이 기간의 그 사용처 내역만 검색해요.">많이 쓴 곳 TOP {merchantTop.length}</HelpTitle></div>
              <ol>
                {merchantTop.map((m, i) => (
                  <li key={m.name}>
                    <button type="button" onClick={() => onMerchantClick(m.name, rangeForSearch)} className="w-full text-left px-5 py-2.5 active:bg-fill flex items-center gap-3 num">
                      <span className={`w-6 text-center text-[13px] font-bold ${i < 3 ? 'text-ink' : 'text-muted'}`}>{i + 1}</span>
                      <span className="flex-1 min-w-0 text-[15px] font-semibold text-ink truncate">{m.name} <span className="text-[13px] font-normal text-muted">{m.count}회</span></span>
                      <span className="text-[15px] font-bold text-ink shrink-0">{formatNumber(m.amount)}원</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="h-2" />
            </div>
          )}

          {/* 큰 지출 TOP 5 */}
          {biggest.length > 0 && (
            <div className={listCard}>
              <div className="px-5 pt-4 pb-1"><HelpTitle className="text-[15px] font-bold text-ink" help="누르면 그 내역을 바로 고칠 수 있어요.">가장 큰 지출</HelpTitle></div>
              {biggest.map((e) => (
                <button key={e.id} type="button" onClick={() => onEditExpense(e)} className="w-full text-left px-5 py-2.5 active:bg-fill flex items-center gap-3 num">
                  <span className="text-[12px] text-muted w-11 shrink-0">{Number(e.expense_date.slice(5, 7))}/{Number(e.expense_date.slice(8))}</span>
                  <span className="flex-1 min-w-0 text-[15px] font-semibold text-ink truncate">{e.content} <span className="text-[13px] font-normal text-muted">{normalizeCategory(e.category, false)}</span></span>
                  <span className="text-[15px] font-bold text-ink shrink-0">{formatNumber(e.amount)}원</span>
                </button>
              ))}
              <div className="h-2" />
            </div>
          )}

          {/* 결제수단별 */}
          {cardSummary.length > 0 && (
            <div className={listCard}>
              <div className="px-5 pt-4 pb-1">
                <HelpTitle className="text-[15px] font-bold text-ink" wrapClassName="" help="사용한 날짜 기준이에요. 신용카드 청구액과는 다를 수 있어요.">결제수단별 사용액</HelpTitle>
              </div>
              {cardSummary.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3 border-t border-line">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink truncate">
                      {c.card_name}{!c.is_active && <span className="ml-1.5 text-[12px] text-muted">(숨김)</span>}
                    </p>
                    <p className="text-[13px] text-muted">
                      {c.owner && <span className={c.owner === 'husband' ? 'text-husband' : c.owner === 'wife' ? 'text-wife' : 'text-joint'}>{ownerName(c.owner)} · </span>}
                      {TYPE_LABEL[c.card_type] || '기타'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 num">
                    <p className="text-[15px] font-bold text-ink">{formatNumber(c.total)}원</p>
                    <p className="text-[13px] text-muted">{c.count}건</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
