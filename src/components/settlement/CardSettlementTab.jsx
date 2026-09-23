import React, { useMemo, useState } from 'react';
import { computeSettlement, findCard } from '../../lib/settlement';
import { formatNumber, formatShortDate, toNumber } from '../../lib/format';
import { useToast } from '../common/Toast';

const TYPE_LABEL = { CREDIT: '신용카드', DEBIT: '체크카드', ACCOUNT: '계좌' };

const shortYmd = (ymd) => {
  if (!ymd) return '';
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}`;
};

export default function CardSettlementTab({
  expenses = [], allCards = [], cardMap, nicknames, yearMonth,
  unsettled = [], history = [], historyAvailable, onSettle, onUndoSettlement, onChanged,
}) {
  const toast = useToast();
  const [subTab, setSubTab] = useState('settlement');
  const [isBusy, setIsBusy] = useState(false);
  const month = Number(yearMonth.split('-')[1]);
  const nameOf = (role) => (role === 'husband' ? nicknames.husband : role === 'wife' ? nicknames.wife : '공용');

  // 선택한 달의 결제수단별 사용액
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
    toast(res.warning || '정산을 완료했어요. 이번 달도 고생 많았어요!', res.warning ? 'warning' : 'success');
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

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(result.transferAmount));
      toast(`${formatNumber(result.transferAmount)}원을 복사했어요. 송금 앱에 붙여넣으세요.`, 'success');
    } catch {
      toast('복사하지 못했어요.', 'error');
    }
  };

  const tabs = [
    { id: 'settlement', label: '🤝 부부 정산', dot: result.targets.length > 0 },
    { id: 'cards', label: `💳 ${month}월 카드별` },
    { id: 'history', label: '🗂 정산 이력' },
  ];

  const renderList = (list, color) => (list.length > 0 ? list.map((item) => (
    <div key={item.id} className="flex justify-between gap-2 text-[13px] font-bold text-slate-700 py-1">
      <span className="truncate"><span className="text-slate-400 font-medium mr-1.5">{shortYmd(item.expense_date)}</span>{item.content}</span>
      <span className={`font-black shrink-0 ${color}`}>{formatNumber(item.amount)}원</span>
    </div>
  )) : <p className="text-center text-xs font-medium text-slate-500 py-2">내역이 없어요.</p>);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <div className="bg-white px-4 pt-3 border-b border-slate-200/80 sticky top-0 z-20 pt-safe">
        <h2 className="text-base font-black text-slate-800 mb-2.5">카드 관리 & 부부 정산</h2>
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-black border-b-2 relative ${subTab === t.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500'}`}
            >
              {t.label}
              {t.dot && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'settlement' && (
        <div className="p-4 space-y-4">
          <div className={`p-5 rounded-3xl shadow-lg text-white ${result.isBalanced ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900'}`}>
            <span className="text-xs font-bold opacity-80 block mb-1">
              미정산 공용 생활비 {result.targets.length}건{period && ` (${period})`}
            </span>
            {result.targets.length === 0 ? (
              <p className="text-base font-black py-3">정산할 내역이 없어요 🎉</p>
            ) : result.isBalanced ? (
              <p className="text-base font-black py-3">서로 낸 금액이 같아서 보낼 돈이 없어요.</p>
            ) : (
              <>
                <p className="text-lg font-extrabold leading-snug my-2">
                  {result.senderName}님이 {result.receiverName}님께<br />
                  <span className="text-yellow-300 text-3xl font-black">{formatNumber(result.transferAmount)}원</span> 보내주세요
                </p>
                <button type="button" onClick={copyAmount} className="text-xs font-bold bg-white/15 border border-white/30 px-3 py-1.5 rounded-full active:scale-95">금액 복사</button>
              </>
            )}
            {result.targets.length > 0 && (
              <p className="text-xs text-white/80 pt-3 mt-3 border-t border-white/20 flex justify-between font-bold">
                <span>{nicknames.husband} 결제 {formatNumber(result.husbandPaid)}원</span>
                <span>{nicknames.wife} 결제 {formatNumber(result.wifePaid)}원</span>
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500 px-1 leading-relaxed">
            개인카드(또는 현금)로 낸 공용 생활비를 반반 나눠 계산해요. 공용카드로 낸 돈과 개인 지출은 포함되지 않아요. 지난달에 정산하지 않은 내역도 여기에 함께 모여요.
          </p>

          <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100">
            <h4 className="text-[13px] font-black text-blue-900 flex justify-between border-b border-blue-200/60 pb-2 mb-1">
              <span>{nicknames.husband} 카드로 낸 공용 생활비</span><span>{formatNumber(result.husbandPaid)}원</span>
            </h4>
            {renderList(result.husbandList, 'text-blue-600')}
          </div>
          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-100">
            <h4 className="text-[13px] font-black text-rose-900 flex justify-between border-b border-rose-200/60 pb-2 mb-1">
              <span>{nicknames.wife} 카드로 낸 공용 생활비</span><span>{formatNumber(result.wifePaid)}원</span>
            </h4>
            {renderList(result.wifeList, 'text-rose-600')}
          </div>

          <button
            type="button"
            disabled={isBusy || result.targets.length === 0}
            onClick={handleSettle}
            className="w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none active:scale-[0.98]"
          >
            {isBusy ? '처리 중…' : result.isBalanced ? '차액 없이 정산 완료' : '송금했어요, 정산 완료'}
          </button>
        </div>
      )}

      {subTab === 'cards' && (
        <div className="p-4 space-y-4">
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl">
            <span className="text-xs text-indigo-200 font-bold block mb-1">{month}월 결제수단별 사용액</span>
            <span className="text-3xl font-black">{formatNumber(creditTotal + otherTotal)}<span className="text-base font-bold text-slate-400 ml-1">원</span></span>
            <div className="flex justify-between text-xs font-bold text-slate-300 mt-3 pt-3 border-t border-white/10">
              <span>신용카드 {formatNumber(creditTotal)}원</span>
              <span>체크·계좌·현금 {formatNumber(otherTotal)}원</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 px-1">사용한 날짜 기준이에요. 신용카드 실제 청구액은 카드사 이용 기간에 따라 다를 수 있어요.</p>
          <div className="space-y-2">
            {cardSummary.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${c.owner === 'husband' ? 'bg-blue-50 text-blue-600' : c.owner === 'wife' ? 'bg-rose-50 text-rose-600' : c.owner === 'joint' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                    {c.owner ? nameOf(c.owner).slice(0, 2) : '💵'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-900 truncate">
                      {c.card_name}
                      {!c.is_active && <span className="ml-1.5 text-[11px] bg-slate-100 text-slate-500 px-1.5 rounded">숨김</span>}
                    </p>
                    <span className="text-xs font-bold text-slate-500">{TYPE_LABEL[c.card_type] || (c.card_type === 'CASH' ? '카드 미선택' : '기타')}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-slate-900 block">{formatNumber(c.total)}원</span>
                  <span className="text-xs font-bold text-slate-500">{c.count}건</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div className="p-4 space-y-2">
          {!historyAvailable ? (
            <p className="text-[13px] text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-4 leading-relaxed">
              정산 이력을 저장하려면 Supabase SQL Editor에서 <strong>supabase/migration_v2.sql</strong>을 한 번 실행해주세요.
            </p>
          ) : history.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500">아직 정산 이력이 없어요.</p>
          ) : history.map((h) => (
            <div key={h.id} className="bg-white p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-black text-slate-900">
                    {h.sender === 'none' ? '차액 없음' : `${nameOf(h.sender)} → ${nameOf(h.receiver)} ${formatNumber(h.amount)}원`}
                  </p>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {h.period_start ? `${shortYmd(h.period_start)} ~ ${shortYmd(h.period_end)} 사용분 ` : ''}{h.item_count}건 · {formatShortDate(h.created_at)} 완료
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{nicknames.husband} {formatNumber(h.husband_paid)}원 / {nicknames.wife} {formatNumber(h.wife_paid)}원</p>
                </div>
                <button type="button" disabled={isBusy} onClick={() => handleUndo(h)} className="shrink-0 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 active:scale-95">
                  정산 취소
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
