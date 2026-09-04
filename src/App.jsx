import React, { useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import BottomNav from './components/common/BottomNav';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import CardSettlementTab from './components/settlement/CardSettlementTab';
import StatisticsTab from './components/statistics/StatisticsTab';
import SettingsModal from './components/modal/SettingsModal';
import PwaInstallManager from './components/common/PwaInstallManager';
import { useExpenses } from './hooks/useExpenses';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('my_role') || 'husband');
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleMonthChange = (offset) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    setYearMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(1);
  };

  const handleOpenExpenseModal = (item = null) => {
    setEditTarget(item);
    setIsModalOpen(true);
  };

  const { expenses, prevMonthExpenses, addExpense, updateExpense, deleteExpense, settleMonthExpenses, refreshExpenses } = useExpenses(yearMonth);
  // ★ allCards(전체 이력)와 cards(활성 카드) 분리
  const { 
    allCards, cards, budgetLimit, nicknames, bgImageUrl, 
    addCard, removeCard, updateBudget, updateNicknames, uploadBackground, resetBackground 
  } = useSettings();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between relative max-w-[430px] mx-auto shadow-2xl overflow-hidden font-sans">
      <PwaInstallManager />
      <main className="flex-1 bg-slate-50 flex flex-col overflow-x-hidden relative">
        {currentTab === 'calendar' && (
          <CalendarHome 
            onOpenModal={() => handleOpenExpenseModal(null)}
            onEditExpense={handleOpenExpenseModal}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDeleteExpense={deleteExpense}
            onRefresh={refreshExpenses} // ★ 실시간 데이터 갱신을 위해 함수 전달
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
          <StatisticsTab expenses={expenses} prevMonthExpenses={prevMonthExpenses} budgetLimit={budgetLimit} nicknames={nicknames} yearMonth={yearMonth} onPrevMonth={() => handleMonthChange(-1)} onNextMonth={() => handleMonthChange(1)} />
        )}
        {currentTab === 'settlement' && (
          <CardSettlementTab expenses={expenses} allCards={allCards} nicknames={nicknames} yearMonth={yearMonth} onSettleMonth={settleMonthExpenses} />
        )}
      </main>

      <BottomNav currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)} onOpenModal={() => handleOpenExpenseModal(null)} onOpenSettings={() => setIsSettingsOpen(true)} />

      <ExpenseInputModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={addExpense} onUpdate={updateExpense} editTarget={editTarget} currentUserRole={currentUserRole} cards={cards} nicknames={nicknames} selectedDate={selectedDate} yearMonth={yearMonth} />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} cards={cards} budgetLimit={budgetLimit} nicknames={nicknames} bgImageUrl={bgImageUrl} yearMonth={yearMonth} onAddCard={addCard} onRemoveCard={removeCard} onUpdateBudget={updateBudget} onUpdateNicknames={updateNicknames} onUploadBackground={uploadBackground} onResetBackground={resetBackground} />
    </div>
  );
}
