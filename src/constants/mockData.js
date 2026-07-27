export const MOCK_PAYMENT_CARDS = [
  { id: 1, card_name: '신한카드 (남편)', owner: 'husband', card_type: 'CREDIT', settlement_day: 25, is_active: true },
  { id: 2, card_name: '현대M카드 (아내)', owner: 'wife', card_type: 'CREDIT', settlement_day: 25, is_active: true },
  { id: 3, card_name: '국민생활비체크 (공용)', owner: 'joint', card_type: 'DEBIT', settlement_day: null, is_active: true },
  { id: 4, card_name: '카카오뱅크 계좌이체', owner: 'joint', card_type: 'ACCOUNT', settlement_day: null, is_active: true },
];

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: '🛒 마트/장보기', icon: '🛒' },
  { id: 'eatout', label: '🍽️ 외식/배달', icon: '🍽️' },
  { id: 'cafe', label: '☕ 카페/간식', icon: '☕' },
  { id: 'living', label: '🏠 주거/통신', icon: '🏠' },
  { id: 'kids', label: '👶 육아/교육', icon: '👶' },
  { id: 'car', label: '🚗 교통/주유', icon: '🚗' },
  { id: 'medical', label: '🏥 의료/건강', icon: '🏥' },
  { id: 'etc', label: '💡 기타 생활비', icon: '💡' },
];

export const SMART_DEFAULTS = {
  currentUserRole: 'husband',
  defaultCardIdByRole: {
    husband: 1,
    wife: 2,
    joint: 3,
  },
};