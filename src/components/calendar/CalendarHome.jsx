import React, { useState } from 'react';
import { exportExpensesToCsv } from '../../utils/exportToCsv';

const MOCK_SUMMARY = {
  year: 2026,
  month: 7,
  totalExpense: 1450000,
  budgetLimit: 2000000,
  isOverLimit: true,
  overLimitCategory: '외식비',
  overLimitAmount: 45000,
};

const MOCK_DAILY_DATA = {
  3: { total: -15000, husband: true, wife: false, isNoSpend: false },
  4: { total: -32000, husband: false, wife: true, isNoSpend: false },
  6: { total: -85000, husband: true, wife: true, isNoSpend: false },
  8: { total: 0, husband: false, wife: false, isNoSpend: true },
  27: { total: -9000, husband: true, wife: false, isNoSpend: false },
};

const MOCK_SELECTED_DAY_EXPENSES = [
  { id: '1', payer: 'husband', title: '출근길 스타벅스 커피', card: '신한카드', amount: 4500 },
  { id: '2', payer: 'wife', title: '편의점 아이스크림', card: '현대M카드', amount: 4500 },
];

export default function CalendarHome({ onOpenModal, expenses = [], currentUserRole, onRoleChange }) {
  const [selectedDate, setSelectedDate] = useState(27);

  const consumptionRate = Math.min(
    Math.round((MOCK_SUMMARY.totalExpense / MOCK_SUMMARY.budgetLimit) * 100),
    100
  );

  const getGaugeColor = (rate) => {
    if (rate >= 100) return 'bg-red-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const handleExport = () => {
    exportExpensesToCsv(expenses.length > 0 ? expenses : MOCK_SELECTED_DAY_EXPENSES, '2026-07');
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-24">
      {MOCK_SUMMARY.isOverLimit && (
        <div className="bg-red-500 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold animate-pulse shadow-md">
          <div className="flex items-center space-x-1.5">
            <span className="text-base">🚨</span>
            <span>[한도 초과] {MOCK_SUMMARY.overLimitCategory} 예산 {MOCK_SUMMARY.overLimitAmount.toLocaleString()}원 초과!</span>
          </div>
          <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] uppercase">Danger</span>
        </div>
      )}

      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <h1 className="text-sm font-extrabold tracking-wide">
          {MOCK_SUMMARY.year}년 {MOCK_SUMMARY.month}월 가계부
        </h1>
        
        {/* 기기 주인 설정 토글 스위치 */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => onRoleChange('husband')}
            className={`px-2 py-1 rounded-md font-bold transition ${currentUserRole === 'husband' ? 'bg-blue-500 text-white shadow' : 'text-slate-400'}`}
          >
            👨 남편 폰
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('wife')}
            className={`px-2 py-1 rounded-md font-bold transition ${currentUserRole === 'wife' ? 'bg-rose-500 text-white shadow' : 'text-slate-400'}`}
          >
            👩 아내 폰
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 text-slate-300 transition" title="엑셀 백업">📥</button>
        </div>
      </header>

      <section className="bg-white px-5 py-4 border-b border-slate-200 shadow-xs">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-xs text-slate-500 font-medium block">💸 7월 총 지출</span>
            <span className="text-lg font-extrabold text-slate-800">
              {MOCK_SUMMARY.totalExpense.toLocaleString()} <span className="text-xs font-normal">원</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium block">잔여 예산</span>
            <span className={`text-sm font-bold ${MOCK_SUMMARY.budgetLimit - MOCK_SUMMARY.totalExpense < 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {(MOCK_SUMMARY.budgetLimit - MOCK_SUMMARY.totalExpense).toLocaleString()} <span className="text-xs font-normal">원</span>
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
            const dayData = MOCK_DAILY_DATA[day];
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

                {dayData && dayData.total < 0 && (
                  <span className="text-[10px] tracking-tighter text-slate-600 mt-1 font-medium">
                    {(dayData.total / 10000).toFixed(1)}
                  </span>
                )}

                {dayData?.isNoSpend && (
                  <span className="text-sm mt-0.5 animate-bounce" title="무지출 데이">✨</span>
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

      <section className="bg-slate-50 p-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <span>📅 7월 {selectedDate}일 상세 내역</span>
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-normal">
              총 {MOCK_SELECTED_DAY_EXPENSES.length}건
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
          {MOCK_SELECTED_DAY_EXPENSES.length > 0 ? (
            MOCK_SELECTED_DAY_EXPENSES.map((item) => (
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
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-400">{item.card}</p>
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
              이날은 등록된 지출 내역이 없습니다. 알뜰한 무지출 데이인가요? ✨
            </div>
          )}
        </div>
      </section>
    </div>
  );
}