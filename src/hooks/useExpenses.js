import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useExpenses(yearMonth) {
  const [expenses, setExpenses] = useState([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 전달 연월 구하기
  const getPrevYearMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // ★ 핵심 수정: 해당 연월의 '진짜 마지막 날짜(28, 30, 31)'를 완벽히 계산하는 헬퍼 함수
  const getMonthRange = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // 해당 월의 마지막 날짜 자동 연산
    return {
      start: `${ym}-01`,
      end: `${ym}-${String(lastDay).padStart(2, '0')}`
    };
  };

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    const prevYm = getPrevYearMonth(yearMonth);

    try {
      // 이제 무식하게 -31을 붙이지 않고, 정확한 달의 마지막 날짜를 가져옵니다.
      const { start: startDate, end: endDate } = getMonthRange(yearMonth);
      const { start: prevStartDate, end: prevEndDate } = getMonthRange(prevYm);

      // 1. 이번 달 지출/수입 조회
      const { data: currData, error: currError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!currError && currData) setExpenses(currData);
      else if (currError) console.error('이번 달 로드 에러:', currError);

      // 2. 직전 달 지출 데이터 조회 (통계용)
      const { data: prevData, error: prevError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', prevStartDate)
        .lte('expense_date', prevEndDate)
        .order('expense_date', { ascending: false });

      if (!prevError && prevData) setPrevMonthExpenses(prevData);
      else if (prevError) console.error('저번 달 로드 에러:', prevError);

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

  const updateExpense = async (id, updatedRecord) => {
    const { data, error } = await supabase.from('expenses').update(updatedRecord).eq('id', id).select();
    if (!error && data) {
      setExpenses((prev) => prev.map(item => item.id === id ? data[0] : item));
    } else {
      alert('내역 수정에 실패했습니다.');
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
    // ★ 정산 기능에서도 정확한 마지막 날짜 사용
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
