import React from 'react';
import { normalizeCategory } from '../../constants/categories';
import { formatNumber } from '../../lib/format';
import { findCard } from '../../lib/settlement';
import SwipeRow from '../common/SwipeRow';

// 내역 한 줄. 누르면 수정, 왼쪽으로 밀면 삭제
export default function ExpenseItem({ item, nicknames, cardMap, onEdit, onDelete, flat = false }) {
  const isHusband = item.payer === 'husband';
  const card = findCard(cardMap, item.card_id);
  const meta = [normalizeCategory(item.category, item.is_income)];
  if (card) meta.push(card.card_name);

  const row = (
    <button
      type="button"
      onClick={() => onEdit?.(item)}
      className={`w-full min-h-[64px] px-3.5 py-2.5 flex items-center gap-3 text-left ${flat ? 'bg-card' : 'bg-card border border-line rounded-2xl'}`}
    >
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${isHusband ? 'bg-husband-soft text-husband' : 'bg-wife-soft text-wife'}`}
        aria-label={`${isHusband ? nicknames.husband : nicknames.wife} 결제`}
      >
        {(isHusband ? nicknames.husband : nicknames.wife).slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink truncate">{item.content}</span>
        <span className="block text-[13px] text-muted truncate mt-0.5">
          {meta.join(' · ')}
          {!item.is_income && item.is_joint_expense && <span className="ml-1.5 text-joint font-semibold">공용</span>}
          {item.is_settled && <span className="ml-1.5 text-income font-semibold">정산완료</span>}
        </span>
      </span>
      <span className={`num text-[15px] font-bold shrink-0 ${item.is_income ? 'text-income' : 'text-ink'}`}>
        {item.is_income ? '+' : '-'}{formatNumber(item.amount)}
      </span>
    </button>
  );

  if (!onDelete) return row;
  return <SwipeRow onDelete={() => onDelete(item)}>{row}</SwipeRow>;
}
