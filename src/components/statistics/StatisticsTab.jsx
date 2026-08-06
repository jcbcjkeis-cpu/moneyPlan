import React, { useMemo } from 'react';

const EXPENSE_CATEGORIES = ['식비', '생필품', '장보기', '카페/간식', '교통/주유/차량', '쇼핑/뷰티/의류', '문화/여가/여행', '의료/건강', '교육/육아', '경조사/선물/용돈', '보험/세금', '공과금', '회비', '취미', '기타'];

export default function StatisticsTab({
  expenses = [],
  prevMonthExpenses = [],
  budgetLimit = 500000,
  nicknames = { husband: '남편', wife: '아내' },
  yearMonth = '2026-07',
  onPrevMonth,
  onNextMonth,
}) {
  const [year, month] = yearMonth.split('-').map(Number);

  const currExpenses = useMemo(() => expenses.filter(e => !e.is_income), [expenses]);
  const currIncome = useMemo(() => expenses.filter(e => e.is_income).reduce((acc, c) => acc + Number(c.amount || 0), 0), [expenses]);
  const currTotalSpend = useMemo(() => currExpenses.reduce((acc, c) => acc + Number(c.amount || 0), 0), [currExpenses]);

  const prevExpenses = useMemo(() => prevMonthExpenses.filter(e => !e.is_income), [prevMonthExpenses]);
  const prevTotalSpend = useMemo(() => prevExpenses.reduce((acc, c) => acc + Number(c.amount || 0), 0), [prevExpenses]);

  const momDiff = currTotalSpend - prevTotalSpend;
  const momRate = prevTotalSpend > 0 ? Math.round((momDiff / prevTotalSpend) * 100) : null;

  const consumptionRate = Math.min(Math.round((currTotalSpend / budgetLimit) * 100), 100);
  const daysPassed = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() + 1 === month) {
      return Math.max(now.getDate(), 1);
    }
    return new Date(year, month, 0).getDate();
  }, [year, month]);
  
  const dailyAvgSpend = Math.round(currTotalSpend / daysPassed);

  const roleShare = useMemo(() => {
    let hSpend = 0, wSpend = 0;
    currExpenses.forEach(e => {
      if (e.payer === 'husband') hSpend += Number(e.amount || 0);
      else if (e.payer === 'wife') wSpend += Number(e.amount || 0);
    });
    const total = hSpend + wSpend;
    const hRate = total > 0 ? Math.round((hSpend / total) * 100) : 50;
    const wRate = total > 0 ? 100 - hRate : 50;
    return { hSpend, wSpend, hRate, wRate, total };
  }, [currExpenses]);

  const categoryStats = useMemo(() => {
    const map = {};
    currExpenses.forEach(e => {
      // ★ 통계 계산 시 새 목록에 없는 구 카테고리 데이터는 무조건 '기타'로 합산 (고아 항목 차단)
      const safeCat = EXPENSE_CATEGORIES.includes(e.category) ? e.category : '기타';
      if (!map[safeCat]) map[safeCat] = { name: safeCat, amount: 0, count: 0 };
      map[safeCat].amount += Number(e.amount || 0);
      map[safeCat].count += 1;
    });
    
    const sorted = Object.values(map).sort((a, b) => b.amount - a.amount);
    return sorted.map(item => ({
      ...item,
      rate: currTotalSpend > 0 ? Math.round((item.amount / currTotalSpend) * 100) : 0
    }));
  }, [currExpenses, currTotalSpend]);

  const topCategory = categoryStats.length > 0 ? categoryStats[0] : null;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28 select-none font-sans animate-fade-in">
      <header className="bg-white/90 backdrop-blur-md px-5 py-3.5 flex items-center justify-between sticky top-0 z-30 border-b border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-1">
          <button type="button" onClick={onPrevMonth} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-90">◀</button>
          <h1 className="text-base font-black text-slate-800 tracking-tight px-2 min-w-[90px] text-center">{year}년 {month}월 통계</h1>
          <button type="button" onClick={onNextMonth} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-90">▶</button>
        </div>
        <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100/80 shadow-2xs">📊 생활비 운용 분석</span>
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider flex items-center space-x-1">
              <span>💳</span><span>이번 달 총 지출액</span>
            </span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">수입 +{currIncome.toLocaleString()}원</span>
          </div>
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-3xl font-black tracking-tight">{currTotalSpend.toLocaleString()} <span className="text-base font-bold text-slate-400">원</span></span>
            <span className="text-xs font-bold text-slate-300">예산의 {consumptionRate}% 소진</span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-300">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 block animate-pulse" />
              <span>{month}월 1일부터 {daysPassed}일간 일평균 지출</span>
            </span>
            <span className="font-extrabold text-white">{dailyAvgSpend.toLocaleString()}원 / 일</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
              <span className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-sm">📈</span>
              <span>전달({month - 1 > 0 ? month - 1 : 12}월) 대비 생활비 증감 분석</span>
            </h3>
            {momRate !== null && (
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${momDiff <= 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                {momDiff <= 0 ? `↓ ${Math.abs(momRate)}% 절약` : `↑ ${momRate}% 증가`}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">저번 달 총 지출액</span>
              <span className="text-sm font-extrabold text-slate-700">{prevTotalSpend.toLocaleString()}원</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">전달 대비 실액수 차이</span>
              {prevTotalSpend === 0 ? (
                <span className="text-xs font-extrabold text-indigo-600">✨ 이번 달 첫 기록</span>
              ) : (
                <span className={`text-base font-black ${momDiff <= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                  {momDiff <= 0 ? `${Math.abs(momDiff).toLocaleString()}원 덜 씀 🎉` : `+${momDiff.toLocaleString()}원 더 씀 🚨`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
              <span className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 flex items-center justify-center text-sm">⚖️</span>
              <span>부부 생활비 결제 비중</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400">총 {currExpenses.length}건 결제</span>
          </div>
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex p-0.5 border border-slate-200/60 shadow-inner mb-3">
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-l-full transition-all duration-700 relative" style={{ width: `${roleShare.hRate}%` }} />
            <div className="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-r-full transition-all duration-700 relative" style={{ width: `${roleShare.wRate}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-100 flex justify-between items-center">
              <span className="text-blue-900">🙋‍♂️ {nicknames.husband}</span>
              <div className="text-right">
                <span className="font-black text-blue-600 block">{roleShare.hSpend.toLocaleString()}원</span>
                <span className="text-[10px] text-blue-400 font-semibold">{roleShare.hRate}% 비중</span>
              </div>
            </div>
            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-100 flex justify-between items-center">
              <span className="text-rose-900">🙋‍♀️ {nicknames.wife}</span>
              <div className="text-right">
                <span className="font-black text-rose-600 block">{roleShare.wSpend.toLocaleString()}원</span>
                <span className="text-[10px] text-rose-400 font-semibold">{roleShare.wRate}% 비중</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
              <span className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center text-sm">📑</span>
              <span>카테고리별 사용 금액 및 비중</span>
            </h3>
            {topCategory && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">1위: {topCategory.name.split(' ')[1] || topCategory.name}</span>
            )}
          </div>
          <div className="space-y-3.5">
            {categoryStats.length > 0 ? (
              categoryStats.map((cat, idx) => (
                <div key={cat.name} className="space-y-1.5 group">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <span className="w-5 text-center text-slate-400 font-extrabold text-[11px]">{idx + 1}</span>
                      <span className="text-slate-800 truncate">{cat.name}</span>
                      <span className="text-[10px] font-medium text-slate-400">({cat.count}건)</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900">{cat.amount.toLocaleString()}원</span>
                      <span className="text-[10px] font-extrabold text-indigo-600 ml-1.5 w-8 inline-block text-right">{cat.rate}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500 group-hover:brightness-110" style={{ width: `${cat.rate}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                이번 달 등록된 지출 내역이 없습니다.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
