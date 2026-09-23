import React from 'react';
import { normalizeCategory } from '../../constants/categories';
import { formatNumber } from '../../lib/format';
import { findCard } from '../../lib/settlement';

export default function ExpenseItem({ item, nicknames, cardMap, onEdit, onDelete }) {
  const isHusband = item.payer === 'husband';
  const card = findCard(cardMap, item.card_id);
  const meta = [normalizeCategory(item.category, item.is_income)];
  if (card) meta.push(card.card_name);

  return (
    <div className="bg-white/85 backdrop-blur-md pl-3 pr-2 py-3 rounded-2xl border border-white/80 shadow-2xs flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onEdit?.(item)}
        className="flex items-center gap-3 overflow-hidden flex-1 text-left"
        aria-label={`${item.content} 수정`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 border ${isHusband ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {(isHusband ? nicknames.husband : nicknames.wife).slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-800 truncate">{item.content}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            {meta.join(' · ')}
            {!item.is_income && item.is_joint_expense && <span className="ml-1.5 text-purple-600 font-bold">공용</span>}
            {item.is_settled && <span className="ml-1.5 text-emerald-600 font-bold">정산완료</span>}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-[13px] font-bold tracking-tight pr-1 ${item.is_income ? 'text-emerald-600' : 'text-slate-800'}`}>
          {item.is_income ? '+' : '-'}{formatNumber(item.amount)}<span className="text-[11px] font-normal text-slate-500">원</span>
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center text-sm active:scale-90"
            aria-label={`${item.content} 삭제`}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
