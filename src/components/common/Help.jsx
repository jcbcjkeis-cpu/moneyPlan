import React, { useState } from 'react';
import { CircleHelp } from 'lucide-react';

// 설명은 숨겨두고 (?)를 눌렀을 때만 보여줌

export function HelpButton({ open, onClick, size = 18, label = '설명 보기' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? '설명 닫기' : label}
      className={`w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 active:bg-fill ${open ? 'text-ink' : 'text-muted'}`}
    >
      <CircleHelp size={size} />
    </button>
  );
}

export function HelpBox({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-fill px-4 py-3 text-[13px] text-ink2 leading-relaxed animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

// 제목 옆 (?) → 누르면 제목 아래에 설명
export function HelpTitle({ as: Tag = 'h3', className = '', help, children, right = null, wrapClassName = 'mb-2' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`flex items-center gap-0.5 min-w-0 ${wrapClassName}`}>
        <Tag className={className.replace(/\bmb-\S+/g, '')}>{children}</Tag>
        {help && <HelpButton open={open} onClick={() => setOpen((v) => !v)} size={16} />}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {open && help && <HelpBox className="mb-3">{help}</HelpBox>}
    </>
  );
}
