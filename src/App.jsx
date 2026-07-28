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
  
  // ★ 캘린더에서 선택한 일자 상태 관리 (기본값: 접속 당일 일자)
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  const yearMonth = '2026-07'; // 기준 연월

  const { expenses, addExpense, settleMonthExpenses } = useExpenses(yearMonth);
  const { cards, budgetLimit, addCard, removeCard, updateBudget } = useSettings(yearMonth);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative">
      <main className="flex-1">
        {currentTab === 'calendar' ? (
          <CalendarHome 
            onOpenModal={() => setIsModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            expenses={expenses}
            budgetLimit={budgetLimit}
            currentUserRole={currentUserRole}
            onRoleChange={(role) => {
              setCurrentUserRole(role);
              localStorage.setItem('my_role', role);
            }}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            yearMonth={yearMonth}
          />
        ) : (
          <CardSettlementTab 
            expenses={expenses} 
            cards={cards}
            onSettleMonth={settleMonthExpenses} 
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenModal={() => setIsModalOpen(true)}
      />

      {/* 지출/수입 입력 모달 (선택한 날짜 전달) */}
      <ExpenseInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addExpense}
        currentUserRole={currentUserRole}
        cards={cards}
        selectedDate={selectedDate}
        yearMonth={yearMonth}
      />

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cards={cards}
        budgetLimit={budgetLimit}
        onAddCard={addCard}
        onRemoveCard={removeCard}
        onUpdateBudget={updateBudget}
      />
    </div>
  );
}
