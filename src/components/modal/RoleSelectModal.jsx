import React from 'react';

// 처음 실행할 때 한 번만: 이 폰의 주인 선택
export default function RoleSelectModal({ nicknames, onSelect }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="role-title">
      <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl text-center">
        <p className="text-3xl mb-2">👋</p>
        <h2 id="role-title" className="text-lg font-black text-slate-900">이 휴대폰은 누구 건가요?</h2>
        <p className="text-[13px] text-slate-500 mt-1 mb-5">새 내역을 입력할 때 결제자와 카드가 자동으로 맞춰져요. 설정에서 언제든 바꿀 수 있어요.</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onSelect('husband')} className="py-4 rounded-2xl bg-blue-600 text-white font-black text-base active:scale-95">🙋‍♂️ {nicknames.husband}</button>
          <button type="button" onClick={() => onSelect('wife')} className="py-4 rounded-2xl bg-rose-600 text-white font-black text-base active:scale-95">🙋‍♀️ {nicknames.wife}</button>
        </div>
      </div>
    </div>
  );
}
