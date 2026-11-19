import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import Sheet from '../common/Sheet';
import ExpenseItem from '../expense/ExpenseItem';
import { formatDateLabel, formatNumber, toNumber } from '../../lib/format';

// 달력에서 날짜를 누르면 올라오는 그날 내역
export default function DaySheet({ isOpen, onClose, ymd, expenses, nicknames, cardMap, onEdit, onDelete, onAdd }) {
  const items = useMemo(() => expenses.filter((e) => e.expense_date === ymd), [expenses, ymd]);
  const spent = items.filter((e) => !e.is_income).reduce((a, c) => a + toNumber(c.amount), 0);
  const earned = items.filter((e) => e.is_income).reduce((a, c) => a + toNumber(c.amount), 0);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={formatDateLabel(ymd)}
      maxHeight="75vh"
      footer={(
        <button type="button" onClick={onAdd} className="w-full h-[52px] rounded-2xl bg-ink text-card text-[16px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]">
          <Plus size={20} /> 이날 내역 추가
        </button>
      )}
    >
      <div className="px-4 pb-4">
        {items.length > 0 && (
          <p className="num text-[14px] text-muted px-1 mb-3">
            {items.length}건 · 지출 <strong className="text-ink">{formatNumber(spent)}원</strong>
            {earned > 0 && <> · 수입 <strong className="text-income">{formatNumber(earned)}원</strong></>}
          </p>
        )}
        {items.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">이날은 등록된 내역이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <ExpenseItem key={item.id} item={item} nicknames={nicknames} cardMap={cardMap} onEdit={onEdit} onDelete={onDelete} />
            ))}
            <p className="text-center text-[12px] text-muted pt-2">내역을 왼쪽으로 밀면 삭제할 수 있어요</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
