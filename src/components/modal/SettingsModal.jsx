import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../common/Toast';
import { formatNumber, formatKoreanAmount, onlyDigits } from '../../lib/format';

const CARD_TYPES = [
  { id: 'CREDIT', label: '신용카드' },
  { id: 'DEBIT', label: '체크카드' },
  { id: 'ACCOUNT', label: '계좌이체' },
];

export default function SettingsModal({
  isOpen, onClose, cards = [], budgetLimit, nicknames, bgImageUrl,
  currentUserRole, onRoleChange,
  onAddCard, onHideCard, onUpdateBudget, onUpdateNicknames, onUploadBackground, onResetBackground,
  favorites = [], favoritesAvailable, onRemoveFavorite,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [inputBudget, setInputBudget] = useState(String(budgetLimit));
  const [newCardName, setNewCardName] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('husband');
  const [newCardType, setNewCardType] = useState('CREDIT');
  const [hName, setHName] = useState(nicknames.husband);
  const [wName, setWName] = useState(nicknames.wife);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setInputBudget(String(budgetLimit));
    setHName(nicknames.husband);
    setWName(nicknames.wife);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
    // 열릴 때만 현재 값으로 채움
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    const res = await fn();
    setBusy('');
    if (res?.ok) { if (successMsg) toast(successMsg, 'success'); return true; }
    if (res) toast(res.error || '저장하지 못했어요.', 'error');
    return false;
  };

  const handleBudgetSubmit = (e) => {
    e.preventDefault();
    const num = Number(inputBudget);
    if (!num || num <= 0) { toast('예산 금액을 입력해주세요.', 'error'); return; }
    run('budget', () => onUpdateBudget(num), `월 예산을 ${formatNumber(num)}원으로 바꿨어요.`);
  };

  const handleNicknameSubmit = (e) => {
    e.preventDefault();
    if (!hName.trim() || !wName.trim()) { toast('두 사람의 별명을 모두 입력해주세요.', 'error'); return; }
    run('nick', () => onUpdateNicknames(hName, wName), '별명을 저장했어요.');
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    if (!newCardName.trim()) { toast('카드 이름을 입력해주세요.', 'error'); return; }
    const ok = await run('card', () => onAddCard(newCardName.trim(), newCardOwner, newCardType), `'${newCardName.trim()}'을(를) 등록했어요.`);
    if (ok) setNewCardName('');
  };

  const handleHideCard = (card) => {
    if (!window.confirm(`'${card.card_name}'을(를) 목록에서 숨길까요?\n지난 내역과 정산 기록은 그대로 남아요.`)) return;
    run(`hide-${card.id}`, () => onHideCard(card.id), '카드를 숨겼어요.');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await run('bg', () => onUploadBackground(file), '배경 사진을 바꿨어요.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetBg = () => {
    if (!window.confirm('기본 배경으로 되돌릴까요?')) return;
    run('bg', onResetBackground, '기본 배경으로 되돌렸어요.');
  };

  const ownerLabel = (o) => (o === 'husband' ? nicknames.husband : o === 'wife' ? nicknames.wife : '공용');
  const section = 'bg-slate-50 p-4 rounded-2xl border border-slate-200/80';
  const title = 'text-[13px] font-black text-slate-800 mb-2';
  const input = 'w-full bg-white px-3 py-2 text-base font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600';
  const seg = (active, color) => `flex-1 py-1.5 text-xs font-black rounded-lg transition ${active ? `${color} text-white` : 'text-slate-500'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="설정">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-800">⚙️ 가계부 설정</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 text-lg font-black text-slate-400" aria-label="닫기">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar pb-safe">
          <section className={section}>
            <h3 className={title}>📱 이 휴대폰은 누구 건가요?</h3>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
              <button type="button" onClick={() => onRoleChange('husband')} className={seg(currentUserRole === 'husband', 'bg-blue-600')}>{nicknames.husband}</button>
              <button type="button" onClick={() => onRoleChange('wife')} className={seg(currentUserRole === 'wife', 'bg-rose-600')}>{nicknames.wife}</button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">새 내역의 결제자와 카드 기본값에 쓰여요.</p>
          </section>

          <section className={section}>
            <h3 className={title}>💳 결제 수단 등록</h3>
            <form onSubmit={handleCardSubmit} className="space-y-2">
              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                <button type="button" onClick={() => setNewCardOwner('husband')} className={seg(newCardOwner === 'husband', 'bg-blue-600')}>{nicknames.husband}</button>
                <button type="button" onClick={() => setNewCardOwner('wife')} className={seg(newCardOwner === 'wife', 'bg-rose-600')}>{nicknames.wife}</button>
                <button type="button" onClick={() => setNewCardOwner('joint')} className={seg(newCardOwner === 'joint', 'bg-purple-600')}>공용</button>
              </div>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                {CARD_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setNewCardType(t.id)} className={seg(newCardType === t.id, 'bg-slate-800')}>{t.label}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} placeholder="예: 신한 딥드림" className={input} />
                <button type="submit" disabled={busy === 'card'} className="bg-slate-800 text-white px-4 rounded-xl text-xs font-black shrink-0 disabled:opacity-60">등록</button>
              </div>
              <p className="text-xs text-slate-500">카드사 이름(신한, KB, 현대 등)을 넣으면 카드 문자로 입력할 때 자동으로 선택돼요.</p>
            </form>
          </section>

          <section>
            <h3 className={`${title} px-1`}>📋 사용 중인 결제 수단 ({cards.length}개)</h3>
            <div className="space-y-1.5">
              {cards.map((card) => (
                <div key={card.id} className="bg-white p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md text-white shrink-0 ${card.owner === 'husband' ? 'bg-blue-600' : card.owner === 'wife' ? 'bg-rose-600' : 'bg-purple-600'}`}>{ownerLabel(card.owner)}</span>
                    <span className="text-[13px] font-bold text-slate-800 truncate">{card.card_name}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{CARD_TYPES.find((t) => t.id === card.card_type)?.label || ''}</span>
                  </div>
                  <button type="button" onClick={() => handleHideCard(card)} className="text-xs text-slate-600 font-bold px-2.5 py-1 bg-slate-100 rounded-lg shrink-0">숨기기</button>
                </div>
              ))}
            </div>
          </section>

          <section className={section}>
            <h3 className={title}>⭐ 즐겨찾기</h3>
            {!favoritesAvailable ? (
              <p className="text-xs text-slate-600">즐겨찾기를 쓰려면 Supabase에서 migration_v2.sql을 실행해주세요.</p>
            ) : favorites.length === 0 ? (
              <p className="text-xs text-slate-500">내역 입력 화면에서 ⭐ 버튼을 누르면 여기에 추가돼요.</p>
            ) : (
              <div className="space-y-1.5">
                {favorites.map((f) => (
                  <div key={f.id} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-800 truncate">
                      {f.content}<span className="text-slate-500 font-medium ml-1.5 text-xs">{f.category}{f.amount ? ` · ${formatNumber(f.amount)}원` : ''}</span>
                    </span>
                    <button type="button" onClick={() => run(`fav-${f.id}`, () => onRemoveFavorite(f.id), '즐겨찾기에서 뺐어요.')} className="text-xs font-bold text-rose-500 shrink-0 px-2 py-1">빼기</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={section}>
            <h3 className={title}>🎯 월 지출 예산</h3>
            <form onSubmit={handleBudgetSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input type="text" inputMode="numeric" value={inputBudget ? formatNumber(inputBudget) : ''} onChange={(e) => setInputBudget(onlyDigits(e.target.value).slice(0, 12))} className={`${input} pr-8`} aria-label="월 예산" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">원</span>
              </div>
              <button type="submit" disabled={busy === 'budget'} className="bg-blue-600 text-white px-4 rounded-xl text-xs font-black shrink-0 disabled:opacity-60">저장</button>
            </form>
            <p className="text-xs text-indigo-600 font-bold mt-1.5">{formatKoreanAmount(inputBudget)}</p>
            <p className="text-xs text-slate-500 mt-0.5">개인 지출을 포함한 한 달 전체 지출 기준이에요. 80%와 100%를 넘으면 알려드려요.</p>
          </section>

          <section className={section}>
            <h3 className={title}>✨ 별명</h3>
            <form onSubmit={handleNicknameSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={hName} onChange={(e) => setHName(e.target.value)} placeholder="남편 별명" className={input} aria-label="남편 별명" />
                <input type="text" value={wName} onChange={(e) => setWName(e.target.value)} placeholder="아내 별명" className={input} aria-label="아내 별명" />
              </div>
              <button type="submit" disabled={busy === 'nick'} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-black disabled:opacity-60">별명 저장</button>
            </form>
          </section>

          <section className={section}>
            <h3 className={title}>🖼️ 홈 배경 사진</h3>
            <div className="w-full h-20 rounded-xl overflow-hidden border border-slate-200 mb-2">
              <img src={bgImageUrl} alt="현재 배경" className="w-full h-full object-cover" />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <div className="flex gap-2">
              <button type="button" disabled={busy === 'bg'} onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 text-white py-2 rounded-xl text-xs font-black disabled:opacity-60">{busy === 'bg' ? '업로드 중…' : '사진 바꾸기'}</button>
              <button type="button" disabled={busy === 'bg'} onClick={handleResetBg} className="px-3 bg-white border border-slate-300 text-slate-600 py-2 rounded-xl text-xs font-bold">기본으로</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
