import React, { useState, useMemo } from 'react';

export default function CardSettlementTab({
  expenses = [],
  cards = [],
  nicknames = { husband: '남편', wife: '아내' },
  yearMonth = '2026-07',
  onSettleMonth,
}) {
  const [subTab, setSubTab] = useState('prediction');
  const [isSettling, setIsSettling] = useState(false);

  const cardSummary = useMemo(() => {
    const summary = {};
    if (!cards || cards.length === 0) return [];
    cards.forEach((card) => { summary[card.id] = { ...card, totalAmount: 0, count: 0 }; });

    expenses.forEach((item) => {
      if (!item.is_income && item.card_id && summary[item.card_id]) {
        summary[item.card_id].totalAmount += Number(item.amount || 0);
        summary[item.card_id].count += 1;
      }
    });
    return Object.values(summary);
  }, [expenses, cards]);

  const totalCardBilling = useMemo(() => {
    return cardSummary.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [cardSummary]);

  const settlementData = useMemo(() => {
    const unsettledJoints = expenses.filter(
      (item) => !item.is_income && item.is_joint_expense && !item.is_settled
    );

    let husbandPaid = 0;
    let wifePaid = 0;
    const husbandList = [];
    const wifeList = [];

    unsettledJoints.forEach((item) => {
      const cardInfo = cards.find((c) => c.id === item.card_id);
      if (cardInfo && cardInfo.owner !== 'joint') {
        if (item.payer === 'husband') { husbandPaid += Number(item.amount); husbandList.push(item); }
        else if (item.payer === 'wife') { wifePaid += Number(item.amount); wifeList.push(item); }
      }
    });

    const diff = Math.abs(husbandPaid - wifePaid);
    const transferAmount = Math.round(diff / 2);
    const senderRole = husbandPaid > wifePaid ? 'wife' : 'husband';
    const senderName = senderRole === 'wife' ? nicknames.wife : nicknames.husband;
    const receiverName = senderRole === 'wife' ? nicknames.husband : nicknames.wife;

    return {
      unsettledList: unsettledJoints,
      husbandPaid,
      wifePaid,
      husbandList,
      wifeList,
      diff,
      transferAmount,
      senderRole,
      senderName,
      receiverName,
      isBalanced: diff === 0,
    };
  }, [expenses, cards, nicknames]);

  const handleConfirmSettlement = async () => {
    if (settlementData.unsettledList.length === 0) return alert('정산할 미정산 생활비 내역이 없습니다.');
    if (window.confirm(`이번 달 미정산 생활비 ${settlementData.transferAmount.toLocaleString()}원 이체를 완료하셨습니까?\n확인 시 지출 내역들이 정산 완료로 처리됩니다.`)) {
      setIsSettling(true);
      try {
        if (onSettleMonth) await onSettleMonth();
        alert('🤝 정산이 완료되었습니다! 이번 달도 고생 많으셨습니다.');
      } catch (error) {
        alert('정산 처리 중 오류가 발생했습니다.');
      } finally {
        setIsSettling(false);
      }
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28 select-none font-sans animate-fade-in">
      <div className="bg-white px-5 pt-4 pb-0 border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <h2 className="text-base font-black text-slate-800 mb-3 flex items-center space-x-2">
          <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 flex items-center justify-center text-sm">🤝</span>
          <span>카드 관리 & 부부 생활비 정산 ({yearMonth.split('-')[1]}월)</span>
        </h2>
        
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setSubTab('prediction')}
            className={`flex-1 py-2.5 text-xs font-black border-b-2 transition-all text-center ${
              subTab === 'prediction' ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            💳 카드별 출금 대금
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settlement')}
            className={`flex-1 py-2.5 text-xs font-black border-b-2 transition-all text-center relative ${
              subTab === 'settlement' ? 'border-purple-600 text-purple-600 bg-purple-50/50 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            🤝 부부 상호 정산
            {settlementData.unsettledList.length > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {subTab === 'prediction' && (
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[11px] text-indigo-300 font-extrabold uppercase tracking-wider block mb-1">🏦 다음 달 결제일 출금 예정 총액</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight">{totalCardBilling.toLocaleString()} <span className="text-base font-bold text-slate-400">원</span></span>
              <span className="text-[11px] bg-indigo-500/20 px-3 py-1 rounded-full text-indigo-200 font-black border border-indigo-500/30">총 {cardSummary.reduce((a, b) => a + b.count, 0)}건 지출</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-slate-700 px-1 flex items-center space-x-1.5">
              <span>💳</span><span>결제 수단별 사용 현황</span>
            </h3>
            {cardSummary.length > 0 ? (
              cardSummary.map((card) => (
                <div key={card.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center space-x-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-inner ${
                      card.owner === 'husband' ? 'bg-blue-50 text-blue-600 border border-blue-100' : card.owner === 'wife' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                    }`}>
                      {card.owner === 'husband' ? nicknames.husband.slice(0, 2) : card.owner === 'wife' ? nicknames.wife.slice(0, 2) : '공용'}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{card.card_name}</h4>
                      <span className="text-[10px] font-bold text-slate-400">{card.card_type === 'CREDIT' ? '신용카드' : '체크/계좌'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 block">{card.totalAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">원</span></span>
                    <span className="text-[10px] font-bold text-slate-400">{card.count}건 결제</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs font-bold text-slate-400 py-10 bg-white rounded-2xl border border-dashed border-slate-300">등록된 카드 결제 내역이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {subTab === 'settlement' && (
        <div className="p-4 space-y-4">
          <div className={`p-6 rounded-3xl border shadow-lg relative overflow-hidden transition-all ${
            settlementData.isBalanced ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400' : 'bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white border-purple-800'
          }`}>
            <span className="text-[11px] font-extrabold opacity-80 uppercase tracking-wider block mb-1">🤝 부부 상호 상계 결과 ({yearMonth.split('-')[1]}월)</span>
            {settlementData.isBalanced ? (
              <div className="py-4 text-center">
                <span className="text-4xl block mb-2">🎉</span>
                <p className="text-base font-black">이번 달은 서로 송금할 차액이 없습니다!</p>
                <p className="text-xs opacity-80 mt-1">개인 카드로 결제한 공용 지출액이 일치하거나 없습니다.</p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-extrabold leading-snug my-2">
                  <span className="underline decoration-yellow-400 decoration-2 font-black">{settlementData.senderRole === 'husband' ? `🙋‍♂️ ${nicknames.husband}` : `🙋‍♀️ ${nicknames.wife}`}</span>님이 {settlementData.receiverName}님 계좌로<br />
                  총 <span className="text-yellow-300 text-3xl font-black">{settlementData.transferAmount.toLocaleString()}원</span>을 송금해주세요!
                </div>
                <p className="text-[11px] text-purple-200 pt-3 mt-3 border-t border-purple-800/80 flex justify-between font-bold">
                  <span>{nicknames.husband} 결제: {settlementData.husbandPaid.toLocaleString()}원</span>
                  <span>{nicknames.wife} 결제: {settlementData.wifePaid.toLocaleString()}원</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-800">📋 개인 카드 공용 생활비 ({settlementData.unsettledList.length}건)</h3>
              <span className="text-[10px] font-bold text-slate-400">수입 및 공용카드 제외</span>
            </div>

            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 space-y-2">
              <h4 className="text-xs font-black text-blue-900 flex justify-between border-b border-blue-200/60 pb-2">
                <span>🙋‍♂️ {nicknames.husband} 개인카드 공용 지출</span>
                <span>총 {settlementData.husbandPaid.toLocaleString()}원</span>
              </h4>
              {settlementData.husbandList.length > 0 ? (
                settlementData.husbandList.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs font-bold text-slate-700 py-1">
                    <span className="truncate pr-2">• {item.content}</span>
                    <span className="font-black shrink-0 text-blue-600">{item.amount.toLocaleString()}원</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[11px] font-bold text-slate-400 py-2">내역이 없습니다.</p>
              )}
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-100 space-y-2">
              <h4 className="text-xs font-black text-rose-900 flex justify-between border-b border-rose-200/60 pb-2">
                <span>🙋‍♀️ {nicknames.wife} 개인카드 공용 지출</span>
                <span>총 {settlementData.wifePaid.toLocaleString()}원</span>
              </h4>
              {settlementData.wifeList.length > 0 ? (
                settlementData.wifeList.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs font-bold text-slate-700 py-1">
                    <span className="truncate pr-2">• {item.content}</span>
                    <span className="font-black shrink-0 text-rose-600">{item.amount.toLocaleString()}원</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[11px] font-bold text-slate-400 py-2">내역이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSettling || settlementData.unsettledList.length === 0}
              onClick={handleConfirmSettlement}
              className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer ${
                settlementData.unsettledList.length === 0 || isSettling ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-purple-500/25'
              }`}
            >
              <span>🤝</span>
              <span>{isSettling ? '정산 처리 중...' : `${yearMonth.split('-')[1]}월 부부 상호 정산 완료하기`}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
