import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useExpenses(yearMonth) {
  const [expenses, setExpenses] = useState([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getPrevYearMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthRange = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, '0')}` };
  };

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    const prevYm = getPrevYearMonth(yearMonth);

    try {
      const { start: startDate, end: endDate } = getMonthRange(yearMonth);
      const { start: prevStartDate, end: prevEndDate } = getMonthRange(prevYm);

      const { data: currData, error: currError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!currError && currData) setExpenses(currData);

      const { data: prevData, error: prevError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', prevStartDate)
        .lte('expense_date', prevEndDate)
        .order('expense_date', { ascending: false });

      if (!prevError && prevData) setPrevMonthExpenses(prevData);

    } catch (err) {
      console.error('지출 로딩 에러:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const addExpense = async (newRecord) => {
    const { data, error } = await supabase.from('expenses').insert([newRecord]).select();
    if (!error && data) {
      // 추가된 내역이 현재 달에 속할 때만 화면에 반영
      if (data[0].expense_date.startsWith(yearMonth)) {
        setExpenses((prev) => [data[0], ...prev]);
      }
    }
  };

  const updateExpense = async (id, updatedRecord) => {
    const { data, error } = await supabase.from('expenses').update(updatedRecord).eq('id', id).select();
    if (!error && data) {
      const updatedItem = data[0];
      // ★ 논리 방어: 수정한 날짜가 현재 달력(yearMonth)을 벗어났다면 화면 배열에서 삭제!
      if (!updatedItem.expense_date.startsWith(yearMonth)) {
        setExpenses((prev) => prev.filter(item => item.id !== id));
      } else {
        setExpenses((prev) => prev.map(item => item.id === id ? updatedItem : item));
      }
    }
  };

  const deleteExpense = async (id, isSettled) => {
    if (isSettled && !window.confirm('⚠️ 이미 정산이 완료된 내역입니다.\n삭제하면 과거 차액에 오차가 발생할 수 있습니다.\n진행하시겠습니까?')) return;
    if (!isSettled && !window.confirm('이 내역을 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) setExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  const settleMonthExpenses = async () => {
    const { start: startDate, end: endDate } = getMonthRange(yearMonth);
    const { error } = await supabase
      .from('expenses')
      .update({ is_settled: true })
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .eq('is_joint_expense', true)
      .eq('is_settled', false);

    if (!error) {
      setExpenses((prev) => prev.map((item) => (item.is_joint_expense ? { ...item, is_settled: true } : item)));
    } else throw error;
  };

  return { expenses, prevMonthExpenses, isLoading, addExpense, updateExpense, deleteExpense, settleMonthExpenses, refreshExpenses: fetchExpenses };
}
