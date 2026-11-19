// 카드 목록을 id로 빠르게 찾기 위한 도구
export function buildCardMap(cards = []) {
  const map = new Map();
  cards.forEach((c) => map.set(String(c.id), c));
  return map;
}

export function findCard(cardMap, cardId) {
  if (cardId === null || cardId === undefined || cardId === '') return null;
  return cardMap.get(String(cardId)) || null;
}
