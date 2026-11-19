import React from 'react';

// 처음 실행할 때 한 번만: 이 폰의 주인 선택
export default function RoleSelectModal({ nicknames, onSelect }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="role-title">
      <div className="w-full max-w-[360px] bg-card rounded-3xl p-6 shadow-2xl">
        <h2 id="role-title" className="text-[20px] font-bold text-ink">이 휴대폰은 누구 건가요?</h2>
        <p className="text-[14px] text-muted mt-1.5 mb-6">새 내역을 입력할 때 결제자와 카드가 자동으로 맞춰져요. 설정에서 언제든 바꿀 수 있어요.</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onSelect('husband')} className="h-16 rounded-2xl bg-husband-soft text-husband font-bold text-[17px] active:scale-95">{nicknames.husband}</button>
          <button type="button" onClick={() => onSelect('wife')} className="h-16 rounded-2xl bg-wife-soft text-wife font-bold text-[17px] active:scale-95">{nicknames.wife}</button>
        </div>
      </div>
    </div>
  );
}
