import React, { useState, useMemo } from 'react';

export default function CardSettlementTab({ expenses = [], cards = [], onSettleMonth }) {
  const [subTab, setSubTab] = useState('prediction');
  const [isSettling, setIsSettling] = useState(false);

  // 1. 카드별 출금 대금 연산 (수입 is_income=true 는 제외하고 오직 지출만 집계)
  const cardSummary = useMemo(() => {
    const summary = {};
    if (!cards || cards.length === 0) return [];

    cards.forEach((card) => {
      summary[card.id] = { ...card, totalAmount: 0, count: 0 };
    });

    expenses.forEach((item) => {
      // 수입이 아니면서 등록된 카드에 해당하는 결제건만 합산
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

  // 2. 부부 상호 정산 차액 연산 (수입 제외, 미정산 공동 생활비만)
  const settlementData = useMemo(() => {
    const unsettledJoints = expenses.filter(
      (item) => !item.is_income && item.is_joint_expense && !item.is_settled
    );

    let husbandPaidForJoint = 0;
    let wifePaidForJoint = 0;
    const husbandList = [];
    const wifeList = [];

    unsettledJoints.forEach((item) => {
      const cardInfo = cards.find((c) => c.id === item.card_id);
      // 공용 카드/계좌(joint)가 아닌 개인 소유 카드로 긁은 생활비만 상호 정산 대상
      if (cardInfo && cardInfo.owner !== 'joint') {
        if (item.payer === 'husband') {
          husbandPaidForJoint += Number(item.amount);
          husbandList.push(item);
        } else if (item.payer === 'wife') {
          wifePaidForJoint += Number(item.amount);
          wifeList.push(item);
        }
      }
    });

    const diff = Math.abs(husbandPaidForJoint - wifePaidForJoint);
    const transferAmount = Math.round(diff / 2);
    const sender = husbandPaidForJoint > wifePaidForJoint ? 'wife' : 'husband';
    const receiver = sender === 'wife' ? '남편' : '아내';

    return {
      unsettledList: unsettledJoints,
      husbandPaidForJoint,
      wifePaidForJoint,
      husbandList,
      wifeList,
      diff,
      transferAmount,
      sender,
      receiver,
      isBalanced: diff === 0,
    };
  }, [expenses, cards]);

  const handleConfirmSettlement = async () => {
    if (settlementData.unsettledList.length === 0) {
      alert('정산할 미정산 생활비 내역이 없습니다.');
      return;
    }

    if (window.confirm(`이번 달 미정산 생활비 ${settlementData.transferAmount.toLocaleString()}원 이체를 완료하셨습니까?\n확인 시 지출 내역들이 정산 완료(is_settled=true)로 처리됩니다.`)) {
      setIsSettling(true);
      try {
        if (onSettleMonth) await onSettleMonth();
        alert('🤝 정산이 완료되었습니다! 알뜰한 이번 달도 고생 많으셨습니다.');
      } catch (error) {
        alert('정산 처리 중 오류가 발생했습니다.');
      } finally {
        setIsSettling(false);
      }
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-24">
      <div className="bg-white px-5 pt-4 pb-0 border-b border-slate-200 sticky top-0 z-20">
        <h2 className="text-base font-extrabold text-slate-800 mb-3 flex items-center space-x-1.5">
          <span>💳</span>
          <span>카드 관리 & 부부 생활비 정산</span>
        </h2>
        
        <div className="flex space-x-2 border-b border-transparent">
          <button
            type="button"
            onClick={() => setSubTab('prediction')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all text-center ${
              subTab === 'prediction' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            💳 카드별 출금 대금
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settlement')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all text-center relative ${
              subTab === 'settlement' ? 'border-purple-600 text-purple-600 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            🤝 부부 상호 정산
            {settlementData.unsettledList.length > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {subTab === 'prediction' && (
        <div className="p-4 space-y-4 animate-fade-in">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md">
            <span className="text-[11px] text-indigo-200 font-semibold uppercase tracking-wider block mb-1">🏦 다음 달 결제일 출금 예정 총액</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold tracking-tight">{totalCardBilling.toLocaleString()} <span className="text-sm font-normal">원</span></span>
              <span className="text-[11px] bg-indigo-800/80 px-2.5 py-1 rounded-full text-indigo-100 font-medium">총 {cardSummary.reduce((a, b) => a + b.count, 0)}건 지출</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-3 pt-3 border-t border-slate-800 flex items-center space-x-1">
              <span>💡</span>
              <span>월급날 공용 생활비 계좌에 미리 이체해야 할 추천 금액입니다.</span>
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-600 px-1">💳 등록된 결제 수단별 사용 현황</h3>
            {cardSummary.length > 0 ? (
              cardSummary.map((card) => (
                <div key={card.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      card.owner === 'husband' ? 'bg-blue-100 text-blue-700' : card.owner === 'wife' ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {card.owner === 'husband' ? '남편' : card.owner === 'wife' ? '아내' : '공용'}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800">{card.card_name}</h4>
                      <span className="text-[11px] text-slate-400">{card.card_type === 'CREDIT' ? '신용카드' : '체크/계좌'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-800 block">{card.totalAmount.toLocaleString()} <span className="text-xs font-normal">원</span></span>
                    <span className="text-[10px] text-slate-400">{card.count}건 결제</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-400 py-8 bg-white rounded-xl border border-dashed border-slate-200">등록된 카드 결제 내역이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {subTab === 'settlement' && (
        <div className="p-4 space-y-4 animate-fade-in">
          <div className={`p-5 rounded-2xl border shadow-md ${settlementData.isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-purple-900 text-white border-purple-800'}`}>
            <span className="text-[11px] font-semibold opacity-80 block mb-1">🤝 이번 달 생활비 상호 상계 결과</span>
            {settlementData.isBalanced ? (
              <div className="py-2 text-center">
                <span className="text-3xl block mb-1">🎉</span>
                <p className="text-sm font-bold">부부간 추가로 송금할 차액이 없습니다!</p>
                <p className="text-xs opacity-75 mt-0.5">개인 카드로 결제한 공용 지출액이 정확히 일치하거나 없습니다.</p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-extrabold leading-snug my-1.5">
                  <span className="underline decoration-yellow-400 decoration-2 font-black">{settlementData.sender === 'husband' ? '🙋‍♂️ 남편' : '🙋‍♀️ 아내'}</span>이(가) {settlementData.receiver} 계좌로<br />
                  총 <span className="text-yellow-300 text-2xl font-black">{settlementData.transferAmount.toLocaleString()}원</span>을 송금해 주세요!
                </div>
                <p className="text-[11px] text-purple-200 pt-3 mt-3 border-t border-purple-800/80 flex justify-between">
                  <span>남편 공용결제: {settlementData.husbandPaidForJoint.toLocaleString()}원</span>
                  <span>아내 공용결제: {settlementData.wifePaidForJoint.toLocaleString()}원</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-700">📋 개인 카드로 결제된 공용 생활비 ({settlementData.unsettledList.length}건)</h3>
              <span className="text-[10px] text-slate-400">정산 대상 내역 (수입 제외)</span>
            </div>

            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-2">
              <h4 className="text-xs font-bold text-blue-800 flex justify-between border-b border-blue-200/60 pb-1.5">
                <span>🙋‍♂️ 남편 개인카드 공용 지출</span>
                <span>총 {settlementData.husbandPaidForJoint.toLocaleString()}원</span>
              </h4>
              {settlementData.husbandList.length > 0 ? (
                settlementData.husbandList.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-slate-700 py-1">
                    <span className="truncate pr-2">• {item.content}</span>
                    <span className="font-semibold shrink-0">{item.amount.toLocaleString()}원</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[11px] text-slate-400 py-2">내역이 없습니다.</p>
              )}
            </div>

            <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 space-y-2">
              <h4 className="text-xs font-bold text-rose-800 flex justify-between border-b border-rose-200/60 pb-1.5">
                <span>🙋‍♀️ 아내 개인카드 공용 지출</span>
                <span>총 {settlementData.wifePaidForJoint.toLocaleString()}원</span>
              </h4>
              {settlementData.wifeList.length > 0 ? (
                settlementData.wifeList.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-slate-700 py-1">
                    <span className="truncate pr-2">• {item.content}</span>
                    <span className="font-semibold shrink-0">{item.amount.toLocaleString()}원</span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[11px] text-slate-400 py-2">내역이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSettling || settlementData.unsettledList.length === 0}
              onClick={handleConfirmSettlement}
              className={`w-full py-4 rounded-2xl text-white font-extrabold text-sm shadow-lg transition-all flex items-center justify-center space-x-2 ${
                settlementData.unsettledList.length === 0 || isSettling ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-purple-600 to-indigo-600 active:scale-[0.98] shadow-purple-500/25'
              }`}
            >
              <span>🤝</span>
              <span>{isSettling ? '정산 처리 중...' : '이번 달 부부 상호 정산 완료하기 (원터치)'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
