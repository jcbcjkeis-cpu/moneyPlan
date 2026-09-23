import React from 'react';

const TABS = [
  { id: 'calendar', icon: '📅', label: '가계부', color: 'text-blue-600' },
  { id: 'statistics', icon: '📊', label: '통계', color: 'text-indigo-600' },
  null, // 가운데 + 버튼 자리
  { id: 'settlement', icon: '🤝', label: '정산', color: 'text-purple-600' },
  { id: 'settings', icon: '⚙️', label: '설정', color: 'text-slate-700' },
];

export default function BottomNav({ currentTab, onTabChange, onOpenModal, onOpenSettings, settlementBadge }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto bg-white/95 backdrop-blur-lg border-t border-slate-200/80 pb-safe" aria-label="메인 메뉴">
      <div className="flex items-center justify-around h-16 px-1">
        {TABS.map((tab) => {
          if (!tab) {
            return (
              <div key="add" className="flex-1 flex justify-center -mt-7">
                <button
                  type="button"
                  onClick={onOpenModal}
                  className="w-15 h-15 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 border-4 border-slate-50 active:scale-90 transition"
                  aria-label="지출/수입 등록"
                >
                  <span className="text-3xl font-light leading-none -mt-0.5">+</span>
                </button>
              </div>
            );
          }
          const isSettings = tab.id === 'settings';
          const active = !isSettings && currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (isSettings ? onOpenSettings() : onTabChange(tab.id))}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-1 relative active:scale-90 transition ${active ? `${tab.color} font-extrabold` : 'text-slate-500 font-semibold'}`}
            >
              <span className="text-lg leading-none mb-1">{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
              {tab.id === 'settlement' && settlementBadge && <span className="absolute top-1 right-1/4 w-2 h-2 bg-rose-500 rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
