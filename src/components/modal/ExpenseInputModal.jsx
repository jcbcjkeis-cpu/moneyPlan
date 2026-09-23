import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ClipboardPaste, CreditCard, MessageSquareText, Star, Trash2, User, Users } from 'lucide-react';
import Sheet from '../common/Sheet';
import { useToast } from '../common/Toast';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, normalizeCategory } from '../../constants/categories';
import { formatDateLabel, formatKoreanAmount, formatNumber, onlyDigits, toNumber } from '../../lib/format';
import { findCard } from '../../lib/settlement';
import { findMerchant, searchMerchants } from '../../hooks/useHistory';
import { matchCardByIssuer, parseCardSms } from '../../lib/smsParser';
import { haptic } from '../../lib/haptic';

const QUICK_AMOUNTS = [
  { label: '+1천', value: 1000 },
  { label: '+5천', value: 5000 },
  { label: '+1만', value: 10000 },
  { label: '+5만', value: 50000 },
];
const LAST_CARD_KEY = 'buboo_last_card';
const TOP_CATEGORY_COUNT = 6;

export default function ExpenseInputModal({
  isOpen, onClose, onSave, onUpdate, onDelete, editTarget,
  currentUserRole, cards = [], cardMap, nicknames, defaultDate,
  merchants = [], favorites = [], favoritesAvailable, onAddFavorite, initialSms, onInitialSmsUsed,
}) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [content, setContent] = useState('');
  const [payer, setPayer] = useState(currentUserRole);
  const [cardId, setCardId] = useState('');
  const [isJoint, setIsJoint] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [lastAmountHint, setLastAmountHint] = useState(null);
  const categoryTouched = useRef(false);
  const wasOpen = useRef(false);
  const initFor = useRef(null);
  const amountRef = useRef(null);
  const applySmsRef = useRef(null);

  // 열리는 순간에만 초기화 → 입력 도중 데이터가 바뀌어도 입력값 유지
  useEffect(() => {
    const target = editTarget?.id ?? 'new';
    if (isOpen && (!wasOpen.current || initFor.current !== target)) {
      initFor.current = target;
      categoryTouched.current = false;
      setSmsOpen(false); setSmsText(''); setShowSuggest(false); setLastAmountHint(null);
      setIsSaving(false); setShowAllCategories(false);
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
        if (initialSms) {
          // 단축어(?sms=)로 열린 경우: 카드 문자 내용을 바로 채움
          const text = initialSms;
          onInitialSmsUsed?.();
          setTimeout(() => applySmsRef.current?.(text), 0);
        } else {
          setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 280);
        }
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen, editTarget, cards, currentUserRole, defaultDate]);

  const suggestions = useMemo(
    () => (showSuggest ? searchMerchants(merchants, content, isIncome) : []),
    [showSuggest, merchants, content, isIncome],
  );

  const quickChips = useMemo(() => {
    if (editTarget) return [];
    if (favorites.length > 0) return favorites.map((f) => ({ ...f, kind: 'fav' }));
    return merchants.filter((m) => !m.is_income && m.count >= 2).slice(0, 6).map((m) => ({ ...m, kind: 'freq', amount: null }));
  }, [editTarget, favorites, merchants]);

  // 자주 쓰는 카테고리 순서 (과거 기록 기준)
  const orderedCategories = useMemo(() => {
    const base = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const score = {};
    merchants.forEach((m) => {
      if (m.is_income !== isIncome) return;
      const c = normalizeCategory(m.category, isIncome);
      score[c] = (score[c] || 0) + m.count;
    });
    return [...base].sort((a, b) => (score[b] || 0) - (score[a] || 0) || base.indexOf(a) - base.indexOf(b));
  }, [merchants, isIncome]);

  const visibleCategories = useMemo(() => {
    if (showAllCategories || isIncome) return orderedCategories;
    const top = orderedCategories.slice(0, TOP_CATEGORY_COUNT);
    return top.includes(category) ? top : [...top.slice(0, TOP_CATEGORY_COUNT - 1), category];
  }, [orderedCategories, showAllCategories, isIncome, category]);

  const selectedCard = findCard(cardMap, cardId);
  const nameOf = (role) => (role === 'husband' ? nicknames.husband : role === 'wife' ? nicknames.wife : '공용');

  const selectCard = (id) => {
    setCardId(id);
    const card = findCard(cardMap, id);
    if (card && (card.owner === 'husband' || card.owner === 'wife')) setPayer(card.owner);
  };

  const togglePayer = () => {
    const role = payer === 'husband' ? 'wife' : 'husband';
    setPayer(role);
    if (selectedCard && selectedCard.owner !== 'joint' && selectedCard.owner !== role) {
      const next = cards.find((c) => c.owner === role) || cards.find((c) => c.owner === 'joint');
      setCardId(next ? String(next.id) : '');
    }
  };

  const switchType = (income) => {
    if (income === isIncome) return;
    setIsIncome(income);
    setCategory(income ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    categoryTouched.current = false;
  };

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
    if (!result) return;
    if (!result.ok) { toast(result.reason, 'error'); return; }
    if (result.isCancel) { toast('결제 취소 문자예요. 원래 내역을 찾아 수정하거나 삭제해 주세요.', 'warning', { duration: 5000 }); return; }
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
  };

  applySmsRef.current = applySms;

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setSmsText(text); applySms(text); }
    } catch {
      toast('클립보드를 읽을 수 없어요. 아래 칸을 길게 눌러 붙여넣어 주세요.', 'warning');
    }
  };

  const resetForNext = () => {
    setAmount('');
    setContent('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setIsIncome(false);
    setLastAmountHint(null);
    categoryTouched.current = false;
    amountRef.current?.focus({ preventScroll: true });
  };

  const submit = async (keepOpen) => {
    if (isSaving) return;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { toast('금액을 입력해주세요.', 'error'); amountRef.current?.focus(); return; }
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

    haptic();
    if (!isIncome && card) { try { localStorage.setItem(LAST_CARD_KEY, String(card.id)); } catch { /* 무시 */ } }
    if (keepOpen) {
      toast(`${payload.content} ${formatNumber(amountNum)}원 등록했어요. 이어서 입력하세요.`, 'success', { duration: 2000 });
      resetForNext();
    } else {
      toast(editTarget ? '수정했어요.' : '등록했어요.', 'success', { duration: 1800 });
      onClose();
    }
  };

  const handleAddFavorite = async () => {
    if (!favoritesAvailable) { toast('즐겨찾기를 쓰려면 먼저 migration_v2.sql을 실행해주세요.', 'error'); return; }
    if (!content.trim()) { toast('내역 이름을 먼저 입력해주세요.', 'error'); return; }
    const card = findCard(cardMap, cardId);
    const res = await onAddFavorite({
      content: content.trim(), category, amount: Number(amount) || null,
      card_id: isIncome || !card ? null : String(card.id), is_income: isIncome, is_joint_expense: isIncome ? false : isJoint,
    });
    if (res.ok) haptic();
    toast(res.ok ? `'${content.trim()}' 즐겨찾기에 추가했어요.` : `추가하지 못했어요: ${res.error}`, res.ok ? 'success' : 'error');
  };

  const pill = 'relative h-11 px-3.5 rounded-full bg-fill text-[14px] font-semibold text-ink flex items-center gap-1.5 shrink-0';
  const jointHelp = isIncome ? null
    : !isJoint ? '개인 지출이라 부부 정산에 들어가지 않아요.'
      : selectedCard?.owner === 'joint' ? '공용카드로 낸 돈이라 따로 정산할 금액은 없어요.'
        : `${nameOf(selectedCard ? selectedCard.owner : payer)}님이 낸 공용 생활비로 정산에 들어가요.`;

  const footer = editTarget ? (
    <div className="flex gap-2">
      <button type="button" onClick={() => { onClose(); onDelete(editTarget); }} className="h-[52px] px-4 rounded-2xl border border-line text-danger font-bold flex items-center gap-1.5 active:scale-95" aria-label="이 내역 삭제">
        <Trash2 size={18} /> 삭제
      </button>
      <button type="button" disabled={isSaving} onClick={() => submit(false)} className="flex-1 h-[52px] rounded-2xl bg-ink text-card text-[16px] font-bold disabled:opacity-60 active:scale-[0.98]">
        {isSaving ? '저장 중…' : '수정 내용 저장'}
      </button>
    </div>
  ) : (
    <div className="flex gap-2">
      <button type="button" onClick={handleAddFavorite} className="w-[52px] h-[52px] rounded-2xl border border-line text-warn flex items-center justify-center active:scale-95 shrink-0" aria-label="지금 입력한 내용을 즐겨찾기에 추가">
        <Star size={20} />
      </button>
      <button type="button" disabled={isSaving} onClick={() => submit(true)} className="h-[52px] px-4 rounded-2xl border border-line text-ink2 text-[15px] font-bold disabled:opacity-60 active:scale-95 shrink-0">
        계속 입력
      </button>
      <button type="button" disabled={isSaving} onClick={() => submit(false)} className="flex-1 h-[52px] rounded-2xl bg-ink text-card text-[16px] font-bold disabled:opacity-60 active:scale-[0.98]">
        {isSaving ? '저장 중…' : '등록'}
      </button>
    </div>
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={editTarget ? '내역 수정' : isIncome ? '수입 입력' : '지출 입력'}
      footer={footer}
      zIndex={55}
      headerRight={!editTarget && (
        <button type="button" onClick={() => setSmsOpen((v) => !v)} className={`h-9 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1 ${smsOpen ? 'bg-ink text-card' : 'bg-fill text-ink2'}`}>
          <MessageSquareText size={16} /> 카드 문자
        </button>
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="px-5 pb-5 space-y-5">
        {smsOpen && (
          <div className="p-3 bg-fill rounded-2xl space-y-2 animate-fade-in">
            <p className="text-[13px] text-ink2">카드 승인 문자를 복사해서 붙여넣으면 금액·사용처·날짜·카드를 채워드려요.</p>
            {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
              <button type="button" onClick={pasteFromClipboard} className="w-full h-11 rounded-xl bg-ink text-card text-[14px] font-bold flex items-center justify-center gap-1.5">
                <ClipboardPaste size={17} /> 복사한 문자 붙여넣기
              </button>
            )}
            <textarea
              value={smsText}
              onChange={(e) => { setSmsText(e.target.value); if (/\d\s*원/.test(e.target.value)) applySms(e.target.value); }}
              rows={3}
              placeholder="여기에 붙여넣어도 돼요"
              className="w-full bg-card border border-line rounded-xl px-3 py-2 text-base text-ink placeholder:text-muted focus:outline-none focus:border-husband"
              aria-label="카드 문자 내용"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex bg-fill p-1 rounded-full" role="group" aria-label="지출 또는 수입">
            <button type="button" onClick={() => switchType(false)} aria-pressed={!isIncome} className={`h-9 px-4 rounded-full text-[14px] font-bold ${!isIncome ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>지출</button>
            <button type="button" onClick={() => switchType(true)} aria-pressed={isIncome} className={`h-9 px-4 rounded-full text-[14px] font-bold ${isIncome ? 'bg-card text-income shadow-xs' : 'text-muted'}`}>수입</button>
          </div>
        </div>

        {quickChips.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-muted mb-2 flex items-center gap-1">
              {quickChips[0].kind === 'fav' ? <><Star size={14} className="text-warn" /> 즐겨찾기</> : '자주 쓴 내역'}
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {quickChips.map((chip) => (
                <button
                  key={`${chip.kind}-${chip.id}`}
                  type="button"
                  onClick={() => applyTemplate(chip, { withAmount: chip.kind === 'fav' })}
                  className="shrink-0 h-10 px-3.5 rounded-full border border-line bg-card text-[14px] font-semibold text-ink2 active:scale-95"
                >
                  {chip.content}
                  {chip.amount ? <span className="text-muted font-medium ml-1 num">{formatNumber(chip.amount)}</span> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="exp-amount" className="sr-only">금액</label>
          <div className="flex items-baseline gap-1 border-b-2 border-line focus-within:border-ink pb-1">
            <input
              ref={amountRef}
              id="exp-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              value={amount ? formatNumber(amount) : ''}
              onChange={(e) => setAmount(onlyDigits(e.target.value).slice(0, 12))}
              placeholder="0"
              className={`num flex-1 min-w-0 bg-transparent text-[36px] font-extrabold focus:outline-none placeholder:text-line ${isIncome ? 'text-income' : 'text-ink'}`}
            />
            <span className="text-[20px] font-bold text-muted">원</span>
          </div>
          <div className="flex items-center justify-between mt-1.5 min-h-[20px]">
            <span className="text-[14px] font-semibold text-husband">{formatKoreanAmount(amount)}</span>
            {lastAmountHint && String(lastAmountHint) !== amount && (
              <button type="button" onClick={() => setAmount(String(lastAmountHint))} className="text-[13px] font-semibold text-muted underline underline-offset-2">
                지난번 {formatNumber(lastAmountHint)}원
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {QUICK_AMOUNTS.map((q) => (
              <button key={q.label} type="button" onClick={() => setAmount(String((Number(amount) || 0) + q.value))} className="h-11 rounded-xl bg-fill text-[14px] font-semibold text-ink2 active:scale-95">
                {q.label}
              </button>
            ))}
            <button type="button" onClick={() => setAmount('')} className="h-11 rounded-xl border border-line text-[14px] font-semibold text-muted active:scale-95">지우기</button>
          </div>
        </div>

        <div className="relative">
          <label htmlFor="exp-content" className="block text-[13px] font-semibold text-muted mb-1.5">어디서 / 무엇을</label>
          <input
            id="exp-content"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={content}
            onChange={(e) => { setContent(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={handleContentBlur}
            placeholder={isIncome ? '예: 9월 월급, 당근마켓 판매' : '예: 이마트, 배달의민족, 관리비'}
            className="w-full h-12 bg-fill rounded-xl px-4 text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-card border border-line rounded-xl shadow-xl overflow-hidden">
              {suggestions.map((s) => {
                const card = findCard(cardMap, s.card_id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTemplate(s, { withAmount: false })}
                      className="w-full min-h-[48px] text-left px-4 py-2 active:bg-fill flex items-center justify-between gap-2 border-b border-line last:border-0"
                    >
                      <span className="text-[15px] font-semibold text-ink truncate">{s.content}</span>
                      <span className="text-[12px] text-muted shrink-0">
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
          <div className="flex gap-2 flex-wrap">
            <label className={pill}>
              <CalendarDays size={16} className="text-muted" />
              {formatDateLabel(date)}
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* 무시 */ } }}
                className="absolute inset-0 opacity-0 w-full h-full text-base cursor-pointer"
                aria-label="날짜 변경"
              />
            </label>
            <button type="button" onClick={togglePayer} className={pill} aria-label={`${isIncome ? '번 사람' : '결제자'}: ${nameOf(payer)}. 누르면 바뀝니다`}>
              <User size={16} className={payer === 'husband' ? 'text-husband' : 'text-wife'} />
              {nameOf(payer)}
            </button>
            {!isIncome && (
              <>
                <label className={pill}>
                  <CreditCard size={16} className="text-muted" />
                  <span className="max-w-[120px] truncate">{selectedCard ? selectedCard.card_name : '현금/기타'}</span>
                  <ChevronDown size={14} className="text-muted" />
                  <select value={cardId} onChange={(e) => selectCard(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full text-base cursor-pointer" aria-label="결제 카드 선택">
                    <option value="">현금 / 기타</option>
                    {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.card_name} ({nameOf(c.owner)})</option>)}
                    {selectedCard && !selectedCard.is_active && <option value={String(selectedCard.id)}>{selectedCard.card_name} (숨긴 카드)</option>}
                  </select>
                </label>
                <button type="button" onClick={() => setIsJoint((v) => !v)} aria-pressed={isJoint} className={`${pill} ${isJoint ? '!bg-joint-soft !text-joint' : ''}`}>
                  <Users size={16} />
                  {isJoint ? '공용 생활비' : '개인 지출'}
                </button>
              </>
            )}
          </div>
          {jointHelp && <p className="text-[13px] text-muted mt-2 px-1">{jointHelp}</p>}
        </div>

        <div>
          <p className="text-[13px] font-semibold text-muted mb-2">카테고리</p>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategory(cat); categoryTouched.current = true; }}
                aria-pressed={category === cat}
                className={`h-10 px-3.5 rounded-full text-[14px] font-semibold border transition ${category === cat ? 'bg-ink text-card border-ink' : 'bg-card text-ink2 border-line'}`}
              >
                {cat}
              </button>
            ))}
            {!isIncome && (
              <button type="button" onClick={() => setShowAllCategories((v) => !v)} className="h-10 px-3.5 rounded-full text-[14px] font-semibold text-husband">
                {showAllCategories ? '접기' : `더보기 (${EXPENSE_CATEGORIES.length - visibleCategories.length})`}
              </button>
            )}
          </div>
        </div>

        {editTarget?.is_settled && (
          <p className="text-[13px] font-semibold text-warn bg-warn-soft rounded-xl px-3 py-2.5">
            정산이 끝난 내역이에요. 금액이나 결제 정보를 바꾸면 지난 정산과 달라져요.
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
