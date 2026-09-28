import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import Sheet from '../common/Sheet';
import SiriSetup from './SiriSetup';
import NotificationSettings from './NotificationSettings';
import { useToast } from '../common/Toast';
import { formatKoreanAmount, formatNumber, onlyDigits } from '../../lib/format';

const CARD_TYPES = [
  { id: 'CREDIT', label: '신용카드' },
  { id: 'DEBIT', label: '체크카드' },
  { id: 'ACCOUNT', label: '계좌이체' },
];
const TABS = [
  { id: 'us', label: '우리' },
  { id: 'cards', label: '카드' },
  { id: 'budget', label: '예산' },
  { id: 'push', label: '알림' },
  { id: 'app', label: '앱' },
];
const THEMES = [
  { id: 'system', label: '기기 설정', Icon: Monitor },
  { id: 'light', label: '밝게', Icon: Sun },
  { id: 'dark', label: '어둡게', Icon: Moon },
];

export default function SettingsModal({
  isOpen, onClose, cards = [], budgetLimit, nicknames, bgImageUrl,
  currentUserRole, onRoleChange, theme, onThemeChange,
  onAddCard, onHideCard, onUpdateBudget, onUpdateNicknames, onUploadBackground, onResetBackground,
  favorites = [], favoritesAvailable, onRemoveFavorite,
  push, onSaveVapidKey, onRefreshSettings, initialTab,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('us');
  const [inputBudget, setInputBudget] = useState(String(budgetLimit));
  const [newCardName, setNewCardName] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('husband');
  const [newCardType, setNewCardType] = useState('CREDIT');
  const [hName, setHName] = useState(nicknames.husband);
  const [wName, setWName] = useState(nicknames.wife);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setTab(initialTab);
    setInputBudget(String(budgetLimit));
    setHName(nicknames.husband);
    setWName(nicknames.wife);
    // 열릴 때만 현재 값으로 채움
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    const res = await fn();
    setBusy('');
    if (res?.ok) { if (successMsg) toast(successMsg, 'success'); return true; }
    if (res) toast(res.error || '저장하지 못했어요.', 'error');
    return false;
  };

  const ownerLabel = (o) => (o === 'husband' ? nicknames.husband : o === 'wife' ? nicknames.wife : '공용');
  const title = 'text-[15px] font-bold text-ink mb-1';
  const desc = 'text-[13px] text-muted mb-3';
  const input = 'w-full h-12 bg-fill rounded-xl px-4 text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband';
  const primary = 'h-12 px-5 rounded-xl bg-ink text-card text-[15px] font-bold shrink-0 disabled:opacity-50';
  const segWrap = 'flex bg-fill p-1 rounded-full';
  const seg = (active, activeText = 'text-ink') => `flex-1 h-10 rounded-full text-[14px] font-bold transition ${active ? `bg-card shadow-xs ${activeText}` : 'text-muted'}`;
  const block = 'py-5 border-b border-line last:border-0';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="설정" zIndex={55}>
      <div className="px-5 sticky top-0 bg-card z-10 pb-2">
        <div className={segWrap} role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={seg(tab === t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-8">
        {tab === 'us' && (
          <>
            <section className={block}>
              <h3 className={title}>이 휴대폰은 누구 건가요?</h3>
              <p className={desc}>새 내역의 결제자와 카드 기본값에 쓰여요.</p>
              <div className={segWrap}>
                <button type="button" onClick={() => onRoleChange('husband')} className={seg(currentUserRole === 'husband', 'text-husband')}>{nicknames.husband}</button>
                <button type="button" onClick={() => onRoleChange('wife')} className={seg(currentUserRole === 'wife', 'text-wife')}>{nicknames.wife}</button>
              </div>
            </section>
            <section className={block}>
              <h3 className={title}>별명</h3>
              <p className={desc}>두 휴대폰 모두에 같이 적용돼요.</p>
              <form onSubmit={(e) => { e.preventDefault(); if (!hName.trim() || !wName.trim()) { toast('두 사람의 별명을 모두 입력해주세요.', 'error'); return; } run('nick', () => onUpdateNicknames(hName, wName), '별명을 저장했어요.'); }} className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={hName} onChange={(e) => setHName(e.target.value)} placeholder="남편" className={input} aria-label="남편 별명" />
                  <input type="text" value={wName} onChange={(e) => setWName(e.target.value)} placeholder="아내" className={input} aria-label="아내 별명" />
                </div>
                <button type="submit" disabled={busy === 'nick'} className={`${primary} w-full`}>별명 저장</button>
              </form>
            </section>
          </>
        )}

        {tab === 'cards' && (
          <>
            <section className={block}>
              <h3 className={title}>결제 수단 추가</h3>
              <p className={desc}>이름에 카드사(신한, KB, 현대 등)를 넣으면 카드 문자로 입력할 때 자동 선택돼요.</p>
              <form onSubmit={async (e) => { e.preventDefault(); if (!newCardName.trim()) { toast('카드 이름을 입력해주세요.', 'error'); return; } if (await run('card', () => onAddCard(newCardName.trim(), newCardOwner, newCardType), `'${newCardName.trim()}'을(를) 추가했어요.`)) setNewCardName(''); }} className="space-y-2">
                <div className={segWrap}>
                  <button type="button" onClick={() => setNewCardOwner('husband')} className={seg(newCardOwner === 'husband', 'text-husband')}>{nicknames.husband}</button>
                  <button type="button" onClick={() => setNewCardOwner('wife')} className={seg(newCardOwner === 'wife', 'text-wife')}>{nicknames.wife}</button>
                  <button type="button" onClick={() => setNewCardOwner('joint')} className={seg(newCardOwner === 'joint', 'text-joint')}>공용</button>
                </div>
                <div className={segWrap}>
                  {CARD_TYPES.map((t) => <button key={t.id} type="button" onClick={() => setNewCardType(t.id)} className={seg(newCardType === t.id)}>{t.label}</button>)}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} placeholder="예: 신한 딥드림" className={input} aria-label="카드 이름" />
                  <button type="submit" disabled={busy === 'card'} className={primary}>추가</button>
                </div>
              </form>
            </section>
            <section className={block}>
              <h3 className={title}>사용 중인 결제 수단</h3>
              <p className={desc}>숨겨도 지난 내역과 정산 기록은 그대로 남아요.</p>
              <div className="rounded-2xl border border-line overflow-hidden">
                {cards.length === 0 && <p className="p-4 text-[14px] text-muted">등록된 카드가 없어요.</p>}
                {cards.map((card) => (
                  <div key={card.id} className="px-4 py-3 flex items-center justify-between gap-2 border-b border-line last:border-0">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink truncate">{card.card_name}</p>
                      <p className="text-[13px] text-muted">
                        <span className={card.owner === 'husband' ? 'text-husband' : card.owner === 'wife' ? 'text-wife' : 'text-joint'}>{ownerLabel(card.owner)}</span>
                        {' · '}{CARD_TYPES.find((t) => t.id === card.card_type)?.label || '기타'}
                      </p>
                    </div>
                    <button type="button" onClick={() => { if (window.confirm(`'${card.card_name}'을(를) 목록에서 숨길까요?`)) run(`hide-${card.id}`, () => onHideCard(card.id), '카드를 숨겼어요.'); }} className="h-9 px-3 rounded-xl bg-fill text-[13px] font-semibold text-ink2 shrink-0">숨기기</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'budget' && (
          <>
            <section className={block}>
              <h3 className={title}>월 지출 예산</h3>
              <p className={desc}>개인 지출을 포함한 한 달 전체 지출 기준이에요. 80%와 100%를 넘으면 알려드려요.</p>
              <form onSubmit={(e) => { e.preventDefault(); const n = Number(inputBudget); if (!n) { toast('예산 금액을 입력해주세요.', 'error'); return; } run('budget', () => onUpdateBudget(n), `월 예산을 ${formatNumber(n)}원으로 바꿨어요.`); }} className="flex gap-2">
                <input type="text" inputMode="numeric" value={inputBudget ? formatNumber(inputBudget) : ''} onChange={(e) => setInputBudget(onlyDigits(e.target.value).slice(0, 12))} className={`${input} num`} aria-label="월 예산(원)" />
                <button type="submit" disabled={busy === 'budget'} className={primary}>저장</button>
              </form>
              <p className="text-[14px] font-semibold text-husband mt-2">{formatKoreanAmount(inputBudget)}</p>
            </section>
            <section className={block}>
              <h3 className={title}>즐겨찾기</h3>
              {!favoritesAvailable ? (
                <p className={desc}>즐겨찾기를 쓰려면 Supabase에서 migration_v2.sql을 실행해주세요.</p>
              ) : favorites.length === 0 ? (
                <p className={desc}>내역 입력 화면 아래쪽 ☆ 버튼을 누르면 여기에 추가돼요.</p>
              ) : (
                <div className="rounded-2xl border border-line overflow-hidden mt-2">
                  {favorites.map((f) => (
                    <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-2 border-b border-line last:border-0">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink truncate">{f.content}</p>
                        <p className="text-[13px] text-muted num">{f.category}{f.amount ? ` · ${formatNumber(f.amount)}원` : ''}</p>
                      </div>
                      <button type="button" onClick={() => run(`fav-${f.id}`, () => onRemoveFavorite(f.id), '즐겨찾기에서 뺐어요.')} className="h-9 px-3 rounded-xl bg-fill text-[13px] font-semibold text-danger shrink-0">빼기</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'push' && (
          <NotificationSettings role={currentUserRole} nicknames={nicknames} push={push} onSaveVapidKey={onSaveVapidKey} onRefreshSettings={onRefreshSettings} />
        )}

        {tab === 'app' && (
          <>
            <section className={block}>
              <h3 className={title}>화면 모드</h3>
              <p className={desc}>'기기 설정'을 고르면 휴대폰의 다크 모드를 따라가요.</p>
              <div className={segWrap}>
                {THEMES.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => onThemeChange(id)} className={`${seg(theme === id)} flex items-center justify-center gap-1.5`}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            </section>
            <section className={block}>
              <h3 className={title}>홈 배경 사진</h3>
              <p className={desc}>홈 화면 맨 위 예산 영역에만 보여요.</p>
              <div className="w-full h-24 rounded-2xl overflow-hidden mb-2 bg-fill">
                <img src={bgImageUrl} alt="현재 배경" className="w-full h-full object-cover" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await run('bg', () => onUploadBackground(f), '배경 사진을 바꿨어요.'); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hidden" />
              <div className="flex gap-2">
                <button type="button" disabled={busy === 'bg'} onClick={() => fileInputRef.current?.click()} className={`${primary} flex-1`}>{busy === 'bg' ? '올리는 중…' : '사진 바꾸기'}</button>
                <button type="button" disabled={busy === 'bg'} onClick={() => { if (window.confirm('기본 배경으로 되돌릴까요?')) run('bg', onResetBackground, '기본 배경으로 되돌렸어요.'); }} className="h-12 px-4 rounded-xl bg-fill text-[15px] font-semibold text-ink2">기본으로</button>
              </div>
            </section>
            <section className={block}>
              <h3 className={title}>Siri로 입력하기 (아이폰)</h3>
              <p className={desc}>이 휴대폰 사용자({currentUserRole === 'husband' ? nicknames.husband : nicknames.wife}) 기준 값이에요. 상대방 폰에서는 그 폰의 설정 화면에서 복사하세요.</p>
              <SiriSetup currentUserRole={currentUserRole} nicknames={nicknames} />
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
