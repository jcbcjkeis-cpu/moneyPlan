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

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    const prevYm = getPrevYearMonth(yearMonth);

    try {
      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-31`; 
      const prevStartDate = `${prevYm}-01`;
      const prevEndDate = `${prevYm}-31`;

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

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (newRecord) => {
    const { data, error } = await supabase.from('expenses').insert([newRecord]).select();
    if (!error && data) {
      setExpenses((prev) => [data[0], ...prev]);
    } else {
      alert('내역 저장 실패. DB 권한을 확인해주세요.');
    }
  };

  // ★ 신설: 기존 내역 수정 (Update) 함수
  const updateExpense = async (id, updatedRecord) => {
    const { data, error } = await supabase
      .from('expenses')
      .update(updatedRecord)
      .eq('id', id)
      .select();

    if (!error && data) {
      setExpenses((prev) => prev.map(item => item.id === id ? data[0] : item));
    } else {
      alert('내역 수정에 실패했습니다. DB 권한을 확인해주세요.');
      console.error(error);
    }
  };

  const deleteExpense = async (id, isSettled) => {
    if (isSettled && !window.confirm('⚠️ 이미 부부 정산이 완료된 내역입니다!\n삭제하면 정산 차액에 오차가 발생할 수 있습니다.\n그래도 영구 삭제하시겠습니까?')) return;
    if (!isSettled && !window.confirm('이 내역을 영구 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    } else {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const settleMonthExpenses = async () => {
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;

    const { error } = await supabase
      .from('expenses')
      .update({ is_settled: true })
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .eq('is_joint_expense', true)
      .eq('is_settled', false);

    if (!error) {
      setExpenses((prev) => prev.map((item) => (item.is_joint_expense ? { ...item, is_settled: true } : item)));
    } else {
      throw error;
    }
  };

  return {
    expenses,
    prevMonthExpenses,
    isLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    settleMonthExpenses,
    refreshExpenses: fetchExpenses,
  };
}
