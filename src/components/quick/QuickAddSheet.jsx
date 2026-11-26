import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, CreditCard, Mic, Square, Undo2, X } from 'lucide-react';
import Sheet from '../common/Sheet';
import { useToast } from '../common/Toast';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../constants/categories';
import { enrichItem, parseQuickText } from '../../lib/quickParse';
import { formatDateLabel, formatNumber, onlyDigits, toYmd } from '../../lib/format';
import { haptic } from '../../lib/haptic';

const LAST_CARD_KEY = 'buboo_last_card';

// 한 줄(또는 말)로 입력 → 항목별로 바로 고치기 → 한 번에 저장
export default function QuickAddSheet({
  isOpen, onClose, text, setText, speech, speechHelp, onDismissSpeechHelp, onMic, onSave, onUndo, onEditSaved, onOpenDetail,
  merchants, cards, cardMap, role, nicknames, focusOnOpen, micPrompt,
}) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setOverrides({});
    if (focusOnOpen) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 280);
  }, [isOpen, focusOnOpen]);

  // 입력창 높이를 내용에 맞게
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, isOpen]);

  const lastCardId = useMemo(() => {
    try { return localStorage.getItem(LAST_CARD_KEY); } catch { return null; }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 안내 예시에 우리 집 실제 카드 이름 사용 ("내 우리카드", "와이프 삼성카드")
  const cardExample = useMemo(() => {
    const active = (cards || []).filter((c) => c.is_active !== false);
    const other = role === 'wife' ? 'husband' : 'wife';
    const otherWord = other === 'wife' ? '와이프' : '남편';
    const mineCard = active.find((c) => c.owner === role)?.card_name || '우리카드';
    const otherCard = active.find((c) => c.owner === other)?.card_name || '삼성카드';
    return { mine: `내 ${mineCard}`, other: `${otherWord} ${otherCard}` };
  }, [cards, role]);

  // 이름이 같은 카드(둘 다 '삼성카드')는 "삼성카드 · 파덕"처럼 주인을 붙여 구분
  const dupNames = useMemo(() => {
    const count = new Map();
    (cards || []).forEach((c) => count.set(c.card_name, (count.get(c.card_name) || 0) + 1));
    return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
  }, [cards]);
  const cardLabel = (id, name) => {
    if (!dupNames.has(name)) return name;
    const c = cardMap?.get(String(id));
    return c ? `${name} · ${c.owner === 'joint' ? '공용' : (c.owner === 'wife' ? (nicknames?.wife || '아내') : (nicknames?.husband || '남편'))}` : name;
  };

  const parsed = useMemo(() => {
    const { items, errors } = parseQuickText(text, new Date(), { cards, merchants, nicknames });
    const ctx = { merchants, cards, cardMap, role, lastCardId };
    return {
      errors,
      items: items
        .map((it, i) => {
          const key = `${i}|${it.merchant}|${it.amount}`;
          const base = enrichItem(it, ctx);
          const o = overrides[key] || {};
          const merged = { ...base, ...o, key };
          if (o.cardId !== undefined) {
            const c = o.cardId == null ? null : cardMap?.get(String(o.cardId));
            merged.cardName = c ? c.card_name : null;
            merged.payer = c && (c.owner === 'husband' || c.owner === 'wife') ? c.owner : role;
          }
          return merged;
        })
        .filter((it) => !it.removed),
    };
  }, [text, merchants, cards, cardMap, role, lastCardId, overrides]);

  // 자주 쓴 곳 (지출, 많이 쓴 순) → 누르면 "스타벅스 4500" 이 입력창에 추가
  const frequent = useMemo(
    () => merchants.filter((m) => !m.is_income).slice(0, 8),
    [merchants],
  );

  const patch = (key, p) => setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
  const appendText = (t) => setText((prev) => (prev.trim() ? `${prev.trim()}, ${t}` : t));
  const today = toYmd(new Date());
  const total = parsed.items.reduce((a, it) => a + (it.income ? 0 : it.amount), 0);
  const nameOf = (r) => nicknames?.[r] || '';

  const close = () => { speech.cancel(); onClose(); };

  const save = async () => {
    if (!parsed.items.length || saving) return;
    const bad = parsed.items.find((it) => !it.amount || !String(it.merchant).trim());
    if (bad) { toast('사용처와 금액을 확인해주세요.', 'error'); return; }
    setSaving(true);
    const savedIds = [];
    const savedRows = [];
    for (const it of parsed.items) {
      // eslint-disable-next-line no-await-in-loop
      const res = await onSave({
        expense_date: it.date,
        is_income: it.income,
        amount: it.amount,
        category: it.category,
        content: String(it.merchant).trim(),
        payer: it.payer || role,
        card_id: it.income ? null : it.cardId,
        is_joint_expense: it.income ? false : it.joint,
      });
      if (!res?.ok) {
        toast(`${savedIds.length}건 저장 후 멈췄어요: ${res?.error || '네트워크 오류'}`, 'error', { duration: 6000 });
        setSaving(false);
        return;
      }
      if (res.data?.id != null) { savedIds.push(res.data.id); savedRows.push(res.data); }
    }
    setSaving(false);
    haptic();
    const lastCard = [...parsed.items].reverse().find((it) => !it.income && it.cardId != null);
    if (lastCard) { try { localStorage.setItem(LAST_CARD_KEY, String(lastCard.cardId)); } catch { /* 무시 */ } }
    const first = parsed.items[0];
    toast(
      savedIds.length === 1 ? `${first.merchant} ${formatNumber(first.amount)}원 저장했어요.` : `${savedIds.length}건 저장했어요.`,
      'success',
      {
        duration: 6000,
        actions: savedIds.length ? [
          { label: '수정', onClick: () => onEditSaved(savedRows) },
          { label: '되돌리기', onClick: () => onUndo(savedIds) },
        ] : [],
      },
    );
    setText('');
    onClose();
  };

  const chip = 'relative h-9 pl-3 pr-2 rounded-full bg-fill text-[13px] font-semibold text-ink2 flex items-center gap-1 max-w-full';

  return (
    <Sheet
      isOpen={isOpen}
      onClose={close}
      title="빠른 입력"
      zIndex={56}
      footer={(
        <div className="flex gap-2">
          <button type="button" onClick={() => { speech.cancel(); onOpenDetail(); }} className="h-[52px] px-4 rounded-2xl border border-line text-ink2 text-[15px] font-bold shrink-0">
            자세히 입력
          </button>
          <button type="button" disabled={!parsed.items.length || saving || speech.listening} onClick={save} className="flex-1 h-[52px] rounded-2xl bg-ink text-card text-[16px] font-bold disabled:opacity-40 active:scale-[0.98]">
            {saving ? '저장 중…' : parsed.items.length > 1 ? `${parsed.items.length}건 저장 · ${formatNumber(total)}원` : '저장'}
          </button>
        </div>
      )}
    >
      <div className="px-5 pb-5 space-y-4">
        {/* 입력창 + 마이크 */}
        <div className="flex gap-2 items-start">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
            placeholder="이마트 5만 2천, 스타벅스 4500"
            aria-label="어디서 얼마 썼는지 입력"
            className="flex-1 min-w-0 min-h-[56px] bg-fill rounded-2xl px-4 py-[15px] text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband resize-none leading-snug"
          />
          {text && !speech.listening && (
            <button type="button" onClick={() => { setText(''); setOverrides({}); inputRef.current?.focus(); }} className="w-11 h-14 -ml-1 flex items-center justify-center text-muted shrink-0" aria-label="입력 지우기">
              <X size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={speech.listening ? speech.stop : onMic}
            aria-label={speech.listening ? '말하기 끝' : '말로 입력'}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition ${speech.listening ? 'bg-danger text-white' : 'bg-ink text-card'}`}
          >
            {speech.listening ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
          </button>
        </div>

        {/* 바로가기 "말로 입력"으로 열었을 때: 큰 마이크 버튼 */}
        {micPrompt && !text.trim() && !speech.listening && !speechHelp && (
          <button type="button" onClick={onMic} className="w-full rounded-3xl bg-ink text-card py-7 flex flex-col items-center gap-2 active:scale-[0.99]">
            <Mic size={40} />
            <span className="text-[17px] font-bold">눌러서 말하기</span>
            <span className="text-[13px] opacity-70">"이마트 5만 2천"처럼 말해보세요</span>
          </button>
        )}

        {/* 음성 인식이 안 될 때: 버튼을 눌러야 아이폰 키보드가 열리므로 버튼으로 안내 */}
        {speechHelp && !speech.listening && (
          <div className="rounded-2xl bg-warn-soft p-4 animate-fade-in" role="alert">
            <p className="text-[14px] text-ink2 leading-relaxed">{speechHelp}</p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => { onDismissSpeechHelp(); inputRef.current?.focus(); }}
                className="flex-1 h-11 rounded-xl bg-ink text-card text-[14px] font-bold flex items-center justify-center gap-1.5"
              >
                <Mic size={16} /> 키보드 받아쓰기로 말하기
              </button>
              {speech.supported && (
                <button type="button" onClick={onMic} className="h-11 px-4 rounded-xl bg-card border border-line text-[14px] font-semibold text-ink2">다시 듣기</button>
              )}
            </div>
            <p className="text-[12px] text-muted mt-2">키보드가 열리면 오른쪽 아래(또는 스페이스 옆) 🎤를 누르고 말하면 돼요.</p>
          </div>
        )}

        {/* 듣는 중 */}
        {speech.listening && (
          <div className="rounded-2xl bg-fill p-4 animate-fade-in" aria-live="polite">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex w-3 h-3 shrink-0">
                <span className="absolute inline-flex w-full h-full rounded-full bg-danger opacity-60 animate-ping" />
                <span className="relative inline-flex w-3 h-3 rounded-full bg-danger" />
              </span>
              <span className="text-[13px] font-semibold text-danger">듣고 있어요 · 말을 멈추면 자동으로 끝나요</span>
            </div>
            <p className={`text-[18px] font-bold leading-snug ${speech.interim ? 'text-ink' : 'text-muted'}`}>
              {speech.interim || '"이마트 5만 2천, 스타벅스 4500"'}
            </p>
            <button type="button" onClick={speech.stop} className="mt-3 h-10 px-4 rounded-xl bg-card border border-line text-[14px] font-bold text-ink">다 말했어요</button>
          </div>
        )}

        {/* 비어 있을 때: 자주 쓴 곳 + 사용법 */}
        {!text.trim() && !speech.listening && (
          <div className="space-y-4">
            {frequent.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-muted mb-2">자주 쓴 곳 · 누르면 지난번 금액으로 추가돼요</p>
                <div className="flex flex-wrap gap-2">
                  {frequent.map((m) => (
                    <button key={m.content} type="button" onClick={() => appendText(m.amount ? `${m.content} ${Math.round(m.amount)}` : `${m.content} `)} className="h-10 px-3.5 rounded-full border border-line bg-card text-[14px] font-semibold text-ink2 active:scale-95">
                      {m.content}{m.amount ? <span className="text-muted font-medium ml-1 num">{formatNumber(m.amount)}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-fill p-4 text-[14px] text-ink2 leading-relaxed">
              <p className="font-bold text-ink mb-1">이렇게 쓰거나 말해보세요</p>
              <p>· <strong>이마트 5만 2천</strong> · 여러 건은 쉼표나 그냥 이어서</p>
              <p>· 날짜: <strong>어제</strong>, <strong>3일 전</strong>, <strong>금요일</strong>, <strong>지난주 금요일</strong>, <strong>11월 3일</strong></p>
              <p>· 계산·수량: <strong>치킨 48000/2</strong>, <strong>커피 4500 2잔</strong>, <strong>12000+3500</strong></p>
              <p>· 카드: <strong>{cardExample.mine}</strong>, <strong>{cardExample.other}</strong>, <strong>와이프카드</strong>, <strong>남편꺼</strong> · <strong>현금</strong>, <strong>계좌이체</strong></p>
              <p>· 누가: <strong>와이프가</strong>, <strong>{nicknames?.husband || '남편'}</strong> · 분류: <strong>이마트 5만 장보기</strong>, <strong>#식비</strong></p>
              <p>· <strong>개인</strong> → 개인 지출, <strong>수입</strong>·<strong>입금</strong> → 수입, <strong>환불</strong> → 돌려받은 돈</p>
              {speech.isIOS && <p className="mt-1 text-muted">· 아이폰은 키보드의 🎤(받아쓰기)로 말해도 똑같이 돼요.</p>}
            </div>
          </div>
        )}

        {/* 미리보기: 항목마다 바로 고치기 */}
        {parsed.items.length > 0 && !speech.listening && (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted px-1 num">{parsed.items.length}건 · 눌러서 바로 고칠 수 있어요</p>
            {parsed.items.map((it) => {
              const cats = it.income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
              return (
                <div key={it.key} className="rounded-2xl border border-line bg-card px-3.5 pt-2.5 pb-3">
                  <div className="flex items-center gap-1">
                    <input
                      value={it.merchant}
                      onChange={(e) => patch(it.key, { merchant: e.target.value, corrected: false })}
                      aria-label="사용처"
                      className="flex-1 min-w-0 h-10 bg-transparent text-[17px] font-bold text-ink rounded-lg px-1 -mx-1 focus:outline-none focus:bg-fill"
                    />
                    <label className={`flex items-center h-10 rounded-lg px-1 focus-within:bg-fill shrink-0 ${it.income ? 'text-income' : 'text-ink'}`}>
                      <span className="text-[17px] font-extrabold">{it.income ? '+' : '-'}</span>
                      <input
                        value={formatNumber(it.amount)}
                        onChange={(e) => patch(it.key, { amount: Number(onlyDigits(e.target.value).slice(0, 12)) || 0 })}
                        inputMode="numeric"
                        aria-label="금액"
                        style={{ width: `${Math.max(formatNumber(it.amount).length, 1) * 0.92 + 0.4}ch` }}
                        className="num bg-transparent text-left text-[17px] font-extrabold focus:outline-none"
                      />
                    </label>
                    <button type="button" onClick={() => patch(it.key, { removed: true })} className="w-9 h-10 -mr-1.5 flex items-center justify-center text-muted shrink-0" aria-label={`${it.merchant} 빼기`}>
                      <X size={18} />
                    </button>
                  </div>

                  {(it.qty || it.refund) && (
                    <p className="text-[12px] text-muted mb-1">{it.qty ? `${it.qty}개 계산해서 넣었어요` : ''}{it.qty && it.refund ? ' · ' : ''}{it.refund ? '환불이라 수입으로 넣어요' : ''}</p>
                  )}
                  {it.corrected && (
                    <button type="button" onClick={() => patch(it.key, { merchant: it.originalMerchant, corrected: false, known: false })} className="flex items-center gap-1 text-[12px] text-muted mb-1">
                      <Undo2 size={12} /> '{it.originalMerchant}'을(를) 지난 기록에 맞춰 고쳤어요 · 원래대로
                    </button>
                  )}

                  <div className="flex gap-1.5 flex-wrap mt-1">
                    <label className={chip}>
                      <CalendarDays size={14} className="text-muted shrink-0" />
                      {it.date === today ? '오늘' : formatDateLabel(it.date)}
                      <input type="date" value={it.date} onChange={(e) => e.target.value && patch(it.key, { date: e.target.value })} className="absolute inset-0 opacity-0 text-base" aria-label="날짜" />
                    </label>
                    {!it.income && (
                      <label className={`${chip} ${it.cardSaid ? 'ring-1 ring-husband/50' : ''}`}>
                        <CreditCard size={14} className="text-muted shrink-0" />
                        <span className="truncate max-w-[140px]">{it.cardName ? cardLabel(it.cardId, it.cardName) : '현금/기타'}</span>
                        <ChevronDown size={14} className="text-muted shrink-0" />
                        <select value={it.cardId ?? ''} onChange={(e) => patch(it.key, { cardId: e.target.value === '' ? null : e.target.value })} className="absolute inset-0 opacity-0 text-base" aria-label="카드">
                          <option value="">현금 / 기타</option>
                          {cards.map((c) => <option key={c.id} value={String(c.id)}>{c.card_name} ({c.owner === 'joint' ? '공용' : nameOf(c.owner)})</option>)}
                        </select>
                      </label>
                    )}
                    <label className={chip}>
                      {it.category}{!it.known && <span className="text-warn">·추정</span>}
                      <ChevronDown size={14} className="text-muted shrink-0" />
                      <select value={it.category} onChange={(e) => patch(it.key, { category: e.target.value, known: true })} className="absolute inset-0 opacity-0 text-base" aria-label="카테고리">
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    {!it.income && (
                      <button type="button" onClick={() => patch(it.key, { joint: !it.joint })} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${it.joint ? 'bg-joint-soft text-joint' : 'bg-fill text-ink2'}`}>
                        {it.joint ? '공용' : '개인'}
                      </button>
                    )}
                  </div>
                  {!it.income && it.payer !== role && (
                    <p className="text-[12px] text-muted mt-1.5">{nameOf(it.payer)}님 카드라서 {nameOf(it.payer)}님 결제로 저장돼요.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {parsed.errors.length > 0 && text.trim() && !speech.listening && (
          <ul className="space-y-1">
            {parsed.errors.map((e) => <li key={e} className="text-[13px] font-semibold text-danger px-1">{e}</li>)}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
