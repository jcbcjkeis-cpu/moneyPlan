import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useSettings(yearMonth) {
  const [cards, setCards] = useState([]);
  const [budgetLimit, setBudgetLimit] = useState(500000); // 기본값 50만 원
  const [isLoading, setIsLoading] = useState(true);

  // 1. 활성화된 카드 목록 & 이번 달 예산 한도 불러오기
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // 카드 목록 조회
      const { data: cardData } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (cardData && cardData.length > 0) {
        setCards(cardData);
      }

      // 이번 달 예산 조회
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('year_month', yearMonth)
        .eq('category', '전체')
        .single();

      if (budgetData) {
        setBudgetLimit(budgetData.limit_amount);
      }
    } catch (err) {
      console.error('설정 로드 실패:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 2. 새로운 카드 등록
  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const newCard = {
      card_name: cardName,
      owner: owner, // 'husband' | 'wife' | 'joint'
      card_type: cardType,
      is_active: true,
    };

    const { data, error } = await supabase.from('payment_cards').insert([newCard]).select();
    if (!error && data) {
      setCards((prev) => [...prev, data[0]]);
      alert('💳 새로운 카드가 등록되었습니다!');
    } else {
      alert('카드 등록 중 오류가 발생했습니다.');
    }
  };

  // 3. 카드 비활성화 (삭제 효과)
  const removeCard = async (cardId) => {
    if (!confirm('이 카드를 목록에서 삭제하시겠습니까?\n(과거 결제 내역은 안전하게 보존됩니다)')) return;

    const { error } = await supabase
      .from('payment_cards')
      .update({ is_active: false })
      .eq('id', cardId);

    if (!error) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  };

  // 4. 이번 달 예산 한도 저장/수정
  const updateBudget = async (newAmount) => {
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('year_month', yearMonth)
      .eq('category', '전체')
      .single();

    let error;
    if (existing) {
      // 기존 예산이 있으면 수정(Update)
      const res = await supabase
        .from('budgets')
        .update({ limit_amount: newAmount })
        .eq('id', existing.id);
      error = res.error;
    } else {
      // 없으면 신규 등록(Insert)
      const res = await supabase
        .from('budgets')
        .insert([{ year_month: yearMonth, category: '전체', limit_amount: newAmount }]);
      error = res.error;
    }

    if (!error) {
      setBudgetLimit(newAmount);
      alert('🎯 이번 달 예산 한도가 변경되었습니다!');
    } else {
      alert('예산 저장 실패. DB 권한을 확인해주세요.');
    }
  };

  return {
    cards,
    budgetLimit,
    isLoading,
    addCard,
    removeCard,
    updateBudget,
    refreshSettings: fetchSettings,
  };
}
