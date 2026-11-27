import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { HelpBox, HelpButton } from './Help';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';

// 하단 시트
// - footer는 스크롤과 상관없이 아래 고정, 키보드가 올라오면 키보드 위로 올라감 (아이폰 대응)
// - 손잡이/제목 영역을 아래로 끌면 닫힘
// - help: 제목 옆 (?)를 누르면 맨 위에 설명 표시
// - top: 스크롤되지 않고 제목 아래 고정되는 영역 (빠른 입력창 등)
export default function Sheet({ isOpen, onClose, title, headerRight, help, top, footer, children, maxHeight = '92dvh', zIndex = 50 }) {
  const titleId = useId();
  const { inset, height } = useKeyboardInset(isOpen);
  const [dragY, setDragY] = useState(0);
  const drag = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    setDragY(0);
    setHelpOpen(false);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const onPointerDown = (e) => {
    if (e.target.closest('button, input, select, textarea')) return;
    drag.current = { y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => { if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y)); };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragY > 110) onClose?.();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex, paddingBottom: inset }}>
      <div className="absolute inset-0 bg-black/45 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="relative w-full max-w-[430px] bg-card rounded-t-[28px] shadow-sheet flex flex-col animate-sheet-up"
        style={{
          maxHeight: inset ? `${Math.max(height - 12, 260)}px` : maxHeight,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: drag.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <div className="touch-none cursor-grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true">
            <span className="w-10 h-1 rounded-full bg-line" />
          </div>
          {(title || headerRight) && (
            <div className="flex items-center justify-between gap-2 pl-5 pr-2 pb-2">
              <div className="flex items-center gap-0.5 min-w-0">
                <h2 id={titleId} className="text-[17px] font-bold text-ink truncate">{title}</h2>
                {help && <HelpButton open={helpOpen} onClick={() => setHelpOpen((v) => !v)} />}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {headerRight}
                <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center text-muted active:bg-fill" aria-label="닫기">
                  <X size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
        {top && <div className="px-5 pt-1 pb-3 shrink-0">{top}</div>}
        <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          {help && helpOpen && <div className="px-5 pb-3"><HelpBox>{help}</HelpBox></div>}
          {children}
        </div>
        {footer && <div className={`border-t border-line bg-card px-4 pt-3 ${inset ? 'pb-3' : 'pb-3 pb-safe'}`}>{footer}</div>}
      </div>
    </div>
  );
}
