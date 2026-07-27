import React from 'react';

export default function BottomNav({ currentTab, onTabChange, onOpenModal }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-6 py-2 pb-safe">
      <div className="flex items-center justify-between relative">
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={`flex flex-col items-center justify-center w-20 py-1 transition-colors ${
            currentTab === 'calendar' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-xl mb-0.5">📅</span>
          <span className="text-[11px] tracking-tight">캘린더</span>
        </button>

        <div className="absolute left-1/2 -top-5 -translate-x-1/2 flex flex-col items-center">
          <button
            type="button"
            onClick={onOpenModal}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform border-4 border-slate-50"
            aria-label="지출 내역 간편 입력"
          >
            <span className="text-2xl font-light leading-none">➕</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onTabChange('settlement')}
          className={`flex flex-col items-center justify-center w-20 py-1 transition-colors ${
            currentTab === 'settlement' ? 'text-purple-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-xl mb-0.5">💳</span>
          <span className="text-[11px] tracking-tight">카드/정산</span>
        </button>
      </div>
    </nav>
  );
}