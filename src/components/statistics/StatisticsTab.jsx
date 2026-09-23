import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as Go } from 'lucide-react';
import { normalizeCategory } from '../../constants/categories';
import { formatNumber, toNumber } from '../../lib/format';

export default function StatisticsTab({ expenses = [], prevMonthExpenses = [], isStale, budgetLimit, nicknames, yearMonth, onPrevMonth, onNextMonth, onCategoryClick }) {
  const [year, month] = yearMonth.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;

  const currExpenses = useMemo(() => expenses.filter((e) => !e.is_income), [expenses]);
  const currIncome = useMemo(() => expenses.filter((e) => e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [expenses]);
  const currTotal = useMemo(() => currExpenses.reduce((a, c) => a + toNumber(c.amount), 0), [currExpenses]);
  const prevTotal = useMemo(() => prevMonthExpenses.filter((e) => !e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [prevMonthExpenses]);
  const momDiff = currTotal - prevTotal;
  const momRate = prevTotal > 0 ? Math.round((momDiff / prevTotal) * 100) : null;
  const budgetRate = budgetLimit > 0 ? Math.round((currTotal / budgetLimit) * 100) : 0;

  const daysPassed = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() + 1 === month) return Math.max(now.getDate(), 1);
    return new Date(year, month, 0).getDate();
  }, [year, month]);
  const dailyAvg = Math.round(currTotal / daysPassed);

  const share = useMemo(() => {
    let h = 0; let w = 0; let joint = 0;
    currExpenses.forEach((e) => {
      const a = toNumber(e.amount);
      if (e.payer === 'husband') h += a; else if (e.payer === 'wife') w += a;
      if (e.is_joint_expense) joint += a;
    });
    const total = h + w;
    const hRate = total > 0 ? Math.round((h / total) * 100) : 50;
    return { h, w, joint, personal: total - joint, hRate, wRate: 100 - hRate };
  }, [currExpenses]);

  const categoryStats = useMemo(() => {
    const map = {};
    currExpenses.forEach((e) => {
      const cat = normalizeCategory(e.category, false);
      if (!map[cat]) map[cat] = { name: cat, amount: 0, count: 0 };
      map[cat].amount += toNumber(e.amount);
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, rate: currTotal > 0 ? Math.round((c.amount / currTotal) * 100) : 0 }));
  }, [currExpenses, currTotal]);

  const card = 'bg-card p-5 rounded-3xl border border-line';
  const navBtn = 'w-11 h-11 rounded-full flex items-center justify-center text-ink active:bg-fill';

  if (isStale) {
    return (
      <div className="min-h-screen bg-app pt-safe px-4 pt-20 space-y-3">
        {[120, 90, 160, 220].map((h) => <div key={h} className="rounded-3xl bg-card border border-line animate-shimmer" style={{ height: h }} />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-app pb-28">
      <header className="bg-app/90 backdrop-blur-md px-2 flex items-center justify-between sticky top-0 z-30 pt-safe">
        <div className="flex items-center py-1.5">
          <button type="button" onClick={onPrevMonth} className={navBtn} aria-label="이전 달"><ChevronLeft size={22} /></button>
          <h1 className="text-[17px] font-bold text-ink px-1 min-w-[96px] text-center num">{year}년 {month}월</h1>
          <button type="button" onClick={onNextMonth} className={navBtn} aria-label="다음 달"><ChevronRight size={22} /></button>
        </div>
        <span className="text-[15px] font-bold text-ink pr-3">소비 통계</span>
      </header>

      <div className="px-4 pt-2 space-y-3">
        <div className={card}>
          <p className="text-[14px] text-muted">이번 달 지출</p>
          <p className="num text-[30px] font-extrabold text-ink leading-tight mt-0.5">{formatNumber(currTotal)}<span className="text-[17px] font-semibold text-muted ml-1">원</span></p>
          <p className={`text-[14px] font-semibold mt-1 ${momDiff > 0 && prevTotal > 0 ? 'text-danger' : 'text-ink2'}`}>
            {prevTotal === 0
              ? `${prevMonth}월 기록이 없어 비교할 수 없어요`
              : momDiff <= 0
                ? `${prevMonth}월보다 ${formatNumber(-momDiff)}원 덜 썼어요 (${momRate}%)`
                : `${prevMonth}월보다 ${formatNumber(momDiff)}원 더 썼어요 (+${momRate}%)`}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line num">
            <div><p className="text-[12px] text-muted">하루 평균</p><p className="text-[15px] font-bold text-ink">{formatNumber(dailyAvg)}</p></div>
            <div><p className="text-[12px] text-muted">예산 대비</p><p className={`text-[15px] font-bold ${budgetRate >= 100 ? 'text-danger' : 'text-ink'}`}>{budgetRate}%</p></div>
            <div><p className="text-[12px] text-muted">수입</p><p className="text-[15px] font-bold text-income">+{formatNumber(currIncome)}</p></div>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-ink">누가 얼마나 썼나</h3>
            <span className="text-[13px] text-muted">{currExpenses.length}건</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-fill" aria-hidden="true">
            <div className="bg-husband h-full" style={{ width: `${share.hRate}%` }} />
            <div className="bg-wife h-full" style={{ width: `${share.wRate}%` }} />
          </div>
          <div className="flex justify-between mt-3 num">
            <div>
              <p className="text-[13px] font-semibold text-husband">{nicknames.husband} {share.hRate}%</p>
              <p className="text-[16px] font-bold text-ink">{formatNumber(share.h)}원</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-wife">{nicknames.wife} {share.wRate}%</p>
              <p className="text-[16px] font-bold text-ink">{formatNumber(share.w)}원</p>
            </div>
          </div>
          <p className="text-[13px] text-muted mt-3 pt-3 border-t border-line num">
            공용 생활비 <strong className="text-joint">{formatNumber(share.joint)}원</strong>, 개인 지출 <strong className="text-ink2">{formatNumber(share.personal)}원</strong>
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-line overflow-hidden">
          <h3 className="text-[15px] font-bold text-ink px-5 pt-5 pb-2">카테고리별 지출</h3>
          {categoryStats.length > 0 ? (
            <ul>
              {categoryStats.map((cat) => (
                <li key={cat.name}>
                  <button type="button" onClick={() => onCategoryClick(cat.name)} className="w-full text-left px-5 py-3 active:bg-fill flex items-center gap-3">
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
            <p className="py-10 text-center text-[14px] text-muted">{month}월 지출 내역이 없어요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
