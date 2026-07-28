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
  
  const { expenses, addExpense, settleMonthExpenses } = useExpenses('2026-07');
  const { cards, budgetLimit, addCard, removeCard, updateBudget } = useSettings('2026-07');

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
          />
        ) : (
          /* 실제 DB의 cards 목록을 CardSettlementTab에 넘김 */
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

      {/* 모달에도 실제 DB의 cards 목록을 넘김 */}
      <ExpenseInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addExpense}
        currentUserRole={currentUserRole}
        cards={cards}
      />

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
