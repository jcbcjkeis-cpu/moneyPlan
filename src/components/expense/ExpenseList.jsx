import React, { useMemo } from 'react';
import ExpenseItem from './ExpenseItem';
import { formatDateLabel, formatNumber, toNumber } from '../../lib/format';

// 날짜별로 묶은 목록 (리스트 보기, 검색 결과에서 공용)
export default function ExpenseList({ items, nicknames, cardMap, onEdit, onDelete, emptyText = '내역이 없어요.' }) {
  const groups = useMemo(() => {
    const map = new Map();
    [...items]
      .sort((a, b) => (a.expense_date === b.expense_date
        ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
        : b.expense_date.localeCompare(a.expense_date)))
      .forEach((item) => {
        if (!map.has(item.expense_date)) map.set(item.expense_date, { date: item.expense_date, items: [], expense: 0, income: 0 });
        const g = map.get(item.expense_date);
        g.items.push(item);
        if (item.is_income) g.income += toNumber(item.amount);
        else g.expense += toNumber(item.amount);
      });
    return [...map.values()];
  }, [items]);

  if (groups.length === 0) {
    return <p className="py-12 text-center text-[14px] text-muted">{emptyText}</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.date}>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h4 className="text-[14px] font-bold text-ink2">{formatDateLabel(g.date)}</h4>
            <span className="num text-[13px] font-semibold text-muted">
              {g.expense > 0 && <span>-{formatNumber(g.expense)}</span>}
              {g.income > 0 && <span className="text-income ml-2">+{formatNumber(g.income)}</span>}
            </span>
          </div>
          <div className="space-y-2">
            {g.items.map((item) => (
              <ExpenseItem key={item.id} item={item} nicknames={nicknames} cardMap={cardMap} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
