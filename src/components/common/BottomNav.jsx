import React from 'react';
import { CalendarDays, ChartPie, Handshake, Plus, Settings } from 'lucide-react';

const TABS = [
  { id: 'calendar', Icon: CalendarDays, label: '가계부' },
  { id: 'statistics', Icon: ChartPie, label: '통계' },
  null, // 가운데 + 버튼
  { id: 'settlement', Icon: Handshake, label: '정산' },
  { id: 'settings', Icon: Settings, label: '설정' },
];

export default function BottomNav({ currentTab, onTabChange, onOpenModal, onOpenSettings, settlementBadge }) {
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
          const active = !isSettings && currentTab === tab.id;
          const { Icon } = tab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (isSettings ? onOpenSettings() : onTabChange(tab.id))}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 h-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition ${active ? 'text-ink' : 'text-muted'}`}
            >
              <Icon size={23} strokeWidth={active ? 2.3 : 1.8} />
              <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              {tab.id === 'settlement' && settlementBadge && <span className="absolute top-2.5 left-1/2 ml-2.5 w-2 h-2 bg-danger rounded-full ring-2 ring-card" aria-label="미정산 내역 있음" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
