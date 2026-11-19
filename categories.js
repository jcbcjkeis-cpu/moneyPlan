export const INCOME_CATEGORIES = ['급여/월급', '부수입/투잡', '상여/보너스', '이자/배당금', '용돈/지원금', '기타 수입'];

export const EXPENSE_CATEGORIES = [
  '식비', '생필품', '장보기', '카페/간식', '교통/주유/차량',
  '쇼핑/뷰티/의류', '문화/여가/여행', '의료/건강', '교육/육아',
  '경조사/선물/용돈', '보험/세금', '공과금', '회비', '취미', '기타',
];

// 목록에서 빠진 옛 카테고리는 '기타' / '기타 수입'으로 합산
export function normalizeCategory(category, isIncome) {
  if (isIncome) return INCOME_CATEGORIES.includes(category) ? category : '기타 수입';
  return EXPENSE_CATEGORIES.includes(category) ? category : '기타';
}
