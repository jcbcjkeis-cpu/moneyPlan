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
      // ★ 해결: .like() 대신 완벽하게 안전한 날짜 구간(.gte, .lte) 검색으로 교체 (데이터 증발 원천 차단)
      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-31`; 
      
      const prevStartDate = `${prevYm}-01`;
      const prevEndDate = `${prevYm}-31`;

      // 1. 이번 달 지출/수입 조회
      const { data: currData, error: currError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (currError) {
        console.error('이번 달 데이터 로드 에러:', currError);
      } else if (currData) {
        setExpenses(currData);
      }

      // 2. 직전 달 지출 데이터 조회 (통계용)
      const { data: prevData, error: prevError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', prevStartDate)
        .lte('expense_date', prevEndDate)
        .order('expense_date', { ascending: false });

      if (prevError) {
        console.error('저번 달 데이터 로드 에러:', prevError);
      } else if (prevData) {
        setPrevMonthExpenses(prevData);
      }

    } catch (err) {
      console.error('지출 로딩 런타임 에러:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (newRecord) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([newRecord])
      .select();

    if (!error && data) {
      setExpenses((prev) => [data[0], ...prev]);
    } else {
      alert('내역 저장에 실패했습니다. DB 권한을 확인해주세요.');
      console.error('추가 에러:', error);
    }
  };

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
      console.error('삭제 에러:', error);
    }
  };

  const settleMonthExpenses = async () => {
    // 정산 업데이트 시에도 .like 대신 구간 검색 사용
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
      setExpenses((prev) =>
        prev.map((item) => (item.is_joint_expense ? { ...item, is_settled: true } : item))
      );
    } else {
      console.error('정산 에러:', error);
      throw error;
    }
  };

  return {
    expenses,
    prevMonthExpenses,
    isLoading,
    addExpense,
    deleteExpense,
    settleMonthExpenses,
    refreshExpenses: fetchExpenses,
  };
}
