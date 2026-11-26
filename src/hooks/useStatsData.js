import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 통계용: 비교·추이 기간까지 한 번에 불러옴
export function useStatsData(fetchStart, end, version) {
  const [state, setState] = useState({ rows: [], loading: true, key: '' });
  useEffect(() => {
    let alive = true;
    const key = `${fetchStart}|${end}`;
    setState((s) => ({ ...s, loading: true }));
    supabase
      .from('expenses')
      .select('id, expense_date, amount, is_income, category, content, payer, card_id, is_joint_expense, created_at')
      .gte('expense_date', fetchStart)
      .lte('expense_date', end)
      .limit(20000)
      .then(({ data, error }) => {
        if (!alive) return;
        setState({ rows: error ? [] : data || [], loading: false, key });
      });
    return () => { alive = false; };
  }, [fetchStart, end, version]);
  return state;
}
