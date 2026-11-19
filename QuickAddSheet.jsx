import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Mic, Square, X } from 'lucide-react';
import Sheet from '../common/Sheet';
import { useToast } from '../common/Toast';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../constants/categories';
import { enrichItem, parseQuickText } from '../../lib/quickParse';
import { formatDateLabel, formatNumber, toYmd } from '../../lib/format';
import { haptic } from '../../lib/haptic';

const EXAMPLES = ['이마트 5만 2천', '어제 스타벅스 4500원', '다이소 만2천 주유 7만'];

// 한 줄(또는 말)로 입력 → 여러 건 미리보기 → 한 번에 저장
export default function QuickAddSheet({
  isOpen, onClose, text, setText, speech, onMic, onSave, onOpenDetail,
  merchants, cards, cardMap, role, nicknames, focusOnOpen,
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

  const lastCardId = useMemo(() => {
    try { return localStorage.getItem('buboo_last_card'); } catch { return null; }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => {
    const { items, errors } = parseQuickText(text);
    const ctx = { merchants, cards, cardMap, role, lastCardId };
    return {
      errors,
      items: items
        .map((it, i) => {
          const key = `${i}|${it.merchant}|${it.amount}`;
          return { ...enrichItem(it, ctx), ...overrides[key], key };
        })
        .filter((it) => !it.removed),
    };
  }, [text, merchants, cards, cardMap, role, lastCardId, overrides]);

  const patch = (key, p) => setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
  const today = toYmd(new Date());
  const total = parsed.items.reduce((a, it) => a + (it.income ? 0 : it.amount), 0);

  const close = () => { speech.stop(); onClose(); };

  const save = async () => {
    if (!parsed.items.length || saving) return;
    setSaving(true);
    let done = 0;
    for (const it of parsed.items) {
      // eslint-disable-next-line no-await-in-loop
      const res = await onSave({
        expense_date: it.date,
        is_income: it.income,
        amount: it.amount,
        category: it.category,
        content: it.merchant,
        payer: role,
        card_id: it.income ? null : it.cardId,
        is_joint_expense: it.income ? false : it.joint,
      });
      if (!res?.ok) {
        toast(`${done}건 저장 후 멈췄어요: ${res?.error || '네트워크 오류'}`, 'error', { duration: 6000 });
        setSaving(false);
        return;
      }
      done += 1;
    }
    setSaving(false);
    haptic();
    const first = parsed.items[0];
    toast(done === 1 ? `${first.merchant} ${formatNumber(first.amount)}원 저장했어요.` : `${done}건 저장했어요.`, 'success');
    setText('');
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={close}
      title="빠른 입력"
      zIndex={56}
      footer={(
        <div className="flex gap-2">
          <button type="button" onClick={() => { speech.stop(); onOpenDetail(); }} className="h-[52px] px-4 rounded-2xl border border-line text-ink2 text-[15px] font-bold shrink-0">
            자세히 입력
          </button>
          <button type="button" disabled={!parsed.items.length || saving} onClick={save} className="flex-1 h-[52px] rounded-2xl bg-ink text-card text-[16px] font-bold disabled:opacity-40 active:scale-[0.98]">
            {saving ? '저장 중…' : parsed.items.length > 1 ? `${parsed.items.length}건 저장` : '저장'}
          </button>
        </div>
      )}
    >
      <div className="px-5 pb-5 space-y-4">
        <div className="flex gap-2 items-start">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            enterKeyHint="done"
            placeholder="이마트 5만 2천, 스타벅스 4500"
            aria-label="어디서 얼마 썼는지 입력"
            className="flex-1 min-w-0 bg-fill rounded-2xl px-4 py-3 text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband resize-none"
          />
          <button
            type="button"
            onClick={speech.listening ? speech.stop : onMic}
            aria-label={speech.listening ? '듣기 멈추기' : '말로 입력'}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition ${speech.listening ? 'bg-danger text-white' : 'bg-ink text-card'}`}
          >
            {speech.listening ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
          </button>
        </div>

        {speech.listening && (
          <div className="rounded-2xl bg-fill px-4 py-3 flex items-center gap-3 animate-fade-in" aria-live="polite">
            <span className="relative flex w-3 h-3 shrink-0">
              <span className="absolute inline-flex w-full h-full rounded-full bg-danger opacity-60 animate-ping" />
              <span className="relative inline-flex w-3 h-3 rounded-full bg-danger" />
            </span>
            <p className="text-[15px] text-ink2 flex-1">{speech.interim || '듣고 있어요… "이마트 5만 2천"처럼 말해보세요'}</p>
          </div>
        )}

        {!text.trim() && !speech.listening && (
          <div>
            <p className="text-[13px] text-muted mb-2">이렇게 입력하거나 말하면 돼요. 여러 건도 한 번에 돼요.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setText(ex)} className="h-9 px-3 rounded-full border border-line text-[14px] text-ink2">{ex}</button>
              ))}
            </div>
            <p className="text-[13px] text-muted mt-3 leading-relaxed">
              앞에 "어제", "그제"를 붙이면 날짜가 바뀌어요. "개인"을 붙이면 개인 지출, "수입"을 붙이면 수입으로 들어가요.
            </p>
          </div>
        )}

        {parsed.items.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted px-1 num">
              {parsed.items.length}건 · 지출 {formatNumber(total)}원 · {nicknames[role] || ''}님이 결제
            </p>
            {parsed.items.map((it) => {
              const cats = it.income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
              return (
                <div key={it.key} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted truncate">
                        {it.date === today ? '오늘' : formatDateLabel(it.date)}
                        {it.income ? ' · 수입' : ` · ${it.cardName || '현금/기타'}`}
                      </p>
                      <p className="text-[16px] font-bold text-ink truncate">{it.merchant}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`num text-[17px] font-extrabold ${it.income ? 'text-income' : 'text-ink'}`}>{it.income ? '+' : '-'}{formatNumber(it.amount)}</span>
                      <button type="button" onClick={() => patch(it.key, { removed: true })} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-muted" aria-label={`${it.merchant} 빼기`}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <label className="relative h-9 pl-3 pr-2 rounded-full bg-fill text-[13px] font-semibold text-ink2 flex items-center gap-1">
                      {it.category}{!it.known && <span className="text-warn">(추정)</span>}
                      <ChevronDown size={14} className="text-muted" />
                      <select value={it.category} onChange={(e) => patch(it.key, { category: e.target.value, known: true })} className="absolute inset-0 opacity-0 text-base" aria-label={`${it.merchant} 카테고리`}>
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    {!it.income && (
                      <button type="button" onClick={() => patch(it.key, { joint: !it.joint })} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${it.joint ? 'bg-joint-soft text-joint' : 'bg-fill text-ink2'}`}>
                        {it.joint ? '공용 생활비' : '개인 지출'}
                      </button>
                    )}
                  </div>
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
