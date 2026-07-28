import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useSettings() {
  const [cards, setCards] = useState([]);
  const [budgetLimit, setBudgetLimit] = useState(500000);
  const [nicknames, setNicknames] = useState({ husband: '남편', wife: '아내' });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 활성화된 결제 카드 조회
      const { data: cardData } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (cardData) setCards(cardData);

      // ★ 2. DB에서 전역 설정(예산, 별명) 단건 조회
      const { data: appData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (appData) {
        if (Number(appData.global_budget) > 0) setBudgetLimit(Number(appData.global_budget));
        setNicknames({
          husband: appData.husband_nickname || '남편',
          wife: appData.wife_nickname || '아내',
        });
      }
    } catch (err) {
      console.error('설정 로드 실패:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 별명 DB 저장 및 동기화
  const updateNicknames = async (newHusbandName, newWifeName) => {
    const updated = {
      husband: newHusbandName.trim() || '남편',
      wife: newWifeName.trim() || '아내',
    };
    
    const { error } = await supabase
      .from('app_settings')
      .update({ husband_nickname: updated.husband, wife_nickname: updated.wife, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) {
      setNicknames(updated);
      alert('✨ 부부 커스텀 별명이 DB에 저장되어 두 분의 기기에 동기화됩니다!');
    } else {
      alert('별명 저장 실패. DB 권한을 확인해주세요.');
    }
  };

  // 전역 고정 예산 DB 저장
  const updateBudget = async (newAmount) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ global_budget: newAmount, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) {
      setBudgetLimit(newAmount);
      alert(`🎯 월간 고정 목표 예산이 ${newAmount.toLocaleString()}원으로 변경되었습니다!`);
    } else {
      alert('예산 저장 실패. DB 권한을 확인해주세요.');
    }
  };

  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const newCard = { card_name: cardName, owner: owner, card_type: cardType, is_active: true };
    const { data, error } = await supabase.from('payment_cards').insert([newCard]).select();
    if (!error && data) {
      setCards((prev) => [...prev, data[0]]);
      alert('💳 새로운 결제 수단이 등록되었습니다!');
    } else {
      alert('카드 등록 실패: DB 권한을 확인해주세요.');
    }
  };

  const removeCard = async (cardId) => {
    if (!confirm('이 결제 수단을 목록에서 삭제하시겠습니까? (과거 지출 내역은 안전하게 보존됩니다)')) return;
    const { error } = await supabase.from('payment_cards').update({ is_active: false }).eq('id', cardId);
    if (!error) setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  return {
    cards,
    budgetLimit,
    nicknames,
    isLoading,
    addCard,
    removeCard,
    updateBudget,
    updateNicknames,
    refreshSettings: fetchSettings,
  };
}
