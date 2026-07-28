import React, { useState, useEffect } from 'react';

export default function SettingsModal({
  isOpen,
  onClose,
  cards = [],
  budgetLimit = 500000,
  onAddCard,
  onRemoveCard,
  onUpdateBudget,
}) {
  const [inputBudget, setInputBudget] = useState(budgetLimit);
  const [newCardName, setNewCardName] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('husband');

  // ★ 핵심 2: 설정 모달 열릴 때도 바닥 화면(body) 스크롤 완벽 차단
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setInputBudget(budgetLimit);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [budgetLimit, isOpen]);

  if (!isOpen) return null;

  const handleBudgetSubmit = (e) => {
    e.preventDefault();
    const num = Number(inputBudget);
    if (!num || num <= 0) return alert('올바른 예산 금액을 입력하세요.');
    onUpdateBudget(num);
  };

  const handleCardSubmit = (e) => {
    e.preventDefault();
    if (!newCardName.trim()) return alert('카드 별칭을 입력해주세요.');
    onAddCard(newCardName.trim(), newCardOwner);
    setNewCardName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 max-w-[430px] mx-auto">
      <div className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
        
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-1.5">
            <span>⚙️</span>
            <span>가계부 설정 & 카드/예산 관리</span>
          </h2>
          <button type="button" onClick={onClose} className="text-lg font-bold text-slate-400 p-1">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          
          <section className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center space-x-1">
              <span>🎯</span>
              <span>이번 달 목표 생활비 예산 설정</span>
            </h3>
            <form onSubmit={handleBudgetSubmit} className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={inputBudget}
                  onChange={(e) => setInputBudget(e.target.value)}
                  className="w-full bg-white px-3 py-2 text-sm font-bold text-slate-800 border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500"
                  placeholder="예: 1000000"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">원</span>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition shadow-xs"
              >
                예산 변경
              </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-1.5">
              * 변경 즉시 캘린더 홈의 소진율 게이지와 한도 초과 알림에 반영됩니다.
            </p>
          </section>

          <section className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <h3 className="text-xs font-extrabold text-indigo-900 mb-2 flex items-center space-x-1">
              <span>💳</span>
              <span>새로운 결제 수단(카드/계좌) 등록</span>
            </h3>
            <form onSubmit={handleCardSubmit} className="space-y-2.5">
              <div className="flex space-x-1 bg-white p-1 rounded-xl border border-indigo-200">
                <button
                  type="button"
                  onClick={() => setNewCardOwner('husband')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${newCardOwner === 'husband' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-500'}`}
                >
                  🙋‍♂️ 남편 카드
                </button>
                <button
                  type="button"
                  onClick={() => setNewCardOwner('wife')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${newCardOwner === 'wife' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500'}`}
                >
                  🙋‍♀️ 아내 카드
                </button>
                <button
                  type="button"
                  onClick={() => setNewCardOwner('joint')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${newCardOwner === 'joint' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500'}`}
                >
                  💜 공용 계좌
                </button>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder="카드 별칭 (예: 신한 딥드림, 카카오뱅크)"
                  className="flex-1 bg-white px-3 py-2 text-xs border border-indigo-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition shadow-xs"
                >
                  + 등록
                </button>
              </div>
            </form>
          </section>

          <section>
            <h3 className="text-xs font-extrabold text-slate-700 mb-2 px-1">
              📋 현재 사용 중인 결제 수단 목록 ({cards.length}개)
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                      card.owner === 'husband' ? 'bg-blue-500' : card.owner === 'wife' ? 'bg-rose-500' : 'bg-purple-600'
                    }`}>
                      {card.owner === 'husband' ? '남편' : card.owner === 'wife' ? '아내' : '공용'}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{card.card_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCard(card.id)}
                    className="text-[11px] text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded-lg transition"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
