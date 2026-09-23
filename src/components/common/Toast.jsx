import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

const STYLES = {
  info: 'bg-slate-900/95 text-white border-indigo-400/40',
  success: 'bg-emerald-700/95 text-white border-emerald-300/40',
  warning: 'bg-amber-500/95 text-slate-950 border-amber-200/60',
  error: 'bg-rose-700/95 text-white border-rose-300/40',
};

// 알림마다 자기 타이머를 가지므로 연달아 떠도 서로 지우지 않음
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const show = useCallback((message, type = 'info', options = {}) => {
    const id = ++seq.current;
    const duration = options.duration ?? (type === 'error' ? 5000 : 3000);
    setToasts((prev) => [...prev.slice(-2), { id, message, type, action: options.action }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed left-0 right-0 z-[70] max-w-[430px] mx-auto px-4 flex flex-col gap-2 pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto animate-slide-down text-[13px] font-bold px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 ${STYLES[t.type] || STYLES.info}`}
          >
            <span className="leading-snug">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => { t.action.onClick(); dismiss(t.id); }}
                className="shrink-0 text-xs font-black underline underline-offset-2"
              >
                {t.action.label}
              </button>
            ) : (
              <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 text-xs" aria-label="알림 닫기">✕</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
