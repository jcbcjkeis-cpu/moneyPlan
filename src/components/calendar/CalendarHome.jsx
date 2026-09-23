import React, { useMemo } from 'react';
import ExpenseItem from '../expense/ExpenseItem';
import ExpenseList from '../expense/ExpenseList';
import { formatNumber, formatShort, toNumber, toYmd } from '../../lib/format';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarHome({
  expenses = [], budgetLimit, nicknames, bgImageUrl, cardMap,
  selectedDate, onSelectDate, yearMonth, onPrevMonth, onNextMonth,
  onOpenModal, onEditExpense, onDeleteExpense, onOpenSearch, onExport,
  viewMode, onViewModeChange,
}) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const todayYmd = toYmd(new Date());

  const totalExpense = useMemo(() => expenses.filter((e) => !e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [expenses]);
  const totalIncome = useMemo(() => expenses.filter((e) => e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [expenses]);
  const realRate = budgetLimit > 0 ? Math.round((totalExpense / budgetLimit) * 100) : 0;
  const barRate = Math.min(realRate, 100);
  const overAmount = totalExpense - budgetLimit;
  const gaugeColor = realRate >= 100 ? 'bg-rose-500' : realRate >= 80 ? 'bg-amber-500' : 'bg-blue-600';

  const dailyMap = useMemo(() => {
    const map = {};
    expenses.forEach((ex) => {
      if (!ex.expense_date) return;
      const day = Number(ex.expense_date.split('-')[2]);
      if (!map[day]) map[day] = { expense: 0, income: 0, husband: false, wife: false };
      if (ex.is_income) map[day].income += toNumber(ex.amount);
      else map[day].expense += toNumber(ex.amount);
      if (ex.payer === 'husband') map[day].husband = true;
      if (ex.payer === 'wife') map[day].wife = true;
    });
    return map;
  }, [expenses]);

  const selectedDayExpenses = useMemo(
    () => expenses.filter((ex) => ex.expense_date && Number(ex.expense_date.split('-')[2]) === selectedDate),
    [expenses, selectedDate],
  );

  const iconBtn = 'w-9 h-9 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center text-sm transition active:scale-90 shadow-2xs border border-white/60';

  return (
    <div className="flex flex-col w-full min-h-screen pb-28 relative">
      <div className="fixed inset-0 z-0 pointer-events-none max-w-[430px] mx-auto">
        <img src={bgImageUrl} alt="" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-slate-50/75 to-slate-100/90 backdrop-blur-[3px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <header className="bg-white/70 backdrop-blur-md px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 border-b border-white/50 pt-safe">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onPrevMonth} className={iconBtn} aria-label="이전 달">◀</button>
            <h1 className="text-base font-bold text-slate-800 tracking-tight px-1.5 min-w-[92px] text-center">{year}년 {month}월</h1>
            <button type="button" onClick={onNextMonth} className={iconBtn} aria-label="다음 달">▶</button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onViewModeChange(viewMode === 'calendar' ? 'list' : 'calendar')}
              className={iconBtn}
              aria-label={viewMode === 'calendar' ? '리스트로 보기' : '달력으로 보기'}
            >
              {viewMode === 'calendar' ? '📋' : '📅'}
            </button>
            <button type="button" onClick={onOpenSearch} className={iconBtn} aria-label="내역 검색">🔍</button>
            <button type="button" onClick={onExport} className={iconBtn} aria-label="이번 달 엑셀(CSV)로 내보내기">📥</button>
          </div>
        </header>

        <section className="px-4 pt-4 pb-2">
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-medium text-slate-500 block mb-1">이번 달 지출</span>
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatNumber(totalExpense)} <span className="text-sm font-normal text-slate-500">원</span></span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-500 block mb-1">수입</span>
                <span className="text-sm font-bold text-emerald-600">+{formatNumber(totalIncome)}원</span>
              </div>
            </div>
            <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden mb-2" role="progressbar" aria-valuenow={realRate} aria-valuemin={0} aria-valuemax={100} aria-label="예산 사용률">
              <div className={`h-full rounded-full transition-all duration-500 ${gaugeColor}`} style={{ width: `${barRate}%` }} />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>월 예산 <strong className="text-slate-700">{formatNumber(budgetLimit)}원</strong></span>
              <span className={`font-bold ${realRate >= 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                {realRate >= 100 ? `${realRate}% · ${formatNumber(overAmount)}원 초과` : `${realRate}% 사용 · ${formatNumber(budgetLimit - totalExpense)}원 남음`}
              </span>
            </div>
          </div>
        </section>

        {viewMode === 'calendar' ? (
          <>
            <section className="px-3 py-2">
              <div className="bg-white/75 backdrop-blur-md rounded-3xl p-3 border border-white/80 shadow-sm">
                <div className="grid grid-cols-7 text-center pb-2 text-xs font-semibold">
                  {WEEK.map((w, i) => (
                    <span key={w} className={i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}>{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1.5 gap-x-0.5 auto-rows-[62px]">
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => <div key={`e-${idx}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const d = dailyMap[day];
                    const isSelected = selectedDate === day;
                    const dow = (firstDayOfWeek + day - 1) % 7;
                    const isToday = `${yearMonth}-${String(day).padStart(2, '0')}` === todayYmd;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onSelectDate(day)}
                        aria-label={`${month}월 ${day}일${d?.expense ? `, 지출 ${formatNumber(d.expense)}원` : ''}`}
                        aria-pressed={isSelected}
                        className={`relative flex flex-col items-center justify-start pt-1 rounded-2xl transition ${isSelected ? 'bg-white shadow-xs border border-white' : 'hover:bg-white/50'}`}
                      >
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${isSelected ? 'bg-slate-900 text-white' : isToday ? 'ring-2 ring-blue-500 text-blue-600' : dow === 0 ? 'text-rose-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'}`}>{day}</span>
                        <div className="flex flex-col items-center mt-0.5 leading-tight">
                          {d?.expense > 0 && <span className="text-[10px] font-bold text-slate-700 tracking-tighter">-{formatShort(d.expense)}</span>}
                          {d?.income > 0 && <span className="text-[10px] font-bold text-emerald-600 tracking-tighter">+{formatShort(d.income)}</span>}
                        </div>
                        <div className="absolute bottom-1 flex gap-0.5">
                          {d?.husband && <span className="w-1 h-1 rounded-full bg-blue-500" />}
                          {d?.wife && <span className="w-1 h-1 rounded-full bg-rose-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="px-4 pt-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[13px] font-bold text-slate-700">
                  {month}월 {selectedDate}일 <span className="text-slate-500 font-medium">{selectedDayExpenses.length}건</span>
                </h3>
                <button type="button" onClick={onOpenModal} className="text-[13px] text-blue-600 font-bold active:scale-95">+ 내역 추가</button>
              </div>
              <div className="space-y-1.5">
                {selectedDayExpenses.length > 0 ? (
                  selectedDayExpenses.map((item) => (
                    <ExpenseItem key={item.id} item={item} nicknames={nicknames} cardMap={cardMap} onEdit={onEditExpense} onDelete={onDeleteExpense} />
                  ))
                ) : (
                  <div className="py-8 text-center bg-white/60 backdrop-blur-sm rounded-2xl border border-dashed border-slate-300">
                    <p className="text-[13px] font-medium text-slate-500 mb-1">이날은 등록된 내역이 없어요</p>
                    <button type="button" onClick={onOpenModal} className="text-[13px] font-bold text-blue-600">+ 내역 추가하기</button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="px-4 pt-2">
            <div className="bg-white/60 backdrop-blur-md rounded-3xl p-3 border border-white/80">
              <ExpenseList
                items={expenses}
                nicknames={nicknames}
                cardMap={cardMap}
                onEdit={onEditExpense}
                onDelete={onDeleteExpense}
                emptyText={`${month}월에 등록된 내역이 없어요. 아래 + 버튼으로 추가해보세요.`}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
