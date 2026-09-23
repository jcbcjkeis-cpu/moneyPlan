import React, { useMemo } from 'react';
import { normalizeCategory } from '../../constants/categories';
import { formatNumber, toNumber } from '../../lib/format';

export default function StatisticsTab({ expenses = [], prevMonthExpenses = [], budgetLimit, nicknames, yearMonth, onPrevMonth, onNextMonth, onCategoryClick }) {
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
    return Object.values(map)
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...c, rate: currTotal > 0 ? Math.round((c.amount / currTotal) * 100) : 0 }));
  }, [currExpenses, currTotal]);

  const card = 'bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs';

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="bg-white/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 border-b border-slate-200/80 pt-safe">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrevMonth} className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center active:scale-90" aria-label="이전 달">◀</button>
          <h1 className="text-base font-black text-slate-800 px-1.5 min-w-[92px] text-center">{year}년 {month}월</h1>
          <button type="button" onClick={onNextMonth} className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center active:scale-90" aria-label="다음 달">▶</button>
        </div>
        <span className="text-xs font-bold text-indigo-600">📊 소비 통계</span>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={card}>
            <span className="text-xs font-bold text-slate-500 block mb-1">총 지출</span>
            <span className="text-lg font-black text-slate-900">{formatNumber(currTotal)}원</span>
            <span className={`text-xs font-bold block mt-1 ${budgetRate >= 100 ? 'text-rose-600' : 'text-slate-500'}`}>예산의 {budgetRate}%</span>
          </div>
          <div className={card}>
            <span className="text-xs font-bold text-slate-500 block mb-1">하루 평균</span>
            <span className="text-lg font-black text-slate-900">{formatNumber(dailyAvg)}원</span>
            <span className="text-xs font-bold text-emerald-600 block mt-1">수입 +{formatNumber(currIncome)}원</span>
          </div>
        </div>

        <div className={card}>
          <span className="text-xs font-bold text-slate-500 block mb-1">{prevMonth}월보다</span>
          {prevTotal === 0 ? (
            <span className="text-sm font-bold text-slate-500">{prevMonth}월 지출 기록이 없어 비교할 수 없어요.</span>
          ) : (
            <span className={`text-base font-black ${momDiff <= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {momDiff <= 0 ? `${formatNumber(Math.abs(momDiff))}원 덜 썼어요` : `${formatNumber(momDiff)}원 더 썼어요`}
              {momRate !== null && <span className="text-xs font-bold ml-1.5">({momRate > 0 ? '+' : ''}{momRate}%)</span>}
            </span>
          )}
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-black text-slate-800">⚖️ 누가 얼마나 썼나</h3>
            <span className="text-xs font-bold text-slate-500">{currExpenses.length}건</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex mb-3">
            <div className="bg-blue-500 h-full" style={{ width: `${share.hRate}%` }} />
            <div className="bg-rose-500 h-full" style={{ width: `${share.wRate}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px] font-bold">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
              <span className="text-blue-900 block">{nicknames.husband}</span>
              <span className="font-black text-blue-600">{formatNumber(share.h)}원</span>
              <span className="text-xs text-blue-500 ml-1">{share.hRate}%</span>
            </div>
            <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
              <span className="text-rose-900 block">{nicknames.wife}</span>
              <span className="font-black text-rose-600">{formatNumber(share.w)}원</span>
              <span className="text-xs text-rose-500 ml-1">{share.wRate}%</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            공용 생활비 <strong className="text-purple-600">{formatNumber(share.joint)}원</strong> · 개인 지출 <strong className="text-slate-700">{formatNumber(share.personal)}원</strong>
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <h3 className="text-[13px] font-black text-slate-800">📑 카테고리별 지출</h3>
            <span className="text-xs text-slate-500">누르면 내역 보기</span>
          </div>
          {categoryStats.length > 0 ? (
            <ul className="space-y-1">
              {categoryStats.map((cat, idx) => (
                <li key={cat.name}>
                  <button type="button" onClick={() => onCategoryClick(cat.name)} className="w-full text-left py-2 px-1 rounded-xl hover:bg-slate-50 active:bg-slate-100">
                    <div className="flex justify-between items-center text-[13px] font-bold mb-1.5">
                      <span className="flex items-center gap-2 truncate pr-2">
                        <span className="w-4 text-center text-slate-400 text-xs">{idx + 1}</span>
                        <span className="text-slate-800 truncate">{cat.name}</span>
                        <span className="text-xs font-medium text-slate-400">{cat.count}건</span>
                      </span>
                      <span className="shrink-0">
                        <span className="font-black text-slate-900">{formatNumber(cat.amount)}원</span>
                        <span className="text-xs font-bold text-indigo-600 ml-1.5 w-9 inline-block text-right">{cat.rate}%</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${cat.rate}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-[13px] font-medium text-slate-500">{month}월 지출 내역이 없어요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
