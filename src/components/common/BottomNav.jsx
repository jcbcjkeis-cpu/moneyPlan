import React from 'react';

export default function BottomNav({ currentTab, onTabChange, onOpenModal }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] select-none">
      <div className="flex items-center justify-around h-16 px-2 relative">
        
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors active:scale-95 ${
            currentTab === 'calendar' ? 'text-blue-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <span className="text-xl mb-0.5">📅</span>
          <span className="text-[11px]">가계부 홈</span>
        </button>

        {/* ★ 중앙에 솟아오른 트렌디 그라데이션 원형 버튼 */}
        <div className="flex-1 flex justify-center -mt-8">
          <button
            type="button"
            onClick={onOpenModal}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xl shadow-indigo-500/40 border-4 border-slate-50 active:scale-95 hover:rotate-90 transition-all duration-300 cursor-pointer"
            title="지출/수입 간편 등록"
          >
            <span className="text-3xl font-light leading-none pb-0.5">➕</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onTabChange('settlement')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors active:scale-95 ${
            currentTab === 'settlement' ? 'text-purple-600 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <span className="text-xl mb-0.5">🤝</span>
          <span className="text-[11px]">카드/정산</span>
        </button>

      </div>
    </nav>
  );
}
