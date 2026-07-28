import React, { useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import BottomNav from './components/common/BottomNav';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import CardSettlementTab from './components/settlement/CardSettlementTab';
import { useExpenses } from './hooks/useExpenses';

export default function App() {
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('my_role') || 'husband');
  
  // Supabase DB 연결 훅 (샘플 데이터 없음)
  const { expenses, addExpense, settleMonthExpenses } = useExpenses('2026-07');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative">
      <main className="flex-1">
        {currentTab === 'calendar' ? (
          <CalendarHome 
            onOpenModal={() => setIsModalOpen(true)} 
            expenses={expenses} 
          />
        ) : (
          <CardSettlementTab 
            expenses={expenses} 
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
      />
    </div>
  );
}
