import React, { useState, useEffect } from 'react';

// ★ 개편된 카테고리 목록
const INCOME_CATEGORIES = ['급여/월급', '부수입/투잡', '상여/보너스', '이자/배당금', '용돈/지원금', '기타 수입'];
const EXPENSE_CATEGORIES = [
  '식비', '생필품', '장보기', '카페/간식', '교통/주유/차량', 
  '쇼핑/뷰티/의류', '문화/여가/여행', '의료/건강', '교육/육아', 
  '경조사/선물/용돈', '보험/세금', '공과금', '회비', '취미', '기타'
];

export default function ExpenseInputModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editTarget,
  currentUserRole,
  cards = [],
  nicknames = { husband: '남편', wife: '아내' },
  selectedDate,
  yearMonth,
}) {
  const [date, setDate] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [payer, setPayer] = useState(currentUserRole);
  const [cardId, setCardId] = useState('');
  const [isJointExpense, setIsJointExpense] = useState(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (editTarget) {
        setDate(editTarget.expense_date);
        setIsIncome(editTarget.is_income);
        setAmount(String(editTarget.amount));
        setContent(editTarget.content);
        setPayer(editTarget.payer);
        setCardId(editTarget.card_id || '');
        setIsJointExpense(editTarget.is_joint_expense);
        
        // ★ 과거 카테고리가 새 목록에 없으면 '기타'로 자동 편입 (고아 데이터 방지)
        if (editTarget.is_income) {
          setCategory(INCOME_CATEGORIES.includes(editTarget.category) ? editTarget.category : '기타 수입');
        } else {
          setCategory(EXPENSE_CATEGORIES.includes(editTarget.category) ? editTarget.category : '기타');
        }
      } else {
        setDate(`${yearMonth}-${String(selectedDate).padStart(2, '0')}`);
        setIsIncome(false);
        setAmount('');
        setCategory(EXPENSE_CATEGORIES[0]);
        setContent('');
        setPayer(currentUserRole);
        setIsJointExpense(true);

        // ★ 마지막에 썼던 결제 카드 자동 불러오기 로직
        const lastUsedCard = localStorage.getItem('buboo_last_card');
        const isValidCard = cards.some(c => c.id === lastUsedCard);
        setCardId(isValidCard ? lastUsedCard : (cards.length > 0 ? cards[0].id : ''));
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, editTarget, yearMonth, selectedDate, currentUserRole, cards]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return alert('정확한 금액을 숫자로 입력해주세요.');
    if (!content.trim()) return alert('내역(어디서/무엇을)을 입력해주세요.');

    const payload = {
      expense_date: date,
      is_income: isIncome,
      amount: Number(amount),
      category,
      content: content.trim(),
      payer,
      card_id: isIncome ? null : (cardId || null),
      is_joint_expense: isIncome ? false : isJointExpense,
    };

    if (editTarget) {
      await onUpdate(editTarget.id, payload);
    } else {
      await onSave(payload);
    }

    // ★ 저장 시점에 방금 쓴 카드를 로컬에 기억
    if (!isIncome && cardId) {
      localStorage.setItem('buboo_last_card', cardId);
    }

    onClose();
  };

  const currentCategories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4 animate-fade-in font-sans select-none">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-800">{editTarget ? '📝 내역 수정하기' : '💸 지출 / 수입 등록'}</h2>
          <button type="button" onClick={onClose} className="text-lg font-black text-slate-400 p-1 active:scale-75">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 no-scrollbar">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button type="button" onClick={() => { setIsIncome(false); setCategory(EXPENSE_CATEGORIES[0]); }} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all duration-200 ${!isIncome ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>💸 지출</button>
            <button type="button" onClick={() => { setIsIncome(true); setCategory(INCOME_CATEGORIES[0]); }} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all duration-200 ${isIncome ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>💰 수입</button>
          </div>

          <div className="space-y-4">
            <div className="flex space-x-3">
              <div className="w-1/3 shrink-0">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">📅 날짜</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-3 text-xs font-bold text-slate-800" required />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">누가 {isIncome ? '벌었나요?' : '결제했나요?'}</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[42px]">
                  <button type="button" onClick={() => setPayer('husband')} className={`flex-1 text-[11px] font-black rounded-lg transition-colors ${payer === 'husband' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{nicknames.husband}</button>
                  <button type="button" onClick={() => setPayer('wife')} className={`flex-1 text-[11px] font-black rounded-lg transition-colors ${payer === 'wife' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>{nicknames.wife}</button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">금액 (원)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-900" required />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">어디서 / 무엇을 (내역)</label>
              <input type="text" value={content} onChange={(e) => setContent(e.target.value)} placeholder={isIncome ? "예: 당근마켓 판매, 7월 월급" : "예: 배달의민족, 이마트, 관리비"} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800" required />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">카테고리</label>
              <div className="grid grid-cols-3 gap-1.5">
                {currentCategories.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)} className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${category === cat ? (isIncome ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-rose-50 border-rose-500 text-rose-700') : 'bg-white border-slate-200 text-slate-600'}`}>{cat}</button>
                ))}
              </div>
            </div>

            {!isIncome && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">결제 카드 / 계좌</label>
                  <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                    <option value="" disabled>카드를 선택하세요</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.card_name} ({c.owner === 'husband' ? nicknames.husband : c.owner === 'wife' ? nicknames.wife : '공용'})</option>)}
                  </select>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer pt-1">
                  <input type="checkbox" checked={isJointExpense} onChange={(e) => setIsJointExpense(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-0" />
                  <span className="text-[11px] font-bold text-slate-700">이 지출을 부부 공용 생활비 정산에 포함합니다.</span>
                </label>
              </div>
            )}
          </div>

          <button type="submit" className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-xl transition-all active:scale-95 cursor-pointer mt-4">
            {editTarget ? '수정 사항 저장하기' : '등록 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}
