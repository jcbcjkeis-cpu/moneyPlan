import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_BG = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop';

export function useSettings() {
  // ★ 1. 초기 상태값을 하드코딩 대신 localStorage 캐시에서 즉시 불러옴 (0ms 깜빡임 방지!)
  const [cards, setCards] = useState(() => {
    const cached = localStorage.getItem('buboo_cache_cards');
    return cached ? JSON.parse(cached) : [];
  });

  const [budgetLimit, setBudgetLimit] = useState(() => {
    const cached = localStorage.getItem('buboo_cache_budget');
    return cached ? Number(cached) : 500000;
  });

  const [nicknames, setNicknames] = useState(() => {
    const cached = localStorage.getItem('buboo_nicknames');
    return cached ? JSON.parse(cached) : { husband: '남편', wife: '아내' };
  });

  const [bgImageUrl, setBgImageUrl] = useState(() => {
    const cached = localStorage.getItem('buboo_cache_bg');
    return cached || DEFAULT_BG;
  });

  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 활성화된 카드 목록 조회 및 캐시 갱신
      const { data: cardData } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (cardData) {
        setCards(cardData);
        localStorage.setItem('buboo_cache_cards', JSON.stringify(cardData));
      }

      // 2. DB 앱 전역 설정 조회 및 캐시 갱신
      const { data: appData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (appData) {
        if (Number(appData.global_budget) > 0) {
          const budgetVal = Number(appData.global_budget);
          setBudgetLimit(budgetVal);
          localStorage.setItem('buboo_cache_budget', String(budgetVal));
        }

        const nicks = {
          husband: appData.husband_nickname || '남편',
          wife: appData.wife_nickname || '아내',
        };
        setNicknames(nicks);
        localStorage.setItem('buboo_nicknames', JSON.stringify(nicks));

        if (appData.bg_image_url && appData.bg_image_url.trim() !== '') {
          setBgImageUrl(appData.bg_image_url);
          localStorage.setItem('buboo_cache_bg', appData.bg_image_url);
        } else {
          setBgImageUrl(DEFAULT_BG);
          localStorage.setItem('buboo_cache_bg', DEFAULT_BG);
        }
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

  const uploadBackground = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return alert('🚨 5MB 이하의 사진 파일만 업로드 가능합니다.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `custom_bg_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('backgrounds')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return alert('🚨 사진 업로드 실패! Storage 권한을 확인해주세요.');
    }

    const { data } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    const { error: dbError } = await supabase
      .from('app_settings')
      .update({ bg_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!dbError) {
      setBgImageUrl(publicUrl);
      localStorage.setItem('buboo_cache_bg', publicUrl);
      alert('✨ 배경 사진이 성공적으로 변경되었습니다!');
    } else {
      alert('DB 주소 저장 실패. 권한을 확인해주세요.');
    }
  };

  const resetBackground = async () => {
    if (!confirm('배경 사진을 삭제하고 기본 파스텔 테마로 복구하시겠습니까?')) return;
    const { error } = await supabase
      .from('app_settings')
      .update({ bg_image_url: '', updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) {
      setBgImageUrl(DEFAULT_BG);
      localStorage.setItem('buboo_cache_bg', DEFAULT_BG);
      alert('♻️ 기본 배경 테마로 복구되었습니다.');
    } else {
      alert('초기화 실패');
    }
  };

  const updateNicknames = async (newHusbandName, newWifeName) => {
    const updated = { husband: newHusbandName.trim() || '남편', wife: newWifeName.trim() || '아내' };
    const { error } = await supabase.from('app_settings').update({ husband_nickname: updated.husband, wife_nickname: updated.wife, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) {
      setNicknames(updated);
      localStorage.setItem('buboo_nicknames', JSON.stringify(updated));
      alert('✨ 별명이 저장되어 전역 동기화됩니다!');
    }
  };

  const updateBudget = async (newAmount) => {
    const { error } = await supabase.from('app_settings').update({ global_budget: newAmount, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) {
      setBudgetLimit(newAmount);
      localStorage.setItem('buboo_cache_budget', String(newAmount));
      alert(`🎯 월간 고정 목표 예산이 ${newAmount.toLocaleString()}원으로 변경되었습니다!`);
    }
  };

  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const newCard = { card_name: cardName, owner: owner, card_type: cardType, is_active: true };
    const { data, error } = await supabase.from('payment_cards').insert([newCard]).select();
    if (!error && data) {
      setCards((prev) => {
        const next = [...prev, data[0]];
        localStorage.setItem('buboo_cache_cards', JSON.stringify(next));
        return next;
      });
      alert('💳 결제 수단이 등록되었습니다!');
    }
  };

  const removeCard = async (cardId) => {
    if (!confirm('이 결제 수단을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('payment_cards').update({ is_active: false }).eq('id', cardId);
    if (!error) {
      setCards((prev) => {
        const next = prev.filter((c) => c.id !== cardId);
        localStorage.setItem('buboo_cache_cards', JSON.stringify(next));
        return next;
      });
    }
  };

  return {
    cards,
    budgetLimit,
    nicknames,
    bgImageUrl,
    isLoading,
    addCard,
    removeCard,
    updateBudget,
    updateNicknames,
    uploadBackground,
    resetBackground,
    refreshSettings: fetchSettings,
  };
}
