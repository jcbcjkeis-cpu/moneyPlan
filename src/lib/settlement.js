// 부부 정산 계산 규칙
// - 공용 생활비(is_joint_expense)로 표시된 지출만 대상
// - 개인카드로 냈으면 '카드 주인'이 낸 것으로 계산 (결제자 입력 실수 방지)
// - 공용카드/공용계좌로 냈으면 이미 공동 자금이라 정산 대상 아님
// - 카드 없이(현금 등) 냈으면 결제자 기준

export function buildCardMap(cards = []) {
  const map = new Map();
  cards.forEach((c) => map.set(String(c.id), c));
  return map;
}

export function findCard(cardMap, cardId) {
  if (cardId === null || cardId === undefined || cardId === '') return null;
  return cardMap.get(String(cardId)) || null;
}

export function settlementOwner(item, cardMap) {
  if (!item || item.is_income || !item.is_joint_expense) return null;
  const card = findCard(cardMap, item.card_id);
  if (card) return card.owner === 'husband' || card.owner === 'wife' ? card.owner : null;
  return item.payer === 'husband' || item.payer === 'wife' ? item.payer : null;
}

export function computeSettlement(items = [], cardMap, nicknames) {
  const husbandList = [];
  const wifeList = [];
  let husbandPaid = 0;
  let wifePaid = 0;

  items.forEach((item) => {
    if (item.is_settled) return;
    const owner = settlementOwner(item, cardMap);
    if (owner === 'husband') { husbandPaid += Number(item.amount) || 0; husbandList.push(item); }
    if (owner === 'wife') { wifePaid += Number(item.amount) || 0; wifeList.push(item); }
  });

  const targets = [...husbandList, ...wifeList].sort((a, b) => (a.expense_date < b.expense_date ? -1 : 1));
  const diff = Math.abs(husbandPaid - wifePaid);
  const transferAmount = Math.round(diff / 2); // 공용 생활비는 반반 부담
  const sender = husbandPaid > wifePaid ? 'wife' : 'husband';
  const receiver = sender === 'wife' ? 'husband' : 'wife';

  return {
    targets,
    husbandList,
    wifeList,
    husbandPaid,
    wifePaid,
    diff,
    transferAmount,
    sender,
    receiver,
    senderName: nicknames?.[sender] ?? sender,
    receiverName: nicknames?.[receiver] ?? receiver,
    isBalanced: diff === 0,
    periodStart: targets[0]?.expense_date ?? null,
    periodEnd: targets[targets.length - 1]?.expense_date ?? null,
  };
}
