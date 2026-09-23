import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// 달과 상관없이 아직 정산 안 된 공용 지출 전체 + 정산 이력
export function useSettlements(version) {
  const [unsettled, setUnsettled] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyAvailable, setHistoryAvailable] = useState(true);

  const fetchAll = useCallback(async () => {
    const [u, h] = await Promise.all([
      supabase.from('expenses').select('*')
        .eq('is_joint_expense', true).eq('is_settled', false).eq('is_income', false)
        .order('expense_date', { ascending: true }),
      supabase.from('settlements').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (!u.error) setUnsettled(u.data || []);
    if (h.error) setHistoryAvailable(false);
    else { setHistoryAvailable(true); setHistory(h.data || []); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, version]);

  // 화면에 보인 내역(id 목록)만 정산 처리 → 그 사이 배우자가 추가한 내역은 다음 정산으로 넘어감
  const settle = async (result) => {
    const ids = result.targets.map((t) => t.id);
    if (ids.length === 0) return { ok: false, error: '정산할 내역이 없어요.' };

    const { error } = await supabase.from('expenses').update({ is_settled: true }).in('id', ids).eq('is_settled', false);
    if (error) return { ok: false, error: error.message };

    if (historyAvailable) {
      const { error: hErr } = await supabase.from('settlements').insert([{
        sender: result.isBalanced ? 'none' : result.sender,
        receiver: result.isBalanced ? 'none' : result.receiver,
        amount: result.transferAmount,
        husband_paid: result.husbandPaid,
        wife_paid: result.wifePaid,
        item_count: ids.length,
        period_start: result.periodStart,
        period_end: result.periodEnd,
        expense_ids: ids,
      }]);
      if (hErr) return { ok: true, warning: `정산은 완료됐지만 이력 저장에 실패했어요: ${hErr.message}` };
    }
    return { ok: true };
  };

  // 잘못 정산했을 때 되돌리기
  const undoSettlement = async (record) => {
    const ids = Array.isArray(record.expense_ids) ? record.expense_ids : [];
    if (ids.length > 0) {
      const { error } = await supabase.from('expenses').update({ is_settled: false }).in('id', ids);
      if (error) return { ok: false, error: error.message };
    }
    const { error } = await supabase.from('settlements').delete().eq('id', record.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  return { unsettled, history, historyAvailable, settle, undoSettlement, refreshSettlements: fetchAll };
}
