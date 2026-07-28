import React from 'react';

export default function BottomNav({ currentTab, onTabChange, onOpenModal, onOpenSettings }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-200/80 pb-safe shadow-[0_-8px_20px_rgba(0,0,0,0.04)] select-none">
      <div className="flex items-center justify-around h-16 px-1 relative">
        
        {/* 1. 가계부 홈 탭 */}
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
            currentTab === 'calendar' ? 'text-blue-600 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-600 font-semibold'
          }`}
        >
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 transition-colors ${currentTab === 'calendar' ? 'bg-blue-500/10 text-blue-600' : 'bg-transparent text-slate-400'}`}>
            <span className="text-base">📅</span>
          </div>
          <span className="text-[10px] tracking-tight">가계부 홈</span>
        </button>

        {/* 2. ★ 신설된 [소비 통계] 탭 */}
        <button
          type="button"
          onClick={() => onTabChange('statistics')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
            currentTab === 'statistics' ? 'text-indigo-600 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-600 font-semibold'
          }`}
        >
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 transition-colors ${currentTab === 'statistics' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-transparent text-slate-400'}`}>
            <span className="text-base">📊</span>
          </div>
          <span className="text-[10px] tracking-tight">소비 통계</span>
        </button>

        {/* 3. ★ 중앙에 솟아오른 트렌디 그라데이션 원형 (+) 버튼 */}
        <div className="flex-1 flex justify-center -mt-7">
          <button
            type="button"
            onClick={onOpenModal}
            className="w-15 h-15 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 border-4 border-slate-50 active:scale-90 hover:rotate-90 transition-all duration-300 cursor-pointer group"
            title="지출/수입 간편 등록"
          >
            <span className="text-2xl font-light leading-none pb-0.5 group-hover:scale-110 transition-transform">➕</span>
          </button>
        </div>

        {/* 4. 부부 정산 탭 */}
        <button
          type="button"
          onClick={() => onTabChange('settlement')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
            currentTab === 'settlement' ? 'text-purple-600 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-600 font-semibold'
          }`}
        >
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 transition-colors ${currentTab === 'settlement' ? 'bg-purple-500/10 text-purple-600' : 'bg-transparent text-slate-400'}`}>
            <span className="text-base">🤝</span>
          </div>
          <span className="text-[10px] tracking-tight">부부 정산</span>
        </button>

        {/* 5. 가계부 설정 탭 (하단 바에 공식 입성) */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex-1 flex flex-col items-center justify-center py-1 text-slate-400 hover:text-slate-600 font-semibold transition-all duration-200 active:scale-90"
        >
          <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 bg-transparent text-slate-400">
            <span className="text-base">⚙️</span>
          </div>
          <span className="text-[10px] tracking-tight">설정</span>
        </button>

      </div>
    </nav>
  );
}
