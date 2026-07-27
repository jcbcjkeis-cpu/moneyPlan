import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useExpenses(yearMonth) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', `${yearMonth}-01`)
        .lte('expense_date', `${yearMonth}-31`)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setExpenses(data || []);
    } catch (err) {
      console.error('❌ 지출 내역 로드 실패:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchExpenses();

    const channel = supabase
      .channel('public:expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new;
            if (newRecord.expense_date.startsWith(yearMonth)) {
              setExpenses((prev) => [newRecord, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setExpenses((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setExpenses((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses, yearMonth]);

  const addExpense = async (newExpense) => {
    setExpenses((prev) => [newExpense, ...prev]);
    const { error: insertError } = await supabase.from('expenses').insert([newExpense]);
    if (insertError) {
      console.error('❌ DB 저장 실패, 화면 롤백:', insertError);
      fetchExpenses();
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
  };

  const settleMonthExpenses = async () => {
    const unsettledIds = expenses
      .filter((item) => item.is_joint_expense && !item.is_settled)
      .map((item) => item.id);

    if (unsettledIds.length === 0) return;

    setExpenses((prev) =>
      prev.map((item) => (unsettledIds.includes(item.id) ? { ...item, is_settled: true } : item))
    );

    const { error: updateError } = await supabase
      .from('expenses')
      .update({ is_settled: true })
      .in('id', unsettledIds);

    if (updateError) {
      console.error('❌ 일괄 정산 DB 업데이트 실패:', updateError);
      fetchExpenses();
      throw updateError;
    }
  };

  return {
    expenses,
    isLoading,
    error,
    addExpense,
    settleMonthExpenses,
    refresh: fetchExpenses,
  };
}