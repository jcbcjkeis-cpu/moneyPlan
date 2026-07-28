import React, { useMemo } from 'react';
import { exportExpensesToCsv } from '../../utils/exportToCsv';

export default function CalendarHome({
  onOpenModal,
  onOpenSettings,
  onDeleteExpense,
  expenses = [],
  budgetLimit = 500000,
  nicknames = { husband: '남편', wife: '아내' },
  currentUserRole,
  onRoleChange,
  selectedDate,
  onSelectDate,
  yearMonth = '2026-07',
  onPrevMonth,
  onNextMonth,
}) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const totalExpense = useMemo(() => {
    return expenses.filter(e => !e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

  const totalIncome = useMemo(() => {
    return expenses.filter(e => e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

  const consumptionRate = Math.min(Math.round((totalExpense / budgetLimit) * 100), 100);

  const getGaugeColor = (rate) => {
    if (rate >= 100) return 'from-red-600 to-rose-500';
    if (rate >= 70) return 'from-amber-500 to-yellow-400';
    return 'from-blue-600 to-indigo-500';
  };

  const dailyMap = useMemo(() => {
    const map = {};
    expenses.forEach((ex) => {
      if (!ex.expense_date) return;
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      if (!map[dayNum]) map[dayNum] = { expense: 0, income: 0, husband: false, wife: false };
      if (ex.is_income) map[dayNum].income += Number(ex.amount || 0);
      else map[dayNum].expense += Number(ex.amount || 0);
      if (ex.payer === 'husband') map[dayNum].husband = true;
      if (ex.payer === 'wife') map[dayNum].wife = true;
    });
    return map;
  }, [expenses]);

  const selectedDayExpenses = useMemo(() => {
    return expenses.filter((ex) => {
      if (!ex.expense_date) return false;
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      return dayNum === selectedDate;
    });
  }, [expenses, selectedDate]);

  const handleExport = () => exportExpensesToCsv(expenses, yearMonth);

  return (
    <div className="flex flex-col w-full min-h-screen pb-28 select-none">
      
      {/* 1. 글래스모피즘 상단 헤더 & 월 이동 화살표 컨트롤러 */}
      <header className="glass-header text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 transition-all">
        <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-2xl border border-slate-700/60 shadow-inner">
          <button type="button" onClick={onPrevMonth} className="p-1 hover:text-blue-400 active:scale-75 transition-transform text-sm" title="이전 달">◀</button>
          <h1 className="text-sm font-black tracking-tight px-1 min-w-[80px] text-center">{year}년 {month}월</h1>
          <button type="button" onClick={onNextMonth} className="p-1 hover:text-blue-400 active:scale-75 transition-transform text-sm" title="다음 달">▶</button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/80 text-[11px] font-bold shadow-xs">
            <button
              type="button"
              onClick={() => onRoleChange('husband')}
              className={`px-2.5 py-1 rounded-lg transition-all ${currentUserRole === 'husband' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              👨 {nicknames.husband}
            </button>
            <button
              type="button"
              onClick={() => onRoleChange('wife')}
              className={`px-2.5 py-1 rounded-lg transition-all ${currentUserRole === 'wife' ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              👩 {nicknames.wife}
            </button>
          </div>

          <button type="button" onClick={handleExport} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-xs transition active:scale-90" title="엑셀 백업">📥</button>
          <button type="button" onClick={onOpenSettings} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 text-sm transition active:scale-90" title="설정">⚙️</button>
        </div>
      </header>

      {/* 2. 대시보드 카드 (고정 예산 기반 소진율 게이지) */}
      <section className="bg-white p-5 border-b border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">💸 {month}월 총 지출</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{totalExpense.toLocaleString()} <span className="text-sm font-bold text-slate-500">원</span></span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">💰 {month}월 총 수입</span>
            <span className="text-base font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">+{totalIncome.toLocaleString()} 원</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
          <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-xs ${getGaugeColor(consumptionRate)}`} style={{ width: `${consumptionRate}%` }} />
        </div>
        <div className="flex justify-between items-center mt-2 text-[11px] font-medium text-slate-500">
          <span>예산 <strong className="text-slate-800 font-bold">{budgetLimit.toLocaleString()}원</strong> 중 <strong className="text-slate-900 font-extrabold">{consumptionRate}%</strong> 소진</span>
          <span className="font-bold">{consumptionRate >= 100 ? '🔴 예산 초과' : consumptionRate >= 70 ? '🟡 주의 구간' : '🟢 안전 구간'}</span>
        </div>
      </section>

      {/* 3. 모던 달력 그리드 (월별 일수 자동 연산) */}
      <section className="bg-white p-3.5 flex-1 border-b border-slate-200/80">
        <div className="grid grid-cols-7 text-center pb-2.5 mb-1 border-b border-slate-100 text-[11px] font-black tracking-wider uppercase">
          <span className="text-rose-500">일</span><span className="text-slate-400">월</span><span className="text-slate-400">화</span><span className="text-slate-400">수</span><span className="text-slate-400">목</span><span className="text-slate-400">금</span><span className="text-blue-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 auto-rows-[68px]">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayData = dailyMap[day];
            const isSelected = selectedDate === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDate(day)}
                className={`relative flex flex-col items-center justify-start pt-1.5 rounded-2xl border transition-all duration-200 active:scale-95 ${
                  isSelected ? 'border-blue-500 bg-blue-50/80 shadow-md shadow-blue-500/10 font-black scale-[1.02] z-10' : 'border-slate-100/80 hover:bg-slate-50 hover:border-slate-200 font-bold'
                }` }
              >
                <span className={`text-[12px] leading-none ${day % 7 === 1 ? 'text-rose-500 font-extrabold' : day % 7 === 0 ? 'text-blue-500 font-extrabold' : 'text-slate-700'}`}>{day}</span>

                {dayData && dayData.expense > 0 && (
                  <span className="text-[10px] tracking-tighter text-slate-700 mt-1 font-extrabold">-{(dayData.expense / 10000).toFixed(1)}</span>
                )}
                {dayData && dayData.income > 0 && (
                  <span className="text-[9px] tracking-tighter text-emerald-600 font-black">+{(dayData.income / 10000).toFixed(1)}</span>
                )}

                <div className="absolute bottom-1.5 flex space-x-1 items-center justify-center">
                  {dayData?.husband && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-xs block" title={nicknames.husband} />}
                  {dayData?.wife && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-xs block" title={nicknames.wife} />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. 선택 일자 상세 내역 (원터치 휴지통 🗑️ 포함) */}
      <section className="bg-slate-50/80 p-4 mt-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
            <span>📅 {month}월 {selectedDate}일 상세 내역 ({selectedDayExpenses.length}건)</span>
          </h3>
          <button type="button" onClick={onOpenModal} className="text-xs text-blue-600 font-black hover:underline flex items-center space-x-0.5 active:scale-95 transition">+ 내역 추가</button>
        </div>

        <div className="space-y-2">
          {selectedDayExpenses.length > 0 ? (
            selectedDayExpenses.map((item) => (
              <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden flex-1 pr-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg text-white shrink-0 shadow-2xs ${item.payer === 'husband' ? 'bg-gradient-to-r from-blue-600 to-blue-500' : 'bg-gradient-to-r from-rose-600 to-rose-500'}`}>
                    {item.payer === 'husband' ? `🙋‍♂️ ${nicknames.husband}` : `🙋‍♀️ ${nicknames.wife}`}
                  </span>
                  <div className="truncate">
                    <p className="text-xs font-extrabold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{item.content}</p>
                    <p className="text-[10px] font-medium text-slate-400">{item.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2.5 shrink-0">
                  <span className={`text-xs font-black tracking-tight ${item.is_income ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {item.is_income ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">원</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteExpense && onDeleteExpense(item.id, item.is_settled)}
                    className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-all text-sm active:scale-75 cursor-pointer"
                    title="내역 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs font-bold text-slate-400 bg-white/60 rounded-2xl border border-dashed border-slate-300/80">이날은 등록된 내역이 없습니다. 가볍게 터치해 추가해보세요! ➕</div>
          )}
        </div>
      </section>
    </div>
  );
}
