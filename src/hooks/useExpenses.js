import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { monthRange, shiftYearMonth } from '../lib/format';

// 선택한 달 + 전달 내역 (통계 비교용)
export function useExpenses(yearMonth, version) {
  const [expenses, setExpenses] = useState([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [loadedMonth, setLoadedMonth] = useState(null);
  const requestRef = useRef(0);

  const fetchExpenses = useCallback(async () => {
    const requestId = ++requestRef.current; // 달을 빠르게 넘길 때 늦게 온 응답이 덮어쓰지 않도록
    setIsLoading(true);
    const cur = monthRange(yearMonth);
    const prev = monthRange(shiftYearMonth(yearMonth, -1));

    const [currRes, prevRes] = await Promise.all([
      supabase.from('expenses').select('*')
        .gte('expense_date', cur.start).lte('expense_date', cur.end)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('expenses').select('*')
        .gte('expense_date', prev.start).lte('expense_date', prev.end),
    ]);

    if (requestId !== requestRef.current) return;
    if (currRes.error) setLoadError(currRes.error.message);
    else { setExpenses(currRes.data || []); setLoadError(null); setLoadedMonth(yearMonth); }
    if (!prevRes.error) setPrevMonthExpenses(prevRes.data || []);
    setIsLoading(false);
  }, [yearMonth]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses, version]);

  return { expenses, prevMonthExpenses, isLoading, loadError, loadedMonth, refreshExpenses: fetchExpenses };
}

// 추가/수정/삭제. 성공하면 onChanged()로 모든 화면 데이터를 다시 불러옴
export function useExpenseMutations({ onChanged, myInsertIds }) {
  const addExpense = useCallback(async (record) => {
    const { data, error } = await supabase.from('expenses').insert([record]).select();
    if (error) return { ok: false, error: error.message };
    if (data?.[0]) myInsertIds.current.add(String(data[0].id));
    onChanged();
    return { ok: true, data: data?.[0] };
  }, [onChanged, myInsertIds]);

  const updateExpense = useCallback(async (id, record) => {
    const { error } = await supabase.from('expenses').update(record).eq('id', id);
    if (error) return { ok: false, error: error.message };
    onChanged();
    return { ok: true };
  }, [onChanged]);

  const deleteExpense = useCallback(async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    onChanged();
    return { ok: true };
  }, [onChanged]);

  return { addExpense, updateExpense, deleteExpense };
}
