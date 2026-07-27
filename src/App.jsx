import React, { useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import BottomNav from './components/common/BottomNav';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import CardSettlementTab from './components/settlement/CardSettlementTab';

export default function App() {
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 브라우저(localStorage)에 저장된 프로필을 불러오거나 기본값 'husband' 적용
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('my_role') || 'husband');

  const [expenses, setExpenses] = useState([
    {
      id: '1',
      expense_date: '2026-07-03',
      amount: 15000,
      category: '🛒 마트/장보기',
      content: '동네 마트 과일 장보기',
      payer: 'husband',
      card_id: 1,
      is_joint_expense: true,
      is_settled: false,
      memo: '사과, 바나나'
    },
    {
      id: '2',
      expense_date: '2026-07-04',
      amount: 32000,
      category: '🍽️ 외식/배달',
      content: '주말 배달 민족 치킨',
      payer: 'wife',
      card_id: 2,
      is_joint_expense: true,
      is_settled: false,
      memo: '후라이드 반 양념 반'
    },
    {
      id: '3',
      expense_date: '2026-07-27',
      amount: 4500,
      category: '☕ 카페/간식',
      content: '출근길 스타벅스 커피',
      payer: 'husband',
      card_id: 1,
      is_joint_expense: true,
      is_settled: false,
      memo: '아이스 아메리카노'
    }
  ]);

  const handleSaveExpense = (newExpense) => {
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const handleSettleMonth = async () => {
    setExpenses((prev) =>
      prev.map((item) => (item.is_joint_expense ? { ...item, is_settled: true } : item))
    );
  };

  const handleRoleChange = (role) => {
    setCurrentUserRole(role);
    localStorage.setItem('my_role', role);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative">
      <main className="flex-1">
        {currentTab === 'calendar' ? (
          <CalendarHome 
            onOpenModal={() => setIsModalOpen(true)} 
            expenses={expenses} 
            currentUserRole={currentUserRole}
            onRoleChange={handleRoleChange}
          />
        ) : (
          <CardSettlementTab expenses={expenses} onSettleMonth={handleSettleMonth} />
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
        onSave={handleSaveExpense}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}