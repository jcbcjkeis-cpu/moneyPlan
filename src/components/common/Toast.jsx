import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

const ToastContext = createContext(() => {});

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };
const ICON_COLOR = { info: 'text-sky-300', success: 'text-emerald-300', warning: 'text-amber-300', error: 'text-rose-300' };

// 하단 탭 바로 위에 뜨는 알림. 알림마다 자기 타이머를 가짐
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const show = useCallback((message, type = 'info', options = {}) => {
    const id = ++seq.current;
    const duration = options.duration ?? (options.action ? 4500 : type === 'error' ? 5000 : 2600);
    setToasts((prev) => [...prev.slice(-2), { id, message, type, action: options.action }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed left-0 right-0 z-[70] max-w-[430px] mx-auto px-3 flex flex-col-reverse gap-2 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto animate-toast-in bg-[#1d222c] text-white border border-white/10 rounded-2xl shadow-xl pl-3.5 pr-2 py-2.5 flex items-center gap-2.5"
            >
              <Icon size={18} className={`shrink-0 ${ICON_COLOR[t.type]}`} />
              <span className="text-[14px] font-medium leading-snug flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action.onClick(); dismiss(t.id); }}
                  className="shrink-0 h-9 px-3 rounded-xl text-[14px] font-bold text-sky-300"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
