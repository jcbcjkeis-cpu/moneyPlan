import React, { useEffect, useState } from 'react';
import Sheet from '../common/Sheet';
import ExpenseItem from '../expense/ExpenseItem';
import { supabase } from '../../lib/supabase';
import { formatNumber, toNumber } from '../../lib/format';

// 빠른 입력으로 여러 건 저장한 뒤 "수정"을 누르면: 방금 저장한 내역만 모아서 보여줌
export default function SavedListSheet({ isOpen, onClose, ids, nicknames, cardMap, onEdit, onDelete, version, hiddenIds }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!isOpen || !ids?.length) return undefined;
    let alive = true;
    supabase.from('expenses').select('*').in('id', ids).then(({ data }) => {
      if (!alive || !data) return;
      const order = new Map(ids.map((id, i) => [String(id), i]));
      setRows(data.sort((a, b) => order.get(String(a.id)) - order.get(String(b.id))));
    });
    return () => { alive = false; };
  }, [isOpen, ids, version]);

  const visible = hiddenIds?.size ? rows.filter((r) => !hiddenIds.has(String(r.id))) : rows;
  const total = visible.filter((r) => !r.is_income).reduce((a, r) => a + toNumber(r.amount), 0);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={`방금 저장한 ${visible.length}건`} maxHeight="75dvh">
      <div className="px-4 pb-5">
        <p className="text-[13px] text-muted px-1 mb-3 num">지출 {formatNumber(total)}원 · 누르면 수정, 왼쪽으로 밀면 삭제</p>
        <div className="space-y-2">
          {visible.map((item) => (
            <ExpenseItem key={item.id} item={item} nicknames={nicknames} cardMap={cardMap} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {!visible.length && <p className="py-8 text-center text-[14px] text-muted">남은 내역이 없어요.</p>}
        </div>
      </div>
    </Sheet>
  );
}
