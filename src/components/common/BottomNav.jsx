import React from 'react';
import { CalendarDays, ChartPie, Plus, Search, Settings } from 'lucide-react';

const TABS = [
  { id: 'calendar', Icon: CalendarDays, label: '가계부' },
  { id: 'statistics', Icon: ChartPie, label: '통계' },
  null, // 가운데 + 버튼
  { id: 'search', Icon: Search, label: '검색' },
  { id: 'settings', Icon: Settings, label: '설정' },
];

export default function BottomNav({ currentTab, onTabChange, onOpenModal, onOpenSettings, onOpenSearch }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto bg-card/90 backdrop-blur-xl border-t border-line pb-safe" aria-label="메인 메뉴">
      <div className="flex items-center justify-around h-[60px] px-1">
        {TABS.map((tab) => {
          if (!tab) {
            return (
              <div key="add" className="flex-1 flex justify-center">
                <button type="button" onClick={onOpenModal} className="w-14 h-14 -mt-6 rounded-full bg-ink text-card flex items-center justify-center shadow-lg ring-4 ring-app active:scale-90 transition" aria-label="지출/수입 입력">
                  <Plus size={28} strokeWidth={2.4} />
                </button>
              </div>
            );
          }
          const isSettings = tab.id === 'settings';
          const active = !isSettings && tab.id !== 'search' && currentTab === tab.id;
          const { Icon } = tab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (isSettings ? onOpenSettings() : tab.id === 'search' ? onOpenSearch() : onTabChange(tab.id))}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 h-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition ${active ? 'text-ink' : 'text-muted'}`}
            >
              <Icon size={23} strokeWidth={active ? 2.3 : 1.8} />
              <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
