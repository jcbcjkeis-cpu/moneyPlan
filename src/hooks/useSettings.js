import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_BG = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop';

export function useSettings() {
  // ★ 신설: 비활성화(삭제)된 카드를 포함한 모든 카드 (과거 정산 데이터 보존용)
  const [allCards, setAllCards] = useState(() => {
    const cached = localStorage.getItem('buboo_cache_all_cards');
    return cached ? JSON.parse(cached) : [];
  });
  
  // UI 노출용 활성 카드만 필터링
  const cards = allCards.filter(c => c.is_active);

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
      // 삭제된 카드 이력까지 모두 가져오기 (정합성 방어)
      const { data: cardData } = await supabase
        .from('payment_cards')
        .select('*')
        .order('id', { ascending: true });

      if (cardData) {
        setAllCards(cardData);
        localStorage.setItem('buboo_cache_all_cards', JSON.stringify(cardData));
      }

      const { data: appData } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();

      if (appData) {
        if (Number(appData.global_budget) > 0) {
          const budgetVal = Number(appData.global_budget);
          setBudgetLimit(budgetVal);
          localStorage.setItem('buboo_cache_budget', String(budgetVal));
        }

        const nicks = { husband: appData.husband_nickname || '남편', wife: appData.wife_nickname || '아내' };
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
      console.error('설정 로드 에러:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const uploadBackground = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('🚨 5MB 이하의 사진만 가능합니다.');
    const fileName = `custom_bg_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
    if (error) return alert('업로드 실패');
    const { data } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    await supabase.from('app_settings').update({ bg_image_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
    setBgImageUrl(data.publicUrl);
    localStorage.setItem('buboo_cache_bg', data.publicUrl);
    alert('✨ 배경 사진 변경 완료!');
  };

  const resetBackground = async () => {
    if (!confirm('기본 배경으로 복구하시겠습니까?')) return;
    await supabase.from('app_settings').update({ bg_image_url: '', updated_at: new Date().toISOString() }).eq('id', 1);
    setBgImageUrl(DEFAULT_BG);
    localStorage.setItem('buboo_cache_bg', DEFAULT_BG);
  };

  const updateNicknames = async (h, w) => {
    const updated = { husband: h.trim() || '남편', wife: w.trim() || '아내' };
    await supabase.from('app_settings').update({ husband_nickname: updated.husband, wife_nickname: updated.wife, updated_at: new Date().toISOString() }).eq('id', 1);
    setNicknames(updated);
    localStorage.setItem('buboo_nicknames', JSON.stringify(updated));
  };

  const updateBudget = async (newAmount) => {
    await supabase.from('app_settings').update({ global_budget: newAmount, updated_at: new Date().toISOString() }).eq('id', 1);
    setBudgetLimit(newAmount);
    localStorage.setItem('buboo_cache_budget', String(newAmount));
  };

  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const newCard = { card_name: cardName, owner: owner, card_type: cardType, is_active: true };
    const { data, error } = await supabase.from('payment_cards').insert([newCard]).select();
    if (!error && data) {
      setAllCards(prev => {
        const next = [...prev, data[0]];
        localStorage.setItem('buboo_cache_all_cards', JSON.stringify(next));
        return next;
      });
    }
  };

  const removeCard = async (cardId) => {
    if (!confirm('카드를 목록에서 숨기시겠습니까?\n(과거 정산 내역 보존을 위해 DB 데이터는 유지됩니다.)')) return;
    const { error } = await supabase.from('payment_cards').update({ is_active: false }).eq('id', cardId);
    if (!error) {
      setAllCards(prev => {
        const next = prev.map(c => c.id === cardId ? { ...c, is_active: false } : c);
        localStorage.setItem('buboo_cache_all_cards', JSON.stringify(next));
        return next;
      });
    }
  };

  return { allCards, cards, budgetLimit, nicknames, bgImageUrl, isLoading, addCard, removeCard, updateBudget, updateNicknames, uploadBackground, resetBackground, refreshSettings: fetchSettings };
}
