import React, { useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import BottomNav from './components/common/BottomNav';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import CardSettlementTab from './components/settlement/CardSettlementTab';
import SettingsModal from './components/modal/SettingsModal';
import { useExpenses } from './hooks/useExpenses';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('my_role') || 'husband');
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  
  // 기준 연월 동적 상태 관리 (기본값: 접속 당월 YYYY-MM)
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

  const { expenses, addExpense, deleteExpense, settleMonthExpenses } = useExpenses(yearMonth);
  const { cards, budgetLimit, nicknames, addCard, removeCard, updateBudget, updateNicknames } = useSettings();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between relative max-w-[430px] mx-auto shadow-2xl overflow-hidden">
      <main className="flex-1 bg-slate-50 flex flex-col overflow-x-hidden">
        {currentTab === 'calendar' ? (
          <CalendarHome 
            onOpenModal={() => setIsModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDeleteExpense={deleteExpense}
            expenses={expenses}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
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
        ) : (
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
        yearMonth={yearMonth}
        onAddCard={addCard}
        onRemoveCard={removeCard}
        onUpdateBudget={updateBudget}
        onUpdateNicknames={updateNicknames}
      />
    </div>
  );
}
