import { normalizeCategory } from '../constants/categories';
import { findCard } from '../lib/settlement';
import { toNumber } from '../lib/format';

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// 엑셀에서 바로 합계를 낼 수 있도록 수입/지출 구분 열 추가, 지출은 음수로 기록
export function exportExpensesToCsv({ expenses, yearMonth, cardMap, nicknames }) {
  if (!expenses || expenses.length === 0) return { ok: false, error: '내보낼 내역이 없어요.' };

  const headers = ['일자', '구분', '결제자', '결제수단', '카테고리', '내역', '금액(원)', '공용/개인', '정산'];
  const rows = [...expenses]
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
    .map((item) => {
      const card = findCard(cardMap, item.card_id);
      const amount = toNumber(item.amount);
      return [
        item.expense_date,
        item.is_income ? '수입' : '지출',
        q(item.payer === 'husband' ? nicknames.husband : nicknames.wife),
        q(item.is_income ? '' : card ? card.card_name : '현금/기타'),
        q(normalizeCategory(item.category, item.is_income)),
        q(item.content),
        item.is_income ? amount : -amount,
        item.is_income ? '' : item.is_joint_expense ? '공용' : '개인',
        item.is_income || !item.is_joint_expense ? '' : item.is_settled ? '완료' : '미정산',
      ].join(',');
    });

  const csv = `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `부부로그_${yearMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, count: rows.length };
}
