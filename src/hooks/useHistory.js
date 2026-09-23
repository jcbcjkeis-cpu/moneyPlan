import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const HISTORY_LIMIT = 800;

// 자동완성·자주 쓴 내역용 최근 기록 (전체 기간, 최신순)
export function useHistory(version) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    supabase
      .from('expenses')
      .select('id, content, category, card_id, payer, is_income, is_joint_expense, amount, expense_date')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => { if (alive && !error) setRows(data || []); });
    return () => { alive = false; };
  }, [version]);

  // 사용처별로 묶기: 가장 최근 기록을 대표값으로, 횟수로 정렬
  const merchants = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const name = (r.content || '').trim();
      if (!name) return;
      const key = `${r.is_income ? 'I' : 'E'}|${name.toLowerCase()}`;
      const hit = map.get(key);
      if (hit) hit.count += 1;
      else map.set(key, { ...r, content: name, count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  return { merchants };
}

export function searchMerchants(merchants, query, isIncome, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return merchants
    .filter((m) => m.is_income === isIncome && m.content.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.content.toLowerCase().startsWith(q) ? 1 : 0;
      const bStarts = b.content.toLowerCase().startsWith(q) ? 1 : 0;
      return bStarts - aStarts || b.count - a.count;
    })
    .slice(0, limit);
}

export function findMerchant(merchants, name, isIncome) {
  const q = (name || '').trim().toLowerCase();
  if (!q) return null;
  return merchants.find((m) => m.is_income === isIncome && m.content.toLowerCase() === q) || null;
}
