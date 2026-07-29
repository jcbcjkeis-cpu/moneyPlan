import React, { useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import BottomNav from './components/common/BottomNav';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import CardSettlementTab from './components/settlement/CardSettlementTab';
import StatisticsTab from './components/statistics/StatisticsTab';
import SettingsModal from './components/modal/SettingsModal';
import { useExpenses } from './hooks/useExpenses';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('my_role') || 'husband');
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleMonthChange = (offset) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    const newYm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setYearMonth(newYm);
    setSelectedDate(1);
  };

  const { expenses, prevMonthExpenses, isLoading: isExpensesLoading, addExpense, deleteExpense, settleMonthExpenses } = useExpenses(yearMonth);
  const { 
    cards, 
    budgetLimit, 
    nicknames, 
    bgImageUrl, 
    isLoading: isSettingsLoading, 
    addCard, 
    removeCard, 
    updateBudget, 
    updateNicknames, 
    uploadBackground, 
    resetBackground 
  } = useSettings();

  // ★ 초기 로딩 스플래시 가드: 캐시가 없거나 최초 동기화 중일 때 세련된 로딩 화면 표시
  const isInitialLoading = isSettingsLoading && (!cards || cards.length === 0);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center max-w-[430px] mx-auto text-white select-none font-sans relative overflow-hidden">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl mb-4 animate-bounce">
          <span className="text-3xl">💰</span>
        </div>
        <h1 className="text-sm font-black tracking-widest uppercase text-slate-300 mb-1">BUBOO MONEY PLAN</h1>
        <p className="text-xs text-slate-500 font-medium">최신 가계부 데이터를 동기화하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between relative max-w-[430px] mx-auto shadow-2xl overflow-hidden font-sans">
      <main className="flex-1 bg-slate-50 flex flex-col overflow-x-hidden relative">
        {currentTab === 'calendar' && (
          <CalendarHome 
            onOpenModal={() => setIsModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDeleteExpense={deleteExpense}
            expenses={expenses}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
            bgImageUrl={bgImageUrl}
            currentUserRole={currentUserRole}
            onRoleChange={(role) => {
              setCurrentUserRole(role);
              localStorage.setItem('my_role', role);
            }}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            yearMonth={yearMonth}
            onPrevMonth={() => handleMonthChange(-1)}
            onNextMonth={() => handleMonthChange(1)}
          />
        )}

        {currentTab === 'statistics' && (
          <StatisticsTab 
            expenses={expenses}
            prevMonthExpenses={prevMonthExpenses}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
            yearMonth={yearMonth}
            onPrevMonth={() => handleMonthChange(-1)}
            onNextMonth={() => handleMonthChange(1)}
          />
        )}

        {currentTab === 'settlement' && (
          <CardSettlementTab 
            expenses={expenses} 
            cards={cards}
            nicknames={nicknames}
            yearMonth={yearMonth}
            onSettleMonth={settleMonthExpenses} 
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenModal={() => setIsModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ExpenseInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addExpense}
        currentUserRole={currentUserRole}
        cards={cards}
        nicknames={nicknames}
        selectedDate={selectedDate}
        yearMonth={yearMonth}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cards={cards}
        budgetLimit={budgetLimit}
        nicknames={nicknames}
        bgImageUrl={bgImageUrl}
        yearMonth={yearMonth}
        onAddCard={addCard}
        onRemoveCard={removeCard}
        onUpdateBudget={updateBudget}
        onUpdateNicknames={updateNicknames}
        onUploadBackground={uploadBackground}
        onResetBackground={resetBackground}
      />
    </div>
  );
}
