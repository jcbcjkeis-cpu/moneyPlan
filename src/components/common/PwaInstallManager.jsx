import React, { useState, useEffect } from 'react';

export default function PwaInstallManager() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. 이미 앱으로 켜진 상태인지 판별 (주소창 없는 standalone 모드)
    const isApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isApp);
    if (isApp) return;

    // 2. 닫기를 눌렀다면 3일(72시간) 동안 다시 띄우지 않음
    const hideUntil = localStorage.getItem('hide_pwa_prompt_until');
    if (hideUntil && new Date().getTime() < Number(hideUntil)) return;

    // 3. 기기 판별 (iOS vs 기타)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // 아이폰은 시스템 팝업이 없으므로, 웹 접속 1.5초 뒤에 가이드 배너를 부드럽게 띄움
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    } else {
      // 안드로이드: 시스템 설치 신호(beforeinstallprompt)를 가로채서 보관
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsVisible(true);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); // 보관해둔 시스템 설치 팝업 강제 호출
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // 닫기 누르면 3일 동안 재노출 금지 (피로도 방지)
    const nextTime = new Date().getTime() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem('hide_pwa_prompt_until', nextTime);
  };

  if (isStandalone || !isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up select-none font-sans max-w-[400px] mx-auto">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-3xl shadow-2xl border border-indigo-500/40 relative">
        <button onClick={handleDismiss} className="absolute top-3 right-4 text-slate-400 hover:text-white p-1 text-sm font-black active:scale-75 transition">✕</button>
        
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner shadow-white/20">📱</div>
          <div>
            <h3 className="text-sm font-black text-indigo-100">부부 가계부 앱 설치</h3>
            <p className="text-[11px] font-medium text-slate-300 mt-0.5">바탕화면에 설치하고 편하게 관리하세요!</p>
          </div>
        </div>
        
        {isIOS ? (
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 mt-2">
            <p className="text-xs font-bold text-slate-200 leading-relaxed flex flex-col items-center text-center">
              <span>하단 메뉴에서 <strong className="text-blue-400">[공유 ⍐]</strong> 버튼을 누른 후</span>
              <span className="mt-1"><strong className="bg-white text-black px-1.5 py-0.5 rounded shadow-sm text-[10px]">홈 화면에 추가 ➕</strong> 를 선택해 주세요.</span>
            </p>
          </div>
        ) : (
          <button 
            onClick={handleInstallClick}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer"
          >
            지금 무료로 설치하기
          </button>
        )}
      </div>
    </div>
  );
}
