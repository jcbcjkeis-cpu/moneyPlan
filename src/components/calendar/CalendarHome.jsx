import React, { useMemo, useState, useEffect } from 'react';
import { exportExpensesToCsv } from '../../utils/exportToCsv';
import { supabase } from '../../lib/supabase';

export default function CalendarHome({
  onOpenModal, // 새 등록
  onEditExpense, // ★ 신설: 수정 모드
  onOpenSettings,
  onDeleteExpense,
  expenses = [],
  budgetLimit = 500000,
  nicknames = { husband: '남편', wife: '아내' },
  bgImageUrl,
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
  const firstDayOfWeek = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_expenses_alert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        (payload) => {
          const newEx = payload.new;
          const payerName = newEx.payer === 'husband' ? nicknames.husband : nicknames.wife;
          const typeText = newEx.is_income ? '💰 수입' : '💸 지출';
          const msg = `🔔 [실시간 알림] ${payerName}님이 방금 ${newEx.amount?.toLocaleString()}원(${newEx.content || typeText})을 등록했습니다!`;
          
          setToastMessage(msg);
          setTimeout(() => { setToastMessage(null); }, 4000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [nicknames]);

  const totalExpense = useMemo(() => expenses.filter(e => !e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0), [expenses]);
  const totalIncome = useMemo(() => expenses.filter(e => e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0), [expenses]);
  const consumptionRate = Math.min(Math.round((totalExpense / budgetLimit) * 100), 100);

  const getGaugeColor = (rate) => {
    if (rate >= 100) return 'bg-rose-500';
    if (rate >= 70) return 'bg-amber-500';
    return 'bg-blue-600';
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

  const selectedDayExpenses = useMemo(() => expenses.filter((ex) => {
    if (!ex.expense_date) return false;
    return parseInt(ex.expense_date.split('-')[2], 10) === selectedDate;
  }), [expenses, selectedDate]);

  const handleExport = () => exportExpensesToCsv(expenses, yearMonth);

  return (
    <div className="flex flex-col w-full min-h-screen pb-28 select-none font-sans relative overflow-hidden">
      
      {toastMessage && (
        <div className="fixed top-14 left-0 right-0 z-50 max-w-[400px] mx-auto px-4 animate-slide-down pointer-events-none">
          <div className="bg-slate-900/95 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-2xl border border-indigo-500/50 backdrop-blur-md flex items-center justify-between">
            <span>{toastMessage}</span>
            <span className="text-[10px] bg-indigo-600 px-2 py-0.5 rounded-full ml-2">NOW</span>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src={bgImageUrl} alt="custom background" className="w-full h-full object-cover object-center scale-105 animate-pulse duration-[10000ms]"/>
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-slate-50/75 to-slate-100/90 backdrop-blur-[3px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        
        <header className="bg-white/70 backdrop-blur-md px-5 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-white/50 shadow-xs transition-all">
          <div className="flex items-center space-x-1">
            <button type="button" onClick={onPrevMonth} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center transition active:scale-90 shadow-2xs border border-white/60 cursor-pointer">◀</button>
            <h1 className="text-base font-bold text-slate-800 tracking-tight px-2 min-w-[90px] text-center">{year}년 {month}월</h1>
            <button type="button" onClick={onNextMonth} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center transition active:scale-90 shadow-2xs border border-white/60 cursor-pointer">▶</button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-white/60 backdrop-blur-sm p-1 rounded-full border border-white/80 text-xs font-semibold shadow-2xs">
              <button onClick={() => onRoleChange('husband')} className={`px-3 py-1 rounded-full transition-all duration-200 ${currentUserRole === 'husband' ? 'bg-white text-blue-600 shadow-xs font-bold border border-blue-100/50' : 'text-slate-500 hover:text-slate-700'}`}>{nicknames.husband}</button>
              <button onClick={() => onRoleChange('wife')} className={`px-3 py-1 rounded-full transition-all duration-200 ${currentUserRole === 'wife' ? 'bg-white text-rose-600 shadow-xs font-bold border border-rose-100/50' : 'text-slate-500 hover:text-slate-700'}`}>{nicknames.wife}</button>
            </div>
            <button type="button" onClick={handleExport} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center text-xs transition active:scale-90 shadow-2xs border border-white/60 cursor-pointer" title="엑셀 백업">📥</button>
            <button type="button" onClick={onOpenSettings} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center text-sm transition active:scale-90 shadow-2xs border border-white/60 cursor-pointer" title="설정">⚙️</button>
          </div>
        </header>

        <section className="px-5 pt-4 pb-2">
          <div className="bg-white/75 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex justify-between items-baseline mb-4">
              <div>
                <span className="text-xs font-medium text-slate-500 block mb-1">이번 달 쓴 돈</span>
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{totalExpense.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span></span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-500 block mb-1">들어온 돈</span>
                <span className="text-sm font-bold text-emerald-600 bg-emerald-50/90 px-2.5 py-1 rounded-full border border-emerald-200/60 shadow-2xs">+{totalIncome.toLocaleString()} 원</span>
              </div>
            </div>
            <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden mb-2 p-0.5">
              <div className={`h-full rounded-full transition-all duration-500 shadow-xs ${getGaugeColor(consumptionRate)}`} style={{ width: `${consumptionRate}%` }} />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>목표 <strong className="text-slate-700 font-semibold">{budgetLimit.toLocaleString()}원</strong></span>
              <span className="font-semibold text-slate-700">{consumptionRate}% 소진 {consumptionRate >= 100 && '🚨'}</span>
            </div>
          </div>
        </section>

        <section className="px-3 py-2 flex-1">
          <div className="bg-white/70 backdrop-blur-md rounded-3xl p-4 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
            <div className="grid grid-cols-7 text-center pb-3 mb-1 text-[11px] font-semibold">
              <span className="text-rose-500">일</span><span className="text-slate-500">월</span><span className="text-slate-500">화</span><span className="text-slate-500">수</span><span className="text-slate-500">목</span><span className="text-slate-500">금</span><span className="text-blue-500">토</span>
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 auto-rows-[64px]">
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => <div key={`empty-${idx}`} className="pointer-events-none" />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dayData = dailyMap[day];
                const isSelected = selectedDate === day;
                const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
                return (
                  <button key={day} type="button" onClick={() => onSelectDate(day)} className={`relative flex flex-col items-center justify-start pt-1 rounded-2xl transition-all duration-150 group cursor-pointer ${isSelected ? 'bg-white/90 font-bold shadow-xs border border-white' : 'hover:bg-white/50'}`}>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs transition-all ${isSelected ? 'bg-slate-900 text-white font-bold shadow-xs' : dayOfWeek === 0 ? 'text-rose-500 font-semibold' : dayOfWeek === 6 ? 'text-blue-500 font-semibold' : 'text-slate-700 font-semibold'}`}>{day}</span>
                    <div className="flex flex-col items-center mt-0.5 leading-tight">
                      {dayData && dayData.expense > 0 && <span className="text-[10px] font-semibold text-slate-700 tracking-tight">-{(dayData.expense / 10000).toFixed(1)}</span>}
                      {dayData && dayData.income > 0 && <span className="text-[9px] font-bold text-emerald-600 tracking-tight">+{(dayData.income / 10000).toFixed(1)}</span>}
                    </div>
                    <div className="absolute bottom-1.5 flex space-x-1 items-center justify-center">
                      {dayData?.husband && <span className="w-1 h-1 rounded-full bg-blue-500 block shadow-2xs" title={nicknames.husband} />}
                      {dayData?.wife && <span className="w-1 h-1 rounded-full bg-rose-500 block shadow-2xs" title={nicknames.wife} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 pt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <span>📅 {month}월 {selectedDate}일 상세 내역</span>
              <span className="bg-white/80 border border-white/60 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-2xs">{selectedDayExpenses.length}건</span>
            </h3>
            <button type="button" onClick={() => onOpenModal()} className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center space-x-0.5 transition active:scale-95 cursor-pointer">+ 내역 추가</button>
          </div>

          <div className="space-y-2">
            {selectedDayExpenses.length > 0 ? (
              selectedDayExpenses.map((item) => (
                <div key={item.id} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-2xs hover:bg-white transition-all flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden flex-1 pr-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${item.payer === 'husband' ? 'bg-blue-50/90 text-blue-600 border border-blue-100' : 'bg-rose-50/90 text-rose-600 border border-rose-100'}`}>
                      {item.payer === 'husband' ? nicknames.husband.slice(0, 2) : nicknames.wife.slice(0, 2)}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.content}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{item.category}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`text-xs font-bold tracking-tight pr-1 ${item.is_income ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {item.is_income ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">원</span>
                    </span>
                    {/* ★ 신설: 연필 수정 버튼 */}
                    <button type="button" onClick={() => onEditExpense(item)} className="w-7 h-7 rounded-lg bg-white/60 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors text-sm active:scale-75 border border-white/80 cursor-pointer" title="내역 수정">✏️</button>
                    {/* 삭제 버튼 */}
                    <button type="button" onClick={() => onDeleteExpense(item.id, item.is_settled)} className="w-7 h-7 rounded-lg bg-white/60 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors text-sm active:scale-75 border border-white/80 cursor-pointer" title="내역 삭제">🗑️</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center bg-white/60 backdrop-blur-sm rounded-2xl border border-dashed border-white/80">
                <p className="text-xs font-medium text-slate-500 mb-1">이날은 등록된 내역이 없습니다</p>
                <button type="button" onClick={() => onOpenModal()} className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">+ 첫 내역 추가하기</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
