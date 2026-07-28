import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useExpenses(yearMonth) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .like('expense_date', `${yearMonth}%`)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setExpenses(data);
      }
    } catch (err) {
      console.error('지출 로딩 실패:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // 지출/수입 신규 저장
  const addExpense = async (newRecord) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([newRecord])
      .select();

    if (!error && data) {
      setExpenses((prev) => [data[0], ...prev]);
    } else {
      alert('내역 저장에 실패했습니다. DB 권한을 확인해주세요.');
      console.error(error);
    }
  };

  // ★ 기존 지출/수입 내역 삭제 기능 (안전 확인창 적용)
  const deleteExpense = async (id, isSettled) => {
    if (isSettled) {
      if (!window.confirm('⚠️ 이미 부부간 정산이 완료된 내역입니다!\n삭제할 경우 과거 정산 차액에 오차가 발생할 수 있습니다.\n정말로 영구 삭제하시겠습니까?')) {
        return;
      }
    } else {
      if (!window.confirm('이 내역을 영구 삭제하시겠습니까?')) {
        return;
      }
    }

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (!error) {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    } else {
      alert('삭제 중 오류가 발생했습니다. DB 권한을 확인해주세요.');
      console.error(error);
    }
  };

  // 월간 전체 정산 완료 처리
  const settleMonthExpenses = async () => {
    const { error } = await supabase
      .from('expenses')
      .update({ is_settled: true })
      .like('expense_date', `${yearMonth}%`)
      .eq('is_joint_expense', true)
      .eq('is_settled', false);

    if (!error) {
      setExpenses((prev) =>
        prev.map((item) => (item.is_joint_expense ? { ...item, is_settled: true } : item))
      );
    } else {
      throw error;
    }
  };

  return {
    expenses,
    isLoading,
    addExpense,
    deleteExpense,
    settleMonthExpenses,
    refreshExpenses: fetchExpenses,
  };
}
