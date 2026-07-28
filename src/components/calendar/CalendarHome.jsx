import React, { useState, useMemo } from 'react';
import { exportExpensesToCsv } from '../../utils/exportToCsv';

export default function CalendarHome({
  onOpenModal,
  onOpenSettings,
  expenses = [],
  budgetLimit = 500000,
  currentUserRole,
  onRoleChange,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());

  // 1. 수입과 지출 분리 합산
  const totalExpense = useMemo(() => {
    return expenses.filter(e => !e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

  const totalIncome = useMemo(() => {
    return expenses.filter(e => e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

  const consumptionRate = Math.min(
    Math.round((totalExpense / budgetLimit) * 100),
    100
  );

  const getGaugeColor = (rate) => {
    if (rate >= 100) return 'bg-red-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  // 2. 일별 지출/수입 데이터 매핑
  const dailyMap = useMemo(() => {
    const map = {};
    expenses.forEach((ex) => {
      if (!ex.expense_date) return;
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      if (!map[dayNum]) {
        map[dayNum] = { expense: 0, income: 0, husband: false, wife: false };
      }
      if (ex.is_income) {
        map[dayNum].income += Number(ex.amount || 0);
      } else {
        map[dayNum].expense += Number(ex.amount || 0);
      }
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

  const handleExport = () => {
    exportExpensesToCsv(expenses, '2026-07');
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-24">
      {consumptionRate >= 70 && (
        <div className={`text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md ${consumptionRate >= 100 ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}>
          <div className="flex items-center space-x-1.5">
            <span className="text-base">🚨</span>
            <span>[예산 알림] 현재 예산의 {consumptionRate}%를 소진했습니다!</span>
          </div>
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] uppercase">{consumptionRate >= 100 ? '초과' : '주의'}</span>
        </div>
      )}

      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <h1 className="text-base font-extrabold tracking-wide">2026년 7월 가계부</h1>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => onRoleChange('husband')}
              className={`px-2 py-0.5 rounded font-bold transition ${currentUserRole === 'husband' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}
            >
              👨 남편
            </button>
            <button
              type="button"
              onClick={() => onRoleChange('wife')}
              className={`px-2 py-0.5 rounded font-bold transition ${currentUserRole === 'wife' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
            >
              👩 아내
            </button>
          </div>

          <button type="button" onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 text-slate-300" title="엑셀 백업">📥</button>
          <button type="button" onClick={onOpenSettings} className="p-1.5 text-slate-300 hover:text-white text-lg" title="설정">⚙️</button>
        </div>
      </header>

      <section className="bg-white px-5 py-4 border-b border-slate-200 shadow-xs">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-xs text-slate-500 font-medium block">💸 7월 총 지출</span>
            <span className="text-lg font-extrabold text-slate-800">{totalExpense.toLocaleString()} <span className="text-xs font-normal">원</span></span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium block">💰 7월 총 수입</span>
            <span className="text-sm font-bold text-emerald-600">+{totalIncome.toLocaleString()} <span className="text-xs font-normal">원</span></span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center">
          <div className={`h-full transition-all duration-500 ${getGaugeColor(consumptionRate)}`} style={{ width: `${consumptionRate}%` }} />
        </div>
        <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500">
          <span>예산 <strong className="text-slate-700">{budgetLimit.toLocaleString()}원</strong> 중 <strong className="text-slate-800">{consumptionRate}%</strong> 소진</span>
          <span>{consumptionRate >= 100 ? '🔴 예산 초과' : consumptionRate >= 70 ? '🟡 주의 구간' : '🟢 안전 구간'}</span>
        </div>
      </section>

      <section className="bg-white p-3 flex-1 border-b border-slate-200">
        <div className="grid grid-cols-7 text-center pb-2 mb-1 border-b border-slate-100 text-[12px] font-semibold">
          <span className="text-rose-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1 auto-rows-[64px]">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const dayData = dailyMap[day];
            const isSelected = selectedDate === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`relative flex flex-col items-center justify-start pt-1 rounded-lg border transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50/60 shadow-xs font-bold' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <span className={`text-[12px] leading-none ${day % 7 === 1 ? 'text-rose-500' : day % 7 === 0 ? 'text-blue-500' : 'text-slate-700'}`}>{day}</span>

                {dayData && dayData.expense > 0 && (
                  <span className="text-[10px] tracking-tighter text-slate-600 mt-0.5 font-medium">-{(dayData.expense / 10000).toFixed(1)}</span>
                )}
                {dayData && dayData.income > 0 && (
                  <span className="text-[9px] tracking-tighter text-emerald-600 font-bold">+{(dayData.income / 10000).toFixed(1)}</span>
                )}

                <div className="absolute bottom-1.5 flex space-x-0.5 items-center justify-center">
                  {dayData?.husband && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block" title="남편" />}
                  {dayData?.wife && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" title="아내" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-50 p-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <span>📅 7월 {selectedDate}일 상세 내역 ({selectedDayExpenses.length}건)</span>
          </h3>
          <button type="button" onClick={onOpenModal} className="text-xs text-blue-600 font-semibold hover:underline">+ 내역 추가</button>
        </div>

        <div className="space-y-2">
          {selectedDayExpenses.length > 0 ? (
            selectedDayExpenses.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md text-white shrink-0 ${item.payer === 'husband' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                    {item.payer === 'husband' ? '🙋‍♂️ 남편' : '🙋‍♀️ 아내'}
                  </span>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.content}</p>
                    <p className="text-[10px] text-slate-400">{item.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-extrabold ${item.is_income ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {item.is_income ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-[10px] font-normal">원</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">이날은 등록된 내역이 없습니다. ➕</div>
          )}
        </div>
      </section>
    </div>
  );
}
