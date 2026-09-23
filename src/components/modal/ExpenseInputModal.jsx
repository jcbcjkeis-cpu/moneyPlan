import React, { useState, useEffect, useRef, useMemo } from 'react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, normalizeCategory } from '../../constants/categories';
import { formatNumber, formatKoreanAmount, onlyDigits, toNumber } from '../../lib/format';
import { findCard } from '../../lib/settlement';
import { searchMerchants, findMerchant } from '../../hooks/useHistory';
import { parseCardSms, matchCardByIssuer } from '../../lib/smsParser';
import { useToast } from '../common/Toast';

const QUICK_AMOUNTS = [
  { label: '+1천', value: 1000 },
  { label: '+5천', value: 5000 },
  { label: '+1만', value: 10000 },
  { label: '+5만', value: 50000 },
];

const LAST_CARD_KEY = 'buboo_last_card';

export default function ExpenseInputModal({
  isOpen, onClose, onSave, onUpdate, editTarget,
  currentUserRole, cards = [], cardMap, nicknames, defaultDate,
  merchants = [], favorites = [], favoritesAvailable, onAddFavorite,
}) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState(''); // 숫자만 저장
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [content, setContent] = useState('');
  const [payer, setPayer] = useState(currentUserRole);
  const [cardId, setCardId] = useState('');
  const [isJoint, setIsJoint] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [lastAmountHint, setLastAmountHint] = useState(null);
  const categoryTouched = useRef(false);
  const wasOpen = useRef(false);
  const initFor = useRef(null);

  // 모달이 "열리는 순간"에만 초기화 → 입력 도중 다른 데이터가 바뀌어도 입력값 유지
  useEffect(() => {
    const target = editTarget?.id ?? 'new';
    if (isOpen && (!wasOpen.current || initFor.current !== target)) {
      initFor.current = target;
      categoryTouched.current = false;
      setSmsOpen(false); setSmsText(''); setShowSuggest(false); setLastAmountHint(null); setIsSaving(false);
      if (editTarget) {
        setDate(editTarget.expense_date);
        setIsIncome(!!editTarget.is_income);
        setAmount(String(Math.round(toNumber(editTarget.amount))));
        setContent(editTarget.content || '');
        setPayer(editTarget.payer);
        setCardId(editTarget.card_id != null ? String(editTarget.card_id) : '');
        setIsJoint(!!editTarget.is_joint_expense);
        setCategory(normalizeCategory(editTarget.category, editTarget.is_income));
      } else {
        setDate(defaultDate);
        setIsIncome(false);
        setAmount('');
        setCategory(EXPENSE_CATEGORIES[0]);
        setContent('');
        setIsJoint(true);
        let lastCard = null;
        try { lastCard = localStorage.getItem(LAST_CARD_KEY); } catch { /* 무시 */ }
        const mine = cards.filter((c) => c.owner === currentUserRole || c.owner === 'joint');
        const initial = cards.find((c) => String(c.id) === lastCard) || mine[0] || cards[0];
        setCardId(initial ? String(initial.id) : '');
        setPayer(initial && (initial.owner === 'husband' || initial.owner === 'wife') ? initial.owner : currentUserRole);
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen, editTarget, cards, currentUserRole, defaultDate]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const suggestions = useMemo(
    () => (showSuggest ? searchMerchants(merchants, content, isIncome) : []),
    [showSuggest, merchants, content, isIncome],
  );

  // 즐겨찾기가 없으면 자주 쓴 내역(2회 이상)을 대신 보여줌
  const quickChips = useMemo(() => {
    if (editTarget) return [];
    if (favorites.length > 0) return favorites.map((f) => ({ ...f, kind: 'fav' }));
    return merchants.filter((m) => !m.is_income && m.count >= 2).slice(0, 5).map((m) => ({ ...m, kind: 'freq', amount: null }));
  }, [editTarget, favorites, merchants]);

  if (!isOpen) return null;

  const selectedCard = findCard(cardMap, cardId);
  const currentCategories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const selectCard = (id) => {
    setCardId(id);
    const card = findCard(cardMap, id);
    if (card && (card.owner === 'husband' || card.owner === 'wife')) setPayer(card.owner);
  };

  const selectPayer = (role) => {
    setPayer(role);
    // 다른 사람 개인카드가 선택돼 있으면 그 사람 카드(없으면 공용)로 바꿔줌
    if (selectedCard && selectedCard.owner !== 'joint' && selectedCard.owner !== role) {
      const next = cards.find((c) => c.owner === role) || cards.find((c) => c.owner === 'joint');
      setCardId(next ? String(next.id) : '');
    }
  };

  const switchType = (income) => {
    setIsIncome(income);
    setCategory(income ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    categoryTouched.current = false;
  };

  // 과거 기록/즐겨찾기 값으로 채우기
  const applyTemplate = (t, { withAmount }) => {
    setIsIncome(!!t.is_income);
    setContent(t.content);
    setCategory(normalizeCategory(t.category, t.is_income));
    categoryTouched.current = true;
    if (!t.is_income) {
      setIsJoint(t.is_joint_expense !== false);
      const card = findCard(cardMap, t.card_id);
      if (card?.is_active) selectCard(String(card.id));
      else if (t.payer) setPayer(t.payer);
    }
    if (withAmount && t.amount) setAmount(String(Math.round(toNumber(t.amount))));
    setLastAmountHint(!withAmount && t.amount ? Math.round(toNumber(t.amount)) : null);
    setShowSuggest(false);
  };

  const handleContentBlur = () => {
    setTimeout(() => setShowSuggest(false), 150);
    if (categoryTouched.current) return;
    const hit = findMerchant(merchants, content, isIncome);
    if (hit) applyTemplate(hit, { withAmount: false });
  };

  const applySms = (text) => {
    const result = parseCardSms(text);
    if (!result) return false;
    if (!result.ok) { toast(result.reason, 'error'); return false; }
    if (result.isCancel) {
      toast('결제 취소 문자예요. 원래 내역을 찾아 수정하거나 삭제해 주세요.', 'warning', { duration: 5000 });
      return false;
    }
    switchType(false);
    setAmount(String(result.amount));
    if (result.date) setDate(result.date);
    if (result.merchant) setContent(result.merchant);
    const card = matchCardByIssuer(result.issuerKey, cards);
    if (card) selectCard(String(card.id));
    const hit = result.merchant ? findMerchant(merchants, result.merchant, false) : null;
    if (hit) {
      setCategory(normalizeCategory(hit.category, false));
      setIsJoint(hit.is_joint_expense !== false);
      categoryTouched.current = true;
    }
    const notes = [];
    if (!card && result.issuerKey) notes.push(`'${result.issuerKey}' 카드를 찾지 못했어요. 설정에서 카드 이름에 '${result.issuerKey}'를 넣으면 자동 선택돼요`);
    if (result.installmentMonths) notes.push(`${result.installmentMonths}개월 할부라 총액으로 입력했어요`);
    toast(notes.length ? notes.join('. ') : '문자 내용을 채웠어요. 확인 후 저장하세요.', notes.length ? 'warning' : 'success', { duration: notes.length ? 5000 : 2500 });
    setSmsOpen(false);
    setSmsText('');
    return true;
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setSmsText(text); applySms(text); }
    } catch {
      toast('클립보드를 읽을 수 없어요. 아래 칸을 길게 눌러 붙여넣어 주세요.', 'warning');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { toast('금액을 입력해주세요.', 'error'); return; }
    if (!content.trim()) { toast('어디서 / 무엇을 썼는지 입력해주세요.', 'error'); return; }
    if (!date) { toast('날짜를 선택해주세요.', 'error'); return; }

    const card = findCard(cardMap, cardId);
    const payload = {
      expense_date: date,
      is_income: isIncome,
      amount: amountNum,
      category,
      content: content.trim(),
      payer,
      card_id: isIncome || !card ? null : card.id,
      is_joint_expense: isIncome ? false : isJoint,
    };

    if (editTarget?.is_settled) {
      const changed = toNumber(editTarget.amount) !== payload.amount
        || ['payer', 'is_joint_expense', 'is_income'].some((k) => payload[k] !== editTarget[k])
        || String(payload.card_id ?? '') !== String(editTarget.card_id ?? '');
      if (changed && !window.confirm('이미 정산이 끝난 내역이에요.\n금액·결제자·카드·공용 여부를 바꾸면 지난 정산 금액과 달라집니다.\n그래도 저장할까요?')) return;
    }

    setIsSaving(true);
    const res = editTarget ? await onUpdate(editTarget.id, payload) : await onSave(payload);
    setIsSaving(false);
    if (!res?.ok) { toast(`저장하지 못했어요: ${res?.error || '네트워크를 확인해주세요.'}`, 'error'); return; }

    if (!isIncome && card) { try { localStorage.setItem(LAST_CARD_KEY, String(card.id)); } catch { /* 무시 */ } }
    toast(editTarget ? '수정했어요.' : '등록했어요.', 'success', { duration: 1800 });
    onClose();
  };

  const handleAddFavorite = async () => {
    if (!favoritesAvailable) { toast('즐겨찾기를 쓰려면 먼저 migration_v2.sql을 실행해주세요.', 'error'); return; }
    if (!content.trim()) { toast('내역 이름을 먼저 입력해주세요.', 'error'); return; }
    const card = findCard(cardMap, cardId);
    const res = await onAddFavorite({
      content: content.trim(), category, amount: Number(amount) || null,
      card_id: isIncome || !card ? null : String(card.id), is_income: isIncome, is_joint_expense: isIncome ? false : isJoint,
    });
    toast(res.ok ? `'${content.trim()}' 즐겨찾기에 추가했어요.` : `추가하지 못했어요: ${res.error}`, res.ok ? 'success' : 'error');
  };

  const ownerName = (owner) => (owner === 'husband' ? nicknames.husband : owner === 'wife' ? nicknames.wife : '공용');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editTarget ? '내역 수정' : '내역 등록'}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-800">{editTarget ? '내역 수정' : '지출 / 수입 등록'}</h2>
          <div className="flex items-center gap-1">
            {!editTarget && (
              <button type="button" onClick={() => setSmsOpen((v) => !v)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${smsOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                💬 카드 문자로 입력
              </button>
            )}
            <button type="button" onClick={onClose} className="w-9 h-9 text-lg font-black text-slate-400 active:scale-90" aria-label="닫기">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pt-4 pb-6 overflow-y-auto space-y-4 no-scrollbar">
          {smsOpen && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-fade-in">
              <p className="text-xs font-medium text-slate-600">카드 승인 문자를 복사해서 붙여넣으면 금액·사용처·날짜·카드를 채워드려요.</p>
              {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
                <button type="button" onClick={pasteFromClipboard} className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-bold active:scale-[0.98]">
                  📋 복사한 문자 붙여넣기
                </button>
              )}
              <textarea
                value={smsText}
                onChange={(e) => { setSmsText(e.target.value); if (/\d\s*원/.test(e.target.value)) applySms(e.target.value); }}
                rows={3}
                placeholder="[Web발신] 신한카드(1234)승인 홍*동 12,000원(일시불) 09/23 14:30 이마트"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-base text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button type="button" onClick={() => switchType(false)} className={`flex-1 py-2 text-[13px] font-black rounded-xl transition ${!isIncome ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500'}`}>💸 지출</button>
            <button type="button" onClick={() => switchType(true)} className={`flex-1 py-2 text-[13px] font-black rounded-xl transition ${isIncome ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'}`}>💰 수입</button>
          </div>

          {quickChips.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">{quickChips[0].kind === 'fav' ? '⭐ 즐겨찾기' : '자주 쓴 내역'}</p>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
                {quickChips.map((chip) => (
                  <button
                    key={`${chip.kind}-${chip.id}`}
                    type="button"
                    onClick={() => applyTemplate(chip, { withAmount: chip.kind === 'fav' })}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 active:scale-95 hover:border-slate-400"
                  >
                    {chip.content}
                    {chip.amount ? <span className="text-slate-400 font-medium ml-1">{formatNumber(chip.amount)}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="w-[46%] shrink-0">
              <label htmlFor="exp-date" className="block text-[11px] font-bold text-slate-500 mb-1">날짜</label>
              <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-base font-bold text-slate-800" required />
            </div>
            <div className="flex-1">
              <span className="block text-[11px] font-bold text-slate-500 mb-1">{isIncome ? '누가 벌었나요?' : '누가 결제했나요?'}</span>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[42px]">
                <button type="button" onClick={() => selectPayer('husband')} className={`flex-1 text-xs font-black rounded-lg transition ${payer === 'husband' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{nicknames.husband}</button>
                <button type="button" onClick={() => selectPayer('wife')} className={`flex-1 text-xs font-black rounded-lg transition ${payer === 'wife' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>{nicknames.wife}</button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="exp-amount" className="block text-[11px] font-bold text-slate-500 mb-1">금액</label>
            <div className="relative">
              <input
                id="exp-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={amount ? formatNumber(amount) : ''}
                onChange={(e) => setAmount(onlyDigits(e.target.value).slice(0, 12))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-xl font-black text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">원</span>
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-2 min-h-[18px]">
              <span className="text-xs font-bold text-indigo-600">{formatKoreanAmount(amount)}</span>
              {lastAmountHint && String(lastAmountHint) !== amount && (
                <button type="button" onClick={() => setAmount(String(lastAmountHint))} className="text-[11px] font-bold text-slate-500 underline underline-offset-2">
                  지난번 {formatNumber(lastAmountHint)}원 넣기
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((q) => (
                <button key={q.label} type="button" onClick={() => setAmount(String((Number(amount) || 0) + q.value))} className="py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 active:scale-95 active:bg-slate-100">
                  {q.label}
                </button>
              ))}
              <button type="button" onClick={() => setAmount('')} className="py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 active:scale-95">지우기</button>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="exp-content" className="block text-[11px] font-bold text-slate-500 mb-1">어디서 / 무엇을</label>
            <input
              id="exp-content"
              type="text"
              autoComplete="off"
              value={content}
              onChange={(e) => { setContent(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={handleContentBlur}
              placeholder={isIncome ? '예: 9월 월급, 당근마켓 판매' : '예: 이마트, 배달의민족, 관리비'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 focus:outline-none focus:border-blue-500"
            />
            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {suggestions.map((s) => {
                  const card = findCard(cardMap, s.card_id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyTemplate(s, { withAmount: false })}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0"
                      >
                        <span className="text-[13px] font-bold text-slate-800 truncate">{s.content}</span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {normalizeCategory(s.category, s.is_income)}{card ? ` · ${card.card_name}` : ''} · {s.count}회
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">카테고리</span>
            <div className="grid grid-cols-3 gap-1.5">
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategory(cat); categoryTouched.current = true; }}
                  className={`py-2 text-[11px] font-bold rounded-lg border transition ${category === cat ? (isIncome ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-rose-50 border-rose-500 text-rose-700') : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {!isIncome && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <label htmlFor="exp-card" className="block text-[11px] font-bold text-slate-500 mb-1">결제 카드 / 계좌</label>
                <select id="exp-card" value={cardId} onChange={(e) => selectCard(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-base font-bold text-slate-800">
                  <option value="">현금 / 기타</option>
                  {cards.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.card_name} ({ownerName(c.owner)})</option>
                  ))}
                  {selectedCard && !selectedCard.is_active && (
                    <option value={String(selectedCard.id)}>{selectedCard.card_name} (숨긴 카드)</option>
                  )}
                </select>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 mb-1">이 지출은</span>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  <button type="button" onClick={() => setIsJoint(true)} className={`flex-1 py-1.5 text-xs font-black rounded-lg transition ${isJoint ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>공용 생활비</button>
                  <button type="button" onClick={() => setIsJoint(false)} className={`flex-1 py-1.5 text-xs font-black rounded-lg transition ${!isJoint ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>개인 지출</button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                  {!isJoint
                    ? '부부 정산에 포함되지 않아요.'
                    : selectedCard?.owner === 'joint'
                      ? '공용카드로 낸 돈이라 따로 정산할 금액은 없어요.'
                      : `${ownerName(selectedCard ? selectedCard.owner : payer)}님이 낸 공용 생활비로 정산에 포함돼요.`}
                </p>
              </div>
            </div>
          )}

          {editTarget?.is_settled && (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              정산이 끝난 내역이에요. 금액이나 결제 정보를 바꾸면 지난 정산과 달라져요.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {!editTarget && (
              <button type="button" onClick={handleAddFavorite} className="px-4 rounded-2xl border border-slate-200 bg-white text-base active:scale-95" aria-label="지금 입력한 내용을 즐겨찾기에 추가">
                ⭐
              </button>
            )}
            <button type="submit" disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-xl transition active:scale-[0.98] disabled:opacity-60">
              {isSaving ? '저장 중…' : editTarget ? '수정 내용 저장' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
