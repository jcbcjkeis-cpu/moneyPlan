import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ClipboardPaste, CreditCard, History, MessageSquareText, Star, Trash2, User, Users } from 'lucide-react';
import Sheet from '../common/Sheet';
import { useToast } from '../common/Toast';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, normalizeCategory } from '../../constants/categories';
import { formatKoreanAmount, formatNumber, toNumber, toYmd } from '../../lib/format';
import { findCard } from '../../lib/cards';
import { findMerchant, searchMerchants } from '../../hooks/useHistory';
import { matchCardByIssuer, parseCardSms } from '../../lib/smsParser';
import { evaluateAmountExpr } from '../../lib/quickParse';
import { guessCategory } from '../../lib/autoCategory';
import { haptic } from '../../lib/haptic';

const QUICK_AMOUNTS = [
  { label: '+1천', value: 1000 },
  { label: '+5천', value: 5000 },
  { label: '+1만', value: 10000 },
  { label: '+5만', value: 50000 },
];
const LAST_CARD_KEY = 'buboo_last_card';

// "오늘" / "어제" / "11/19 (목)" 처럼 짧게
function shortDate(ymd) {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - d) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`;
}

export default function ExpenseInputModal({
  isOpen, onClose, onSave, onUpdate, onDelete, editTarget,
  currentUserRole, cards = [], cardMap, nicknames, defaultDate,
  merchants = [], favorites = [], favoritesAvailable, onAddFavorite, initialSms, onInitialSmsUsed, onReopen,
}) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState(''); // 숫자 또는 계산식 ("12000+3500")
  const [dateOpen, setDateOpen] = useState(false);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [content, setContent] = useState('');
  const [payer, setPayer] = useState(currentUserRole);
  const [cardId, setCardId] = useState('');
  const [isJoint, setIsJoint] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [lastAmountHint, setLastAmountHint] = useState(null);
  const categoryTouched = useRef(false);
  const [autoCat, setAutoCat] = useState(null); // 이름으로 자동 고른 카테고리 (직접 고르면 null)
  const wasOpen = useRef(false);
  const initFor = useRef(null);
  const amountRef = useRef(null);
  const contentRef = useRef(null);
  const applySmsRef = useRef(null);

  // 열리는 순간에만 초기화 → 입력 도중 데이터가 바뀌어도 입력값 유지
  useEffect(() => {
    const target = editTarget?.id ?? 'new';
    if (isOpen && (!wasOpen.current || initFor.current !== target)) {
      initFor.current = target;
      categoryTouched.current = false;
      setAutoCat(null);
      setSmsOpen(false); setSmsText(''); setNameFocused(false); setLastAmountHint(null); setDateOpen(false);
      setIsSaving(false);
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

  // 이름 추천: 입력 중일 때만, 입력칸 아래 한 줄 버튼으로 (화면을 덮지 않음)
  const suggestions = useMemo(() => {
    if (!nameFocused || !content.trim()) return [];
    const q = content.trim().toLowerCase();
    return searchMerchants(merchants, content, isIncome, 5).filter((m) => m.content.toLowerCase() !== q);
  }, [nameFocused, merchants, content, isIncome]);

  // 같은 이름의 지난 기록 → "지난번 설정" 제안 (누를 때만 적용, 자동으로 바꾸지 않음)
  const past = useMemo(() => findMerchant(merchants, content, isIncome), [merchants, content, isIncome]);

  // 즐겨찾기만 위에 보여줌 (자주 쓴 곳은 빠른 입력에서)
  const quickChips = useMemo(
    () => (editTarget ? [] : favorites.map((f) => ({ ...f, kind: 'fav' }))),
    [editTarget, favorites],
  );

  // 카테고리 자동 분류: 같은 이름의 지난 기록 → 이름 속 단어(1,000여 개)
  //  - 새로 입력할 때만, 카테고리를 직접 누르기 전까지만 바꿈
  const guessedCategory = useMemo(() => {
    if (editTarget || !content.trim()) return null;
    const pastCat = past ? normalizeCategory(past.category, isIncome) : null;
    if (pastCat && !/^기타/.test(pastCat)) return pastCat;
    return guessCategory(content, { income: isIncome }) || pastCat;
  }, [editTarget, content, past, isIncome]);

  useEffect(() => {
    if (!isOpen || editTarget || categoryTouched.current) return;
    if (guessedCategory) {
      setCategory(guessedCategory);
      setAutoCat(guessedCategory);
    } else if (autoCat) {
      setCategory(isIncome ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
      setAutoCat(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCategory, isOpen, editTarget]);

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

  // 카테고리는 한 줄로 옆으로 넘기기, 고른 것은 맨 앞에
  const visibleCategories = useMemo(
    () => [category, ...orderedCategories.filter((c) => c !== category)],
    [orderedCategories, category],
  );

  // 금액: 계산식이면 계산 결과, 아니면 숫자
  const isExpr = /[+\-×÷*/()]/.test(amount);
  const amountValue = amount ? evaluateAmountExpr(amount) : null;
  const amountStr = amountValue ? String(amountValue) : '';
  const showAmount = (v) => (/[+\-×÷*/()]/.test(v) ? v.replace(/\d+/g, (d) => formatNumber(d)) : v ? formatNumber(v) : '');
  const typeAmount = (raw) => {
    const t = raw.replace(/,/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/[^0-9+\-×÷()]/g, '').slice(0, 40);
    setAmount(t);
  };
  const addOp = (op) => setAmount((prev) => (prev && !/[+\-×÷]$/.test(prev) ? prev + op : prev.replace(/[+\-×÷]$/, '') + (prev ? op : '')));
  const collapseExpr = () => { if (isExpr && amountValue) setAmount(String(amountValue)); };

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
    setAutoCat(null);
  };

  const applyTemplate = (t, { withAmount }) => {
    setIsIncome(!!t.is_income);
    setContent(t.content);
    setCategory(normalizeCategory(t.category, t.is_income));
    categoryTouched.current = true; setAutoCat(null);
    if (!t.is_income) {
      setIsJoint(t.is_joint_expense !== false);
      const card = findCard(cardMap, t.card_id);
      if (card?.is_active) selectCard(String(card.id));
      else if (t.payer) setPayer(t.payer);
    }
    if (withAmount && t.amount) setAmount(String(Math.round(toNumber(t.amount))));
    setLastAmountHint(!withAmount && t.amount ? Math.round(toNumber(t.amount)) : null);
  };

  // 지난번 설정 중 지금과 다른 것만 골라 보여줌
  const pastCard = past && !past.is_income ? findCard(cardMap, past.card_id) : null;
  const pastDiff = past ? {
    category: normalizeCategory(past.category, past.is_income) !== category ? normalizeCategory(past.category, past.is_income) : null,
    card: !isIncome && pastCard?.is_active && String(pastCard.id) !== String(cardId) ? pastCard : null,
    joint: !isIncome && (past.is_joint_expense !== false) !== isJoint ? (past.is_joint_expense !== false) : null,
    amount: past.amount && String(Math.round(toNumber(past.amount))) !== amountStr ? Math.round(toNumber(past.amount)) : null,
  } : null;
  const hasPastDiff = pastDiff && (pastDiff.category || pastDiff.card || pastDiff.joint !== null);

  const applyPast = () => {
    if (!pastDiff) return;
    if (pastDiff.category) { setCategory(pastDiff.category); categoryTouched.current = true; setAutoCat(null); }
    if (pastDiff.card) selectCard(String(pastDiff.card.id));
    if (pastDiff.joint !== null) setIsJoint(pastDiff.joint);
    haptic();
  };

  // 입력칸을 누르면 키보드 위로 보이게 스크롤
  const keepVisible = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.type === 'date') return;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
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
      categoryTouched.current = true; setAutoCat(null);
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
    setAutoCat(null);
    amountRef.current?.focus({ preventScroll: true });
  };

  const submit = async (keepOpen) => {
    if (isSaving) return;
    const amountNum = amountValue || 0;
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
      const saved = !editTarget ? res.data : null;
      toast(editTarget ? '수정했어요.' : `${payload.content} ${formatNumber(amountNum)}원 등록했어요.`, 'success', {
        duration: saved ? 5000 : 1800,
        action: saved && onReopen ? { label: '수정', onClick: () => onReopen(saved) } : undefined,
      });
      onClose();
    }
  };

  const handleAddFavorite = async () => {
    if (!favoritesAvailable) { toast('즐겨찾기를 쓰려면 먼저 migration_v2.sql을 실행해주세요.', 'error'); return; }
    if (!content.trim()) { toast('내역 이름을 먼저 입력해주세요.', 'error'); return; }
    const card = findCard(cardMap, cardId);
    const res = await onAddFavorite({
      content: content.trim(), category, amount: amountValue || null,
      card_id: isIncome || !card ? null : String(card.id), is_income: isIncome, is_joint_expense: isIncome ? false : isJoint,
    });
    if (res.ok) haptic();
    toast(res.ok ? `'${content.trim()}' 즐겨찾기에 추가했어요.` : `추가하지 못했어요: ${res.error}`, res.ok ? 'success' : 'error');
  };

  const pill = 'relative h-10 px-3 rounded-full bg-fill text-[13px] font-semibold text-ink flex items-center gap-1.5 shrink-0';

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
      help={(
        <div className="space-y-0.5">
          <p>· 금액 옆 <strong>+ − × ÷</strong>로 계산, <strong>반반</strong>은 절반으로</p>
          <p>· 날짜를 누르면 <strong>오늘 · 어제 · 그제 · 3일 전</strong> 바로 고르기</p>
          <p>· 사용처를 쓰면 카테고리가 <strong>자동</strong>으로 골라져요. 직접 누르면 그대로 유지</p>
          <p>· 전에 쓴 곳이면 <strong>지난번</strong> 카드·금액을 [적용]으로 한 번에</p>
          <p>· 저장 뒤 알림의 <strong>수정</strong>을 누르면 방금 입력한 걸 바로 고쳐요</p>
        </div>
      )}
      footer={footer}
      zIndex={55}
      headerRight={!editTarget && (
        <button type="button" onClick={() => setSmsOpen((v) => !v)} className={`h-9 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1 ${smsOpen ? 'bg-ink text-card' : 'bg-fill text-ink2'}`}>
          <MessageSquareText size={16} /> 카드 문자
        </button>
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} onFocusCapture={keepVisible} className="px-5 pb-4 space-y-4">
        {smsOpen && (
          <div className="p-3 bg-fill rounded-2xl space-y-2 animate-fade-in">
            {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
              <button type="button" onClick={pasteFromClipboard} className="w-full h-11 rounded-xl bg-ink text-card text-[14px] font-bold flex items-center justify-center gap-1.5">
                <ClipboardPaste size={17} /> 복사한 문자 붙여넣기
              </button>
            )}
            <textarea
              value={smsText}
              onChange={(e) => { setSmsText(e.target.value); if (/\d\s*원/.test(e.target.value)) applySms(e.target.value); }}
              rows={2}
              placeholder="여기에 붙여넣어도 돼요"
              className="w-full bg-card border border-line rounded-xl px-3 py-2 text-base text-ink placeholder:text-muted focus:outline-none focus:border-husband"
              aria-label="카드 문자 내용"
            />
          </div>
        )}

        {/* 즐겨찾기 (있을 때만, 한 줄) */}
        {quickChips.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            <Star size={16} className="text-warn shrink-0 self-center" aria-label="즐겨찾기" />
            {quickChips.map((chip) => (
              <button key={chip.id} type="button" onClick={() => applyTemplate(chip, { withAmount: true })} className="shrink-0 h-9 px-3 rounded-full border border-line bg-card text-[13px] font-semibold text-ink2 active:scale-95">
                {chip.content}{chip.amount ? <span className="text-muted font-medium ml-1 num">{formatNumber(chip.amount)}</span> : null}
              </button>
            ))}
          </div>
        )}

        {/* 1. 금액 */}
        <div>
          <div className="flex items-center gap-2">
            <div className="flex bg-fill p-1 rounded-full shrink-0" role="group" aria-label="지출 또는 수입">
              <button type="button" onClick={() => switchType(false)} aria-pressed={!isIncome} className={`h-8 px-3 rounded-full text-[13px] font-bold ${!isIncome ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>지출</button>
              <button type="button" onClick={() => switchType(true)} aria-pressed={isIncome} className={`h-8 px-3 rounded-full text-[13px] font-bold ${isIncome ? 'bg-card text-income shadow-xs' : 'text-muted'}`}>수입</button>
            </div>
            <div className="flex-1 min-w-0 flex items-baseline gap-1 border-b-2 border-line focus-within:border-ink">
              <label htmlFor="exp-amount" className="sr-only">금액</label>
              <input
                ref={amountRef}
                id="exp-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={showAmount(amount)}
                onChange={(e) => typeAmount(e.target.value)}
                onBlur={collapseExpr}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); contentRef.current?.focus(); } }}
                placeholder="0"
                className={`num flex-1 min-w-0 bg-transparent text-right text-[30px] font-extrabold focus:outline-none placeholder:text-line ${isIncome ? 'text-income' : 'text-ink'}`}
              />
              <span className="text-[17px] font-bold text-muted">원</span>
            </div>
          </div>
          {amount && (
            <p className="text-right text-[13px] font-semibold text-husband num mt-1 min-h-[18px]">
              {isExpr ? (amountValue ? `= ${formatNumber(amountValue)}원` : '계산식을 마저 입력하세요') : formatKoreanAmount(amountStr)}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {QUICK_AMOUNTS.map((q) => (
              <button key={q.label} type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => setAmount(String((amountValue || 0) + q.value))} className="shrink-0 h-9 px-3 rounded-full bg-fill text-[13px] font-semibold text-ink2 active:scale-95">
                {q.label}
              </button>
            ))}
            {/* 계산 버튼: 누르는 동안 키보드가 닫히지 않게 */}
            {['+', '−', '×', '÷'].map((op) => (
              <button key={op} type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => { addOp(op === '−' ? '-' : op); amountRef.current?.focus({ preventScroll: true }); }} aria-label={`계산 ${op}`} className="shrink-0 w-9 h-9 rounded-full border border-line text-[16px] font-bold text-ink2 active:scale-95">
                {op}
              </button>
            ))}
            {amountValue > 1 && (
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => setAmount(String(Math.round(amountValue / 2)))} className="shrink-0 h-9 px-3 rounded-full border border-line text-[13px] font-semibold text-ink2 active:scale-95" aria-label="반으로 나누기">
                반반
              </button>
            )}
            {amount && <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => setAmount('')} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold text-muted">지우기</button>}
          </div>
        </div>

        {/* 2. 어디서 / 무엇을 */}
        <div>
          <input
            ref={contentRef}
            id="exp-content"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setTimeout(() => setNameFocused(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            placeholder={isIncome ? '어디서 들어온 돈? (예: 월급)' : '어디서 썼나요? (예: 이마트)'}
            aria-label="어디서 / 무엇을"
            className="w-full h-12 bg-fill rounded-xl px-4 text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband"
          />
          {/* 이름 추천: 눌러야 이름만 바뀜 */}
          {suggestions.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {suggestions.map((m) => (
                <button
                  key={m.id ?? m.content}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setContent(m.content)}
                  className="shrink-0 h-9 px-3 rounded-full border border-line bg-card text-[13px] font-semibold text-ink2 active:scale-95"
                >
                  {m.content}
                </button>
              ))}
            </div>
          )}
          {/* 지난번 설정 제안: 자동으로 바꾸지 않고, 눌러야 적용 */}
          {!nameFocused && past && (hasPastDiff || pastDiff?.amount) && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-fill px-3 py-2">
              <History size={15} className="text-muted shrink-0" />
              <p className="flex-1 min-w-0 text-[13px] text-ink2 truncate">
                지난번: {[pastDiff.category, pastDiff.card?.card_name, pastDiff.joint === null ? null : pastDiff.joint ? '공용' : '개인'].filter(Boolean).join(' · ') || '같은 설정'}
                {pastDiff.amount ? <span className="num"> · {formatNumber(pastDiff.amount)}원</span> : null}
              </p>
              {hasPastDiff && <button type="button" onClick={applyPast} className="shrink-0 h-8 px-3 rounded-lg bg-card border border-line text-[13px] font-bold text-ink">적용</button>}
              {pastDiff.amount && <button type="button" onClick={() => setAmount(String(pastDiff.amount))} className="shrink-0 h-8 px-3 rounded-lg bg-card border border-line text-[13px] font-bold text-ink">금액</button>}
            </div>
          )}
          {lastAmountHint && !past && String(lastAmountHint) !== amountStr && (
            <button type="button" onClick={() => setAmount(String(lastAmountHint))} className="mt-2 text-[13px] font-semibold text-muted underline underline-offset-2">지난번 {formatNumber(lastAmountHint)}원 넣기</button>
          )}
        </div>

        {/* 3. 카테고리 (한 줄, 옆으로 넘기기) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5" role="group" aria-label="카테고리">
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setCategory(cat); categoryTouched.current = true; setAutoCat(null); }}
              aria-pressed={category === cat}
              className={`shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold border transition ${category === cat ? 'bg-ink text-card border-ink' : 'bg-card text-ink2 border-line'}`}
            >
              {cat}
              {autoCat === cat && category === cat && <span className="ml-1 text-[11px] font-bold opacity-70">자동</span>}
            </button>
          ))}
        </div>

        {/* 4. 날짜 · 결제자 · 카드 · 공용 */}
        <div className="flex gap-1.5 flex-wrap">
          <button type="button" onClick={() => setDateOpen((v) => !v)} aria-expanded={dateOpen} className={`${pill} ${dateOpen ? 'ring-2 ring-ink' : ''}`}>
            <CalendarDays size={15} className="text-muted" />
            {shortDate(date)}
          </button>
          <button type="button" onClick={togglePayer} className={pill} aria-label={`${isIncome ? '받은 사람' : '결제자'}: ${nameOf(payer)}. 누르면 바뀝니다`}>
            <User size={15} className={payer === 'husband' ? 'text-husband' : 'text-wife'} />
            {nameOf(payer)}
          </button>
          {!isIncome && (
            <>
              <label className={pill}>
                <CreditCard size={15} className="text-muted" />
                <span className="max-w-[110px] truncate">{selectedCard ? selectedCard.card_name : '현금/기타'}</span>
                <ChevronDown size={14} className="text-muted" />
                <select value={cardId} onChange={(e) => selectCard(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full text-base cursor-pointer" aria-label="결제 카드 선택">
                  <option value="">현금 / 기타</option>
                  {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.card_name} ({nameOf(c.owner)})</option>)}
                  {selectedCard && !selectedCard.is_active && <option value={String(selectedCard.id)}>{selectedCard.card_name} (숨긴 카드)</option>}
                </select>
              </label>
              <button type="button" onClick={() => setIsJoint((v) => !v)} aria-pressed={isJoint} className={`${pill} ${isJoint ? '!bg-joint-soft !text-joint' : ''}`}>
                <Users size={15} />
                {isJoint ? '공용' : '개인'}
              </button>
            </>
          )}
        </div>
        {/* 날짜 빠른 선택: 오늘 / 어제 / 그제 / 달력 */}
        {dateOpen && (
          <div className="flex gap-1.5 flex-wrap animate-fade-in" role="group" aria-label="날짜 빠른 선택">
            {[0, 1, 2, 3].map((n) => {
              const d = new Date(); d.setDate(d.getDate() - n);
              const v = toYmd(d);
              return (
                <button key={n} type="button" onClick={() => { setDate(v); setDateOpen(false); }} aria-pressed={date === v} className={`h-10 px-3.5 rounded-full text-[13px] font-semibold border ${date === v ? 'bg-ink text-card border-ink' : 'bg-card text-ink2 border-line'}`}>
                  {['오늘', '어제', '그제', '3일 전'][n]}
                </button>
              );
            })}
            <label className="relative h-10 px-3.5 rounded-full text-[13px] font-semibold border border-line bg-card text-ink2 flex items-center gap-1.5 cursor-pointer">
              <CalendarDays size={15} /> 달력에서 고르기
              <input
                type="date"
                value={date}
                onChange={(e) => { if (e.target.value) { setDate(e.target.value); setDateOpen(false); } }}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* 무시 */ } }}
                className="absolute inset-0 opacity-0 w-full h-full text-base cursor-pointer"
                aria-label="달력에서 날짜 고르기"
              />
            </label>
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
