import React, { useState, useMemo } from 'react';
import { exportExpensesToCsv } from '../../utils/exportToCsv';

export default function CalendarHome({ onOpenModal, expenses = [] }) {
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());
  const budgetLimit = 500000; // 월 예산 50만 원 기준

  // 1. Supabase에서 넘어온 실제 지출 데이터 기반 총 지출액 계산
  const totalExpense = useMemo(() => {
    return expenses.reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
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

  // 2. 일별 지출 데이터 및 남편/아내 도트 동적 매핑
  const dailyMap = useMemo(() => {
    const map = {};
    expenses.forEach((ex) => {
      // 날짜 파싱 (YYYY-MM-DD 중 일자 추출)
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      if (!map[dayNum]) {
        map[dayNum] = { total: 0, husband: false, wife: false };
      }
      map[dayNum].total += Number(ex.amount || 0);
      if (ex.payer === 'husband') map[dayNum].husband = true;
      if (ex.payer === 'wife') map[dayNum].wife = true;
    });
    return map;
  }, [expenses]);

  // 3. 선택한 날짜의 상세 지출 내역 필터링
  const selectedDayExpenses = useMemo(() => {
    return expenses.filter((ex) => {
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      return dayNum === selectedDate;
    });
  }, [expenses, selectedDate]);

  const handleExport = () => {
    exportExpensesToCsv(expenses, '2026-07');
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-24">
      {/* 예산 70% 이상 소진 시 경고 바 */}
      {consumptionRate >= 70 && (
        <div className={`text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md ${consumptionRate >= 100 ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}>
          <div className="flex items-center space-x-1.5">
            <span className="text-base">🚨</span>
            <span>[예산 알림] 현재 예산의 {consumptionRate}%를 소진했습니다!</span>
          </div>
          <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] uppercase">{consumptionRate >= 100 ? '초과' : '주의'}</span>
        </div>
      )}

      <header className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <button type="button" className="p-1 text-slate-400">◀</button>
        <h1 className="text-base font-bold tracking-wide">2026년 7월 가계부</h1>
        <div className="flex items-center space-x-3">
          <button type="button" onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 text-slate-300 transition" title="엑셀 백업">📥 엑셀</button>
          <span className="text-lg">⚙️</span>
        </div>
      </header>

      {/* 월간 요약 & 예산 게이지 */}
      <section className="bg-white px-5 py-4 border-b border-slate-200 shadow-xs">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-xs text-slate-500 font-medium block">💸 7월 총 지출</span>
            <span className="text-lg font-extrabold text-slate-800">
              {totalExpense.toLocaleString()} <span className="text-xs font-normal">원</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium block">잔여 예산</span>
            <span className={`text-sm font-bold ${budgetLimit - totalExpense < 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {(budgetLimit - totalExpense).toLocaleString()} <span className="text-xs font-normal">원</span>
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center">
          <div
            className={`h-full transition-all duration-500 ${getGaugeColor(consumptionRate)}`}
            style={{ width: `${consumptionRate}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500">
          <span>소진율 <strong className="text-slate-700">{consumptionRate}%</strong></span>
          <span>{consumptionRate >= 100 ? '🔴 예산 소진' : consumptionRate >= 70 ? '🟡 주의 구간' : '🟢 안전 구간'}</span>
        </div>
      </section>

      {/* 캘린더 그리드 */}
      <section className="bg-white p-3 flex-1 border-b border-slate-200">
        <div className="grid grid-cols-7 text-center pb-2 mb-1 border-b border-slate-100 text-[12px] font-semibold">
          <span className="text-rose-500">일</span>
          <span className="text-slate-600">월</span>
          <span className="text-slate-600">화</span>
          <span className="text-slate-600">수</span>
          <span className="text-slate-600">목</span>
          <span className="text-slate-600">금</span>
          <span className="text-blue-500">토</span>
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
                  isSelected
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs font-bold'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <span className={`text-[12px] leading-none ${day % 7 === 1 ? 'text-rose-500' : day % 7 === 0 ? 'text-blue-500' : 'text-slate-700'}`}>
                  {day}
                </span>

                {dayData && dayData.total > 0 && (
                  <span className="text-[10px] tracking-tighter text-slate-600 mt-1 font-medium">
                    -{(dayData.total / 10000).toFixed(1)}
                  </span>
                )}

                <div className="absolute bottom-1.5 flex space-x-0.5 items-center justify-center">
                  {dayData?.husband && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block" title="남편 지출" />}
                  {dayData?.wife && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" title="아내 지출" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 선택 일자 상세 내역 */}
      <section className="bg-slate-50 p-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <span>📅 7월 {selectedDate}일 상세 내역</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-normal">
              총 {selectedDayExpenses.length}건
            </span>
          </h3>
          <button
            type="button"
            onClick={onOpenModal}
            className="text-xs text-blue-600 font-semibold hover:underline flex items-center space-x-0.5"
          >
            <span>+ 내역 추가</span>
          </button>
        </div>

        <div className="space-y-2">
          {selectedDayExpenses.length > 0 ? (
            selectedDayExpenses.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md text-white shrink-0 ${
                      item.payer === 'husband' ? 'bg-blue-500' : 'bg-rose-500'
                    }`}
                  >
                    {item.payer === 'husband' ? '🙋‍♂️ 남편' : '🙋‍♀️ 아내'}
                  </span>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.content}</p>
                    <p className="text-[10px] text-slate-400">{item.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-slate-800">
                    -{item.amount.toLocaleString()} <span className="text-[10px] font-normal">원</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
              이날은 등록된 지출 내역이 없습니다. 새로운 지출을 추가해 보세요! ➕
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
