import React, { useState, useEffect, useRef } from 'react';
import { MOCK_PAYMENT_CARDS, EXPENSE_CATEGORIES, SMART_DEFAULTS } from '../../constants/mockData';
import { useViewportFix } from '../../hooks/useViewportFix';

export default function ExpenseInputModal({ isOpen, onClose, onSave, currentUserRole = 'husband' }) {
  const amountInputRef = useRef(null);
  const { viewportHeight, isKeyboardOpen } = useViewportFix();

  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState(currentUserRole);
  const [cardId, setCardId] = useState(currentUserRole === 'husband' ? 1 : 2);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].label);
  const [memo, setMemo] = useState('');
  const [isSettledRequired, setIsSettledRequired] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달 오픈 시 또는 currentUserRole 변경 시 기본 설정 갱신
  useEffect(() => {
    if (isOpen) {
      setPayer(currentUserRole);
      setCardId(currentUserRole === 'husband' ? 1 : 2);
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
    } else {
      setAmount('');
      setMemo('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentUserRole]);

  const handlePayerChange = (newPayer) => {
    setPayer(newPayer);
    if (SMART_DEFAULTS.defaultCardIdByRole[newPayer]) {
      setCardId(SMART_DEFAULTS.defaultCardIdByRole[newPayer]);
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
      alert('올바른 지출 금액을 입력해주세요.');
      amountInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    const newExpense = {
      id: crypto.randomUUID(),
      expense_date: new Date().toISOString().split('T')[0],
      amount: numericAmount,
      category: category,
      content: memo || category,
      payer: payer,
      card_id: cardId,
      is_joint_expense: true,
      is_settled: !isSettledRequired, 
      memo: memo,
      created_at: new Date().toISOString(),
    };

    onSave(newExpense);
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
          <h2 className="text-sm font-bold text-slate-800 mt-2">지출 내역 간편 입력</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 text-lg font-bold mt-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">결제 금액</label>
            <div className="flex items-center justify-between">
              <input
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-extrabold text-slate-800 focus:outline-hidden tracking-tight placeholder:text-slate-300"
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
                  className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 active:scale-95 transition"
                >
                  +{val / 10000}만
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">결제 수단</label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => handlePayerChange('husband')}
                  className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition ${
                    payer === 'husband' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  🙋‍♂️ 남편
                </button>
                <button
                  type="button"
                  onClick={() => handlePayerChange('wife')}
                  className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition ${
                    payer === 'wife' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  🙋‍♀️ 아내
                </button>
              </div>
            </div>

            <div className="flex space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
              {MOCK_PAYMENT_CARDS.map((card) => {
                const isSelected = cardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setCardId(card.id)}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>💳</span>
                    <span>{card.card_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">카테고리 선택</label>
            <div className="grid grid-cols-4 gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`py-2 px-1 rounded-xl text-[11px] font-medium border text-center transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500 text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-base mb-0.5">{cat.icon}</span>
                    <span className="truncate block">{cat.label.split(' ')[1]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="사용처 또는 메모 (선택사항 - 미입력 시 카테고리명 저장)"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
            />

            <label className="flex items-center space-x-2.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 cursor-pointer">
              <input
                type="checkbox"
                checked={isSettledRequired}
                onChange={(e) => setIsSettledRequired(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <div className="text-xs">
                <span className="font-bold text-indigo-900 block">💡 공동 생활비 정산 필요 (체크 시 반영)</span>
                <span className="text-[10px] text-slate-500">
                  개인 카드로 긁은 공용 지출인 경우 월말 부부 간 차액 계산에 포함됩니다.
                </span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !amount}
            className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-lg transition-all ${
              !amount || isSubmitting
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-blue-500/25'
            }`}
          >
            {isSubmitting ? '저장 중...' : '지출 내역 저장하기 (1초 저장)'}
          </button>
        </form>
      </div>
    </div>
  );
}