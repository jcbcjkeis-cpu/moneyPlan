import React, { useMemo, useState } from 'react';
import { Copy, Share2, Undo2 } from 'lucide-react';
import { computeSettlement, findCard } from '../../lib/settlement';
import { formatNumber, formatShortDate, toNumber } from '../../lib/format';
import { haptic } from '../../lib/haptic';
import { useToast } from '../common/Toast';

const TYPE_LABEL = { CREDIT: '신용카드', DEBIT: '체크카드', ACCOUNT: '계좌', CASH: '카드 미선택' };
const shortYmd = (ymd) => { if (!ymd) return ''; const [, m, d] = ymd.split('-').map(Number); return `${m}/${d}`; };

export default function CardSettlementTab({
  expenses = [], allCards = [], cardMap, nicknames, yearMonth,
  unsettled = [], history = [], historyAvailable, onSettle, onUndoSettlement, onChanged, onEditExpense,
}) {
  const toast = useToast();
  const [subTab, setSubTab] = useState('settlement');
  const [isBusy, setIsBusy] = useState(false);
  const month = Number(yearMonth.split('-')[1]);
  const nameOf = (role) => (role === 'husband' ? nicknames.husband : role === 'wife' ? nicknames.wife : '공용');

  const cardSummary = useMemo(() => {
    const summary = new Map();
    allCards.forEach((c) => summary.set(String(c.id), { ...c, total: 0, count: 0 }));
    const cash = { id: 'cash', card_name: '현금 / 기타', owner: null, card_type: 'CASH', is_active: true, total: 0, count: 0 };
    expenses.forEach((e) => {
      if (e.is_income) return;
      const card = findCard(cardMap, e.card_id);
      const row = card ? summary.get(String(card.id)) : cash;
      row.total += toNumber(e.amount);
      row.count += 1;
    });
    const rows = [...summary.values()].filter((c) => c.count > 0 || c.is_active);
    if (cash.count > 0) rows.push(cash);
    return rows.sort((a, b) => b.total - a.total);
  }, [expenses, allCards, cardMap]);
  const creditTotal = cardSummary.filter((c) => c.card_type === 'CREDIT').reduce((a, c) => a + c.total, 0);
  const otherTotal = cardSummary.filter((c) => c.card_type !== 'CREDIT').reduce((a, c) => a + c.total, 0);

  const result = useMemo(() => computeSettlement(unsettled, cardMap, nicknames), [unsettled, cardMap, nicknames]);
  const period = result.periodStart
    ? (result.periodStart === result.periodEnd ? shortYmd(result.periodStart) : `${shortYmd(result.periodStart)} ~ ${shortYmd(result.periodEnd)}`)
    : '';

  const handleSettle = async () => {
    if (result.targets.length === 0) return;
    const msg = result.isBalanced
      ? `공용 생활비 ${result.targets.length}건을 차액 없이 정산 완료할까요?`
      : `${result.senderName}님이 ${result.receiverName}님께 ${formatNumber(result.transferAmount)}원을 보냈나요?\n확인하면 ${result.targets.length}건이 정산 완료로 바뀌어요.`;
    if (!window.confirm(msg)) return;
    setIsBusy(true);
    const res = await onSettle(result);
    setIsBusy(false);
    if (!res.ok) { toast(`정산하지 못했어요: ${res.error}`, 'error'); return; }
    haptic(20);
    toast(res.warning || '정산을 완료했어요.', res.warning ? 'warning' : 'success');
    onChanged();
  };

  const handleUndo = async (record) => {
    if (!window.confirm('이 정산을 취소할까요?\n포함됐던 내역이 다시 미정산으로 돌아가요.')) return;
    setIsBusy(true);
    const res = await onUndoSettlement(record);
    setIsBusy(false);
    toast(res.ok ? '정산을 취소했어요.' : `취소하지 못했어요: ${res.error}`, res.ok ? 'success' : 'error');
    if (res.ok) onChanged();
  };

  // 카톡 등으로 보내기 (아이폰/안드로이드 공유 시트). 공유가 안 되면 복사
  const shareRequest = async () => {
    const text = `[부부로그 정산] ${period} 공용 생활비 ${result.targets.length}건\n${nicknames.husband} ${formatNumber(result.husbandPaid)}원 / ${nicknames.wife} ${formatNumber(result.wifePaid)}원\n→ ${result.senderName}님이 ${result.receiverName}님께 ${formatNumber(result.transferAmount)}원 보내주세요`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('정산 내용을 복사했어요. 메신저에 붙여넣으세요.', 'success');
    } catch (e) {
      if (e?.name !== 'AbortError') toast('공유하지 못했어요.', 'error');
    }
  };

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(result.transferAmount));
      haptic();
      toast(`${formatNumber(result.transferAmount)}원을 복사했어요. 송금 앱에 붙여넣으세요.`, 'success');
    } catch {
      toast('복사하지 못했어요.', 'error');
    }
  };

  const tabs = [
    { id: 'settlement', label: '부부 정산', dot: result.targets.length > 0 },
    { id: 'cards', label: `${month}월 카드별` },
    { id: 'history', label: '정산 이력' },
  ];

  const renderList = (title, list, total, color) => (
    <div className="bg-card rounded-3xl border border-line overflow-hidden">
      <div className="flex justify-between items-baseline px-5 pt-4 pb-2 num">
        <h4 className="text-[15px] font-bold text-ink">{title}</h4>
        <span className={`text-[15px] font-bold ${color}`}>{formatNumber(total)}원</span>
      </div>
      {list.length > 0 ? list.map((item) => (
        <button key={item.id} type="button" onClick={() => onEditExpense(item)} className="w-full flex justify-between gap-2 px-5 py-2.5 text-left active:bg-fill num">
          <span className="text-[14px] text-ink2 truncate"><span className="text-muted mr-2">{shortYmd(item.expense_date)}</span>{item.content}</span>
          <span className="text-[14px] font-semibold text-ink shrink-0">{formatNumber(item.amount)}원</span>
        </button>
      )) : <p className="px-5 pb-4 text-[14px] text-muted">내역이 없어요.</p>}
      <div className="h-2" />
    </div>
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-app pb-28">
      <div className="bg-app/90 backdrop-blur-md sticky top-0 z-20 pt-safe px-4">
        <h2 className="text-[17px] font-bold text-ink pt-3 pb-3">정산</h2>
        <div className="flex bg-fill p-1 rounded-full mb-2" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={subTab === t.id} onClick={() => setSubTab(t.id)} className={`relative flex-1 h-10 rounded-full text-[14px] font-bold ${subTab === t.id ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>
              {t.label}
              {t.dot && <span className="absolute top-2 right-3 w-1.5 h-1.5 bg-danger rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'settlement' && (
        <div className="px-4 pt-2 space-y-3">
          <div className="bg-card rounded-3xl border border-line p-5">
            <p className="text-[14px] text-muted">미정산 공용 생활비 {result.targets.length}건{period && ` · ${period}`}</p>
            {result.targets.length === 0 ? (
              <p className="text-[20px] font-bold text-ink mt-2">정산할 내역이 없어요</p>
            ) : result.isBalanced ? (
              <p className="text-[20px] font-bold text-ink mt-2">서로 낸 금액이 같아서 보낼 돈이 없어요</p>
            ) : (
              <>
                <p className="text-[17px] font-semibold text-ink2 mt-2">
                  <span className={result.sender === 'husband' ? 'text-husband' : 'text-wife'}>{result.senderName}</span>님이{' '}
                  <span className={result.receiver === 'husband' ? 'text-husband' : 'text-wife'}>{result.receiverName}</span>님께
                </p>
                <p className="num text-[36px] font-extrabold text-ink leading-tight">{formatNumber(result.transferAmount)}<span className="text-[18px] font-semibold text-muted ml-1">원</span></p>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={copyAmount} className="flex-1 h-11 rounded-xl bg-fill text-[14px] font-bold text-ink flex items-center justify-center gap-1.5"><Copy size={16} /> 금액 복사</button>
                  <button type="button" onClick={shareRequest} className="flex-1 h-11 rounded-xl bg-fill text-[14px] font-bold text-ink flex items-center justify-center gap-1.5"><Share2 size={16} /> 정산 요청 보내기</button>
                </div>
              </>
            )}
            {result.targets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-line flex justify-between text-[14px] num">
                <span className="text-muted">{nicknames.husband} <strong className="text-ink">{formatNumber(result.husbandPaid)}원</strong></span>
                <span className="text-muted">{nicknames.wife} <strong className="text-ink">{formatNumber(result.wifePaid)}원</strong></span>
              </div>
            )}
          </div>

          {result.targets.length > 0 && (
            <>
              {renderList(`${nicknames.husband}님이 낸 공용 생활비`, result.husbandList, result.husbandPaid, 'text-husband')}
              {renderList(`${nicknames.wife}님이 낸 공용 생활비`, result.wifeList, result.wifePaid, 'text-wife')}
              <button type="button" disabled={isBusy} onClick={handleSettle} className="w-full h-[54px] rounded-2xl bg-ink text-card text-[16px] font-bold disabled:opacity-50 active:scale-[0.98]">
                {isBusy ? '처리 중…' : result.isBalanced ? '차액 없이 정산 완료' : '송금했어요, 정산 완료'}
              </button>
            </>
          )}
          <p className="text-[13px] text-muted px-1 leading-relaxed">
            개인카드(또는 현금)로 낸 공용 생활비를 반반 나눠 계산해요. 공용카드로 낸 돈과 개인 지출은 빠져요. 지난달에 정산하지 않은 내역도 여기 함께 모여요.
          </p>
        </div>
      )}

      {subTab === 'cards' && (
        <div className="px-4 pt-2 space-y-3">
          <div className="bg-card rounded-3xl border border-line p-5 num">
            <p className="text-[14px] text-muted">{month}월 결제수단별 사용액</p>
            <p className="text-[30px] font-extrabold text-ink leading-tight mt-0.5">{formatNumber(creditTotal + otherTotal)}<span className="text-[17px] font-semibold text-muted ml-1">원</span></p>
            <div className="flex justify-between text-[14px] mt-3 pt-3 border-t border-line">
              <span className="text-muted">신용카드 <strong className="text-ink">{formatNumber(creditTotal)}</strong></span>
              <span className="text-muted">체크·계좌·현금 <strong className="text-ink">{formatNumber(otherTotal)}</strong></span>
            </div>
          </div>
          <div className="bg-card rounded-3xl border border-line overflow-hidden">
            {cardSummary.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-line last:border-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink truncate">
                    {c.card_name}
                    {!c.is_active && <span className="ml-1.5 text-[12px] text-muted">(숨김)</span>}
                  </p>
                  <p className="text-[13px] text-muted">
                    {c.owner && <span className={c.owner === 'husband' ? 'text-husband' : c.owner === 'wife' ? 'text-wife' : 'text-joint'}>{nameOf(c.owner)}</span>}
                    {c.owner && ' · '}{TYPE_LABEL[c.card_type] || '기타'}
                  </p>
                </div>
                <div className="text-right shrink-0 num">
                  <p className="text-[15px] font-bold text-ink">{formatNumber(c.total)}원</p>
                  <p className="text-[13px] text-muted">{c.count}건</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-muted px-1">사용한 날짜 기준이에요. 신용카드 실제 청구액은 카드사 이용 기간에 따라 달라요.</p>
        </div>
      )}

      {subTab === 'history' && (
        <div className="px-4 pt-2">
          {!historyAvailable ? (
            <p className="text-[14px] text-ink2 bg-warn-soft rounded-2xl p-4 leading-relaxed">
              정산 이력을 저장하려면 Supabase SQL Editor에서 <strong>supabase/migration_v2.sql</strong>을 한 번 실행해주세요.
            </p>
          ) : history.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-muted">아직 정산 이력이 없어요.</p>
          ) : (
            <div className="bg-card rounded-3xl border border-line overflow-hidden">
              {history.map((h) => (
                <div key={h.id} className="px-5 py-4 flex items-start justify-between gap-3 border-b border-line last:border-0">
                  <div className="min-w-0 num">
                    <p className="text-[15px] font-bold text-ink">
                      {h.sender === 'none' ? '차액 없음' : `${nameOf(h.sender)} → ${nameOf(h.receiver)} ${formatNumber(h.amount)}원`}
                    </p>
                    <p className="text-[13px] text-muted mt-0.5">
                      {h.period_start ? `${shortYmd(h.period_start)}~${shortYmd(h.period_end)} 사용분 ` : ''}{h.item_count}건, {formatShortDate(h.created_at)} 완료
                    </p>
                  </div>
                  <button type="button" disabled={isBusy} onClick={() => handleUndo(h)} className="shrink-0 h-9 px-3 rounded-xl border border-line text-[13px] font-semibold text-muted flex items-center gap-1">
                    <Undo2 size={14} /> 취소
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
