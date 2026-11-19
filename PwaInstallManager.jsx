import React, { useEffect, useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';

const HIDE_KEY = 'hide_pwa_prompt_until';

function detect() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua); // 앱 안 브라우저에서는 설치 불가
  return { isIOS, inApp };
}

export default function PwaInstallManager() {
  const [mode, setMode] = useState(null); // ios | inapp | android
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) return undefined;
    try {
      const until = Number(localStorage.getItem(HIDE_KEY));
      if (until && Date.now() < until) return undefined;
    } catch { /* 무시 */ }

    const { isIOS, inApp } = detect();
    if (inApp) { setMode('inapp'); return undefined; }
    if (isIOS) {
      const t = setTimeout(() => setMode('ios'), 1500);
      return () => clearTimeout(t);
    }
    const onPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); setMode('android'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setMode(null);
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000)); } catch { /* 무시 */ }
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setMode(null);
    setDeferredPrompt(null);
  };

  if (!mode) return null;

  return (
    <div className="px-4 pt-4 animate-fade-in">
      <div className="bg-card border border-line rounded-3xl p-4 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-bold text-ink">
              {mode === 'inapp' ? '사파리(또는 크롬)에서 열어주세요' : '홈 화면에 앱으로 추가하세요'}
            </p>
            <p className="text-[13px] text-muted mt-0.5">
              {mode === 'inapp'
                ? '카카오톡 같은 앱 안의 브라우저에서는 설치가 안 되고 데이터 유지도 불안정해요.'
                : '앱처럼 전체 화면으로 열리고, 아이폰에서는 저장한 설정이 지워지지 않아요.'}
            </p>
          </div>
          <button type="button" onClick={dismiss} className="w-10 h-10 -mt-1 rounded-full flex items-center justify-center text-muted shrink-0" aria-label="안내 닫기"><X size={18} /></button>
        </div>
        {mode === 'ios' && (
          <ol className="mt-3 space-y-2 text-[14px] text-ink2">
            <li className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-fill flex items-center justify-center"><Share size={16} /></span>하단(또는 상단)의 공유 버튼을 누르고</li>
            <li className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-fill flex items-center justify-center"><SquarePlus size={16} /></span><strong>홈 화면에 추가</strong>를 선택하세요</li>
          </ol>
        )}
        {mode === 'inapp' && <p className="mt-3 text-[14px] text-ink2">오른쪽 아래(또는 위) <strong>⋯ 메뉴 → 다른 브라우저로 열기</strong>를 누르세요.</p>}
        {mode === 'android' && (
          <button type="button" onClick={install} className="mt-3 w-full h-12 rounded-xl bg-ink text-card text-[15px] font-bold">설치하기</button>
        )}
      </div>
    </div>
  );
}
