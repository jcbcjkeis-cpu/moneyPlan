import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EXPENSE_CATEGORIES } from '../../constants/mockData';
import { useViewportFix } from '../../hooks/useViewportFix';

export default function ExpenseInputModal({
  isOpen,
  onClose,
  onSave,
  currentUserRole,
  cards = [],
  selectedDate = new Date().getDate(),
  yearMonth = '2026-07',
}) {
  const amountInputRef = useRef(null);
  const { viewportHeight, isKeyboardOpen } = useViewportFix();

  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState(currentUserRole || 'husband');
  const [cardId, setCardId] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [memo, setMemo] = useState('');
  const [isSettledRequired, setIsSettledRequired] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => c.owner === payer || c.owner === 'joint');
  }, [cards, payer]);

  // ★ 핵심 1: 모달 열릴 때 바닥 화면(body) 스크롤 완전 차단 (Body Scroll Lock)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const initialPayer = currentUserRole || 'husband';
      setPayer(initialPayer);

      const availableCards = cards.filter((c) => c.owner === initialPayer || c.owner === 'joint');
      if (availableCards.length > 0) {
        setCardId(availableCards[0].id);
      } else {
        setCardId('');
      }
      // 자동 포커스 focus() 완벽 제거로 가상 키보드 자동 팝업 차단!
    } else {
      document.body.style.overflow = 'unset';
      setAmount('');
      setMemo('');
      setIsIncome(false);
      setIsSubmitting(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, currentUserRole, cards]);

  const handlePayerChange = (newPayer) => {
    setPayer(newPayer);
    const availableCards = cards.filter((c) => c.owner === newPayer || c.owner === 'joint');
    if (availableCards.length > 0) {
      setCardId(availableCards[0].id);
    } else {
      setCardId('');
    }
  };

  const handleAddAmount = (addValue) => {
    const currentVal = parseInt(amount.replace(/[^0-9]/g, '') || '0', 10);
    setAmount((currentVal + addValue).toLocaleString());
  };

  const handleAmountChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
      setAmount('');
    } else {
      setAmount(parseInt(rawValue, 10).toLocaleString());
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const numericAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    
    if (!numericAmount || numericAmount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      amountInputRef.current?.focus();
      return;
    }

    if (!isIncome && !cardId && filteredCards.length > 0) {
      alert('결제 수단을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    const formattedDate = String(selectedDate).padStart(2, '0');
    const targetDate = `${yearMonth}-${formattedDate}`;

    const newRecord = {
      id: crypto.randomUUID(),
      expense_date: targetDate,
      amount: numericAmount,
      category: isIncome ? '💰 수입/입금' : category,
      content: memo || (isIncome ? '수입 등록' : category),
      payer: payer,
      card_id: isIncome ? null : (cardId ? Number(cardId) : null),
      is_joint_expense: !isIncome,
      is_settled: isIncome ? true : !isSettledRequired,
      is_income: isIncome,
      memo: memo,
      created_at: new Date().toISOString(),
    };

    onSave(newRecord);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity max-w-[430px] mx-auto">
      <div 
        className="w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up pb-safe"
        style={{ height: isKeyboardOpen ? `${viewportHeight}px` : 'auto' }}
      >
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-slate-100 relative">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full absolute top-2.5 left-1/2 -translate-x-1/2" />
          
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 mt-2">
            <button
              type="button"
              onClick={() => setIsIncome(false)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${!isIncome ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500'}`}
            >
              💸 지출 (생활비)
            </button>
            <button
              type="button"
              onClick={() => setIsIncome(true)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${isIncome ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500'}`}
            >
              💰 수입 (월급/기타)
            </button>
          </div>

          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 text-lg font-bold mt-1">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          <div className={`p-3.5 rounded-2xl border ${isIncome ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200/80'}`}>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-500">{isIncome ? '입금 금액' : '결제 금액'}</label>
              <span className="text-[11px] font-bold text-indigo-600">📅 7월 {selectedDate}일 등록</span>
            </div>
            <div className="flex items-center justify-between">
              <input
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0 (터치하여 금액 입력)"
                className="w-full bg-transparent text-2xl font-extrabold text-slate-800 focus:outline-hidden tracking-tight placeholder:text-slate-300 placeholder:text-lg placeholder:font-normal"
                required
              />
              <span className="text-base font-bold text-slate-600 ml-2">원</span>
            </div>

            <div className="flex space-x-1.5 mt-2.5 pt-2 border-t border-slate-200/60">
              {[10000, 30000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddAmount(val)}
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-blue-50 active:scale-95 transition"
                >
                  +{val / 10000}만
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">{isIncome ? '수입 대상자' : '결제자 및 수단'}</label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button type="button" onClick={() => handlePayerChange('husband')} className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition ${payer === 'husband' ? 'bg-blue-500 text-white' : 'text-slate-500'}`}>🙋‍♂️ 남편</button>
                <button type="button" onClick={() => handlePayerChange('wife')} className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition ${payer === 'wife' ? 'bg-rose-500 text-white' : 'text-slate-500'}`}>🙋‍♀️ 아내</button>
              </div>
            </div>

            {!isIncome && (
              <div className="flex space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                {filteredCards.length > 0 ? (
                  filteredCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setCardId(card.id)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                        cardId === card.id ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span>💳</span>
                      <span>{card.card_name}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-red-500 py-1 font-medium">⚠️ 해당 대상자의 등록된 카드가 없습니다. 설정(⚙️)에서 추가해주세요.</div>
                )}
              </div>
            )}
          </div>

          {!isIncome && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">카테고리 선택</label>
              <div className="grid grid-cols-4 gap-1.5">
                {EXPENSE_CATEGORIES.map((cat) => {
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.label)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-medium border text-center transition ${category === cat.label ? 'border-blue-500 bg-blue-500 text-white font-bold' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <span className="block text-base mb-0.5">{cat.icon}</span>
                      <span className="truncate block">{cat.label.split(' ')[1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={isIncome ? '예: 남편 7월 급여, 아내 부수입 입금' : '사용처 메모 (미입력 시 카테고리명 저장)'}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />

            {!isIncome && (
              <label className="flex items-center space-x-2.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSettledRequired}
                  onChange={(e) => setIsSettledRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <div className="text-xs">
                  <span className="font-bold text-indigo-900 block">💡 공동 생활비 정산 필요</span>
                  <span className="text-[10px] text-slate-500">개인 카드로 긁은 공용 지출인 경우 월말 부부 차액 계산에 포함</span>
                </div>
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !amount}
            className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-lg transition-all ${
              !amount || isSubmitting
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : isIncome
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/25'
            }`}
          >
            {isSubmitting ? '저장 중...' : isIncome ? '💰 수입 내역 저장하기' : '💸 지출 내역 저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
