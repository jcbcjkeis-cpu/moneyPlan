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

  // 이번 달 1일의 요일 인덱스 (0:일 ~ 6:토) -> 달력 첫 주 빈칸 매우기용
  const firstDayOfWeek = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);

  const totalExpense = useMemo(() => {
    return expenses.filter(e => !e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

  const totalIncome = useMemo(() => {
    return expenses.filter(e => e.is_income).reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  }, [expenses]);

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

  const selectedDayExpenses = useMemo(() => {
    return expenses.filter((ex) => {
      if (!ex.expense_date) return false;
      const dayNum = parseInt(ex.expense_date.split('-')[2], 10);
      return dayNum === selectedDate;
    });
  }, [expenses, selectedDate]);

  const handleExport = () => exportExpensesToCsv(expenses, yearMonth);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50/50 pb-28 select-none font-sans">
      
      {/* 1. 모던 미니멀 상단 헤더 (화이트 베이스 & 심플 네비게이션) */}
      <header className="bg-white/90 backdrop-blur-md px-5 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-slate-200/60 transition-all">
        <div className="flex items-center space-x-1">
          <button 
            type="button" 
            onClick={onPrevMonth} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-90"
            title="이전 달"
          >
            <span className="text-xs">◀</span>
          </button>
          <h1 className="text-base font-bold text-slate-800 tracking-tight px-2 min-w-[90px] text-center">
            {year}년 {month}월
          </h1>
          <button 
            type="button" 
            onClick={onNextMonth} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-90"
            title="다음 달"
          >
            <span className="text-xs">▶</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* 아이폰 토글 스타일 부부 스위치 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onRoleChange('husband')}
              className={`px-3 py-1 rounded-full transition-all duration-200 ${
                currentUserRole === 'husband' 
                  ? 'bg-white text-blue-600 shadow-xs font-bold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {nicknames.husband}
            </button>
            <button
              type="button"
              onClick={() => onRoleChange('wife')}
              className={`px-3 py-1 rounded-full transition-all duration-200 ${
                currentUserRole === 'wife' 
                  ? 'bg-white text-rose-600 shadow-xs font-bold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {nicknames.wife}
            </button>
          </div>

          <button 
            type="button" 
            onClick={handleExport} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition active:scale-90" 
            title="엑셀 백업"
          >
            📥
          </button>
          <button 
            type="button" 
            onClick={onOpenSettings} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm transition active:scale-90" 
            title="설정"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* 2. 토스 스타일 클린 대시보드 카드 */}
      <section className="px-5 pt-4 pb-2">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-xs">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <span className="text-xs font-medium text-slate-400 block mb-1">이번 달 쓴 돈</span>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {totalExpense.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 block mb-1">들어온 돈</span>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-100">
                +{totalIncome.toLocaleString()} 원
              </span>
            </div>
          </div>

          {/* 슬림하고 심플한 게이지 바 */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getGaugeColor(consumptionRate)}`} 
              style={{ width: `${consumptionRate}%` }} 
            />
          </div>
          
          <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
            <span>목표 <strong className="text-slate-600 font-semibold">{budgetLimit.toLocaleString()}원</strong></span>
            <span className="font-semibold text-slate-600">
              {consumptionRate}% 소진 {consumptionRate >= 100 && '🚨'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. 극도의 미니멀리즘 캘린더 그리드 (테두리 삭제 & 여백 극대화) */}
      <section className="px-3 py-2 flex-1">
        <div className="bg-white rounded-3xl p-4 border border-slate-200/60 shadow-xs">
          
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 text-center pb-3 mb-1 text-[11px] font-semibold">
            <span className="text-rose-500">일</span>
            <span className="text-slate-400">월</span>
            <span className="text-slate-400">화</span>
            <span className="text-slate-400">수</span>
            <span className="text-slate-400">목</span>
            <span className="text-slate-400">금</span>
            <span className="text-blue-500">토</span>
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-y-2 gap-x-1 auto-rows-[64px]">
            
            {/* 1일 이전 시작 요일 오프셋 빈칸 매우기 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="pointer-events-none" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayData = dailyMap[day];
              const isSelected = selectedDate === day;
              const dayOfWeek = (firstDayOfWeek + day - 1) % 7;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={`relative flex flex-col items-center justify-start pt-1 rounded-2xl transition-all duration-150 group ${
                    isSelected ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* 애플 캘린더 스타일 선택 숫자 뱃지 */}
                  <span 
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs transition-all ${
                      isSelected 
                        ? 'bg-slate-900 text-white font-bold shadow-xs' 
                        : dayOfWeek === 0 
                        ? 'text-rose-500 font-medium' 
                        : dayOfWeek === 6 
                        ? 'text-blue-500 font-medium' 
                        : 'text-slate-700 font-medium'
                    }`}
                  >
                    {day}
                  </span>

                  {/* 심플 금액 텍스트 (단위 최소화로 가독성 확보) */}
                  <div className="flex flex-col items-center mt-0.5 leading-tight">
                    {dayData && dayData.expense > 0 && (
                      <span className="text-[10px] font-semibold text-slate-600 tracking-tight">
                        -{(dayData.expense / 10000).toFixed(1)}
                      </span>
                    )}
                    {dayData && dayData.income > 0 && (
                      <span className="text-[9px] font-bold text-emerald-500 tracking-tight">
                        +{(dayData.income / 10000).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* 하단 미니멀 파스텔 도트 인디케이터 */}
                  <div className="absolute bottom-1.5 flex space-x-1 items-center justify-center">
                    {dayData?.husband && <span className="w-1 h-1 rounded-full bg-blue-400 block" title={nicknames.husband} />}
                    {dayData?.wife && <span className="w-1 h-1 rounded-full bg-rose-400 block" title={nicknames.wife} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. 모던 심플 내역 리스트 (촌스러운 그라데이션 삭제) */}
      <section className="px-5 pt-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
            <span>📅 {month}월 {selectedDate}일 상세 내역</span>
            <span className="bg-slate-200/80 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-semibold">
              {selectedDayExpenses.length}건
            </span>
          </h3>
          <button 
            type="button" 
            onClick={onOpenModal} 
            className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center space-x-0.5 transition active:scale-95"
          >
            <span>+ 내역 추가</span>
          </button>
        </div>

        <div className="space-y-2">
          {selectedDayExpenses.length > 0 ? (
            selectedDayExpenses.map((item) => (
              <div 
                key={item.id} 
                className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 overflow-hidden flex-1 pr-2">
                  {/* 세련된 소프트 톤 아바타 뱃지 */}
                  <div 
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      item.payer === 'husband' 
                        ? 'bg-blue-50 text-blue-600 border border-blue-100/80' 
                        : 'bg-rose-50 text-rose-600 border border-rose-100/80'
                    }`}
                  >
                    {item.payer === 'husband' ? nicknames.husband.slice(0, 2) : nicknames.wife.slice(0, 2)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.content}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 shrink-0">
                  <span className={`text-xs font-bold tracking-tight ${item.is_income ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {item.is_income ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">원</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteExpense && onDeleteExpense(item.id, item.is_settled)}
                    className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors text-sm active:scale-75 cursor-pointer"
                    title="내역 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200/80">
              <p className="text-xs font-medium text-slate-400 mb-1">이날은 등록된 내역이 없습니다</p>
              <button 
                type="button" 
                onClick={onOpenModal}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                + 첫 내역 추가하기
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
