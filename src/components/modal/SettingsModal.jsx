import React, { useState, useEffect, useRef } from 'react';

export default function SettingsModal({
  isOpen,
  onClose,
  cards = [],
  budgetLimit = 500000,
  nicknames = { husband: '남편', wife: '아내' },
  bgImageUrl,
  yearMonth = '2026-07',
  onAddCard,
  onRemoveCard,
  onUpdateBudget,
  onUpdateNicknames,
  onUploadBackground,
  onResetBackground,
}) {
  const fileInputRef = useRef(null);
  const [inputBudget, setInputBudget] = useState(budgetLimit);
  const [newCardName, setNewCardName] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('husband');
  const [hName, setHName] = useState(nicknames.husband);
  const [wName, setWName] = useState(nicknames.wife);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setInputBudget(budgetLimit);
      setHName(nicknames.husband);
      setWName(nicknames.wife);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [budgetLimit, nicknames, isOpen]);

  if (!isOpen) return null;

  const handleBudgetSubmit = (e) => {
    e.preventDefault();
    const num = Number(inputBudget);
    if (!num || num <= 0) return alert('올바른 예산 금액을 입력하세요.');
    onUpdateBudget(num);
  };

  const handleNicknameSubmit = (e) => {
    e.preventDefault();
    if (!hName.trim() || !wName.trim()) return alert('두 분의 별명을 모두 입력해주세요.');
    onUpdateNicknames(hName, wName);
  };

  const handleCardSubmit = (e) => {
    e.preventDefault();
    if (!newCardName.trim()) return alert('카드 별칭을 입력해주세요.');
    onAddCard(newCardName.trim(), newCardOwner);
    setNewCardName('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    await onUploadBackground(file);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 max-w-[430px] mx-auto animate-fade-in select-none font-sans">
      <div className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-black text-slate-800 flex items-center space-x-2">
            <span className="text-lg">⚙️</span>
            <span>가계부 설정 ({yearMonth.split('-')[1]}월)</span>
          </h2>
          <button type="button" onClick={onClose} className="text-lg font-black text-slate-400 hover:text-slate-600 p-1 active:scale-75 transition">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 no-scrollbar">
          
          {/* ★ 1. 나만의 배경 사진 업로드 / 미리보기 / 초기화 */}
          <section className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
            <h3 className="text-xs font-black text-indigo-200 mb-1.5 flex items-center space-x-1.5">
              <span>🖼️</span>
              <span>우리 부부만의 감성 배경 사진 설정</span>
            </h3>
            <p className="text-[10px] font-medium text-slate-300 mb-3">* 사진 등록 시 글자 가독성을 위해 자동으로 반투명 베일 효과가 합성됩니다.</p>
            
            {/* 현재 배경 미리보기 박스 */}
            <div className="w-full h-24 rounded-xl overflow-hidden border border-white/20 relative mb-3 bg-slate-800 flex items-center justify-center">
              <img src={bgImageUrl} alt="bg preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="text-[11px] font-bold bg-black/60 px-2.5 py-1 rounded-full border border-white/30 text-white backdrop-blur-xs">
                  {isUploading ? '📤 사진 업로드 중...' : '현재 적용된 배경 미리보기'}
                </span>
              </div>
            </div>

            <div className="flex space-x-2">
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2 rounded-xl text-xs font-black transition shadow-sm active:scale-95 flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <span>📷</span>
                <span>{isUploading ? '저장 중...' : '새 사진 업로드'}</span>
              </button>
              <button
                type="button"
                onClick={onResetBackground}
                className="px-3 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                title="기본 테마로 초기화"
              >
                🗑️ 삭제
              </button>
            </div>
          </section>

          {/* 2. 남편/아내 커스텀 별명 설정 */}
          <section className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 p-4 rounded-2xl border border-indigo-100/80 shadow-2xs">
            <h3 className="text-xs font-black text-indigo-950 mb-1 flex items-center space-x-1.5">
              <span>✨</span>
              <span>부부 커스텀 별명 설정 (DB 전역 동기화)</span>
            </h3>
            <form onSubmit={handleNicknameSubmit} className="space-y-2 mt-2">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">🙋‍♂️ 남편 별명</label>
                  <input
                    type="text"
                    value={hName}
                    onChange={(e) => setHName(e.target.value)}
                    placeholder="예: 우리여보, 민수"
                    className="w-full bg-white px-3 py-1.5 text-xs font-bold border border-indigo-200 rounded-xl focus:outline-hidden focus:border-indigo-600"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">🙋‍♀️ 아내 별명</label>
                  <input
                    type="text"
                    value={wName}
                    onChange={(e) => setWName(e.target.value)}
                    placeholder="예: 이쁜이, 지영"
                    className="w-full bg-white px-3 py-1.5 text-xs font-bold border border-indigo-200 rounded-xl focus:outline-hidden focus:border-indigo-600"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
              >
                별명 저장하기
              </button>
            </form>
          </section>

          {/* 3. 월간 고정 목표 예산 설정 */}
          <section className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <h3 className="text-xs font-black text-slate-800 mb-1 flex items-center space-x-1.5">
              <span>🎯</span>
              <span>월간 목표 생활비 예산 (전체 월 고정 적용)</span>
            </h3>
            <form onSubmit={handleBudgetSubmit} className="flex space-x-2 mt-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={inputBudget}
                  onChange={(e) => setInputBudget(e.target.value)}
                  className="w-full bg-white px-3 py-2 text-sm font-black text-slate-800 border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-600"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-extrabold">원</span>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shrink-0 transition shadow-xs active:scale-95 cursor-pointer"
              >
                예산 변경
              </button>
            </form>
          </section>

          {/* 4. 신규 결제 카드 등록 */}
          <section className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <h3 className="text-xs font-black text-slate-800 mb-2 flex items-center space-x-1.5">
              <span>💳</span>
              <span>새로운 결제 수단(카드/계좌) 등록</span>
            </h3>
            <form onSubmit={handleCardSubmit} className="space-y-2.5">
              <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setNewCardOwner('husband')}
                  className={`flex-1 py-1 text-xs font-black rounded-lg transition ${newCardOwner === 'husband' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'}`}
                >
                  🙋‍♂️ {nicknames.husband}
                </button>
                <button
                  type="button"
                  onClick={() => setNewCardOwner('wife')}
                  className={`flex-1 py-1 text-xs font-black rounded-lg transition ${newCardOwner === 'wife' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400'}`}
                >
                  🙋‍♀️ {nicknames.wife}
                </button>
                <button
                  type="button"
                  onClick={() => setNewCardOwner('joint')}
                  className={`flex-1 py-1 text-xs font-black rounded-lg transition ${newCardOwner === 'joint' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400'}`}
                >
                  💜 공용
                </button>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder="카드 별칭 (예: 신한, 카뱅)"
                  className="flex-1 bg-white px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black shrink-0 transition active:scale-95 cursor-pointer"
                >
                  + 등록
                </button>
              </div>
            </form>
          </section>

          {/* 5. 등록된 카드 목록 */}
          <section>
            <h3 className="text-xs font-black text-slate-700 mb-2 px-1">
              📋 현재 사용 중인 결제 수단 ({cards.length}개)
            </h3>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 no-scrollbar">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md text-white ${
                      card.owner === 'husband' ? 'bg-blue-600' : card.owner === 'wife' ? 'bg-rose-600' : 'bg-purple-600'
                    }`}>
                      {card.owner === 'husband' ? nicknames.husband : card.owner === 'wife' ? nicknames.wife : '공용'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">{card.card_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCard(card.id)}
                    className="text-[11px] text-red-500 hover:text-red-700 font-black px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-xl transition active:scale-90 cursor-pointer"
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
