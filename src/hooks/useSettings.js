import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_BG = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop';

export function useSettings() {
  const [cards, setCards] = useState([]);
  const [budgetLimit, setBudgetLimit] = useState(500000);
  const [nicknames, setNicknames] = useState({ husband: '남편', wife: '아내' });
  const [bgImageUrl, setBgImageUrl] = useState(DEFAULT_BG);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: cardData } = await supabase
        .from('payment_cards')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (cardData) setCards(cardData);

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
        // DB에 저장된 사진 URL이 있으면 적용, 없으면 기본 파스텔 배경 적용
        if (appData.bg_image_url && appData.bg_image_url.trim() !== '') {
          setBgImageUrl(appData.bg_image_url);
        } else {
          setBgImageUrl(DEFAULT_BG);
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

  // ★ 1. 배경 이미지 업로드 및 DB 저장
  const uploadBackground = async (file) => {
    if (!file) return;
    // 5MB 용량 제한 방어 로직
    if (file.size > 5 * 1024 * 1024) {
      return alert('🚨 5MB 이하의 사진 파일만 업로드 가능합니다.\n(너무 큰 사진은 앱 속도를 저하시킵니다)');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `custom_bg_${Date.now()}.${fileExt}`;

    // Supabase Storage 'backgrounds' 버킷에 업로드
    const { error: uploadError } = await supabase.storage
      .from('backgrounds')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return alert('🚨 사진 업로드 실패!\nSupabase Storage에 "backgrounds" 버킷을 Public으로 만들었는지 확인해주세요.');
    }

    // 업로드된 파일의 공용 URL 가져오기
    const { data } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    // DB app_settings에 URL 저장
    const { error: dbError } = await supabase
      .from('app_settings')
      .update({ bg_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!dbError) {
      setBgImageUrl(publicUrl);
      alert('✨ 배경 사진이 성공적으로 변경되어 부부 기기에 동기화됩니다!');
    } else {
      alert('DB 주소 저장 실패. 권한을 확인해주세요.');
    }
  };

  // ★ 2. 배경 이미지 삭제 (기본 배경으로 리셋)
  const resetBackground = async () => {
    if (!confirm('배경 사진을 삭제하고 기본 파스텔 테마로 복구하시겠습니까?')) return;

    const { error } = await supabase
      .from('app_settings')
      .update({ bg_image_url: '', updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) {
      setBgImageUrl(DEFAULT_BG);
      alert('♻️ 기본 배경 테마로 복구되었습니다.');
    } else {
      alert('초기화 실패');
    }
  };

  const updateNicknames = async (newHusbandName, newWifeName) => {
    const updated = { husband: newHusbandName.trim() || '남편', wife: newWifeName.trim() || '아내' };
    const { error } = await supabase.from('app_settings').update({ husband_nickname: updated.husband, wife_nickname: updated.wife, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) { setNicknames(updated); alert('✨ 별명이 저장되어 전역 동기화됩니다!'); }
  };

  const updateBudget = async (newAmount) => {
    const { error } = await supabase.from('app_settings').update({ global_budget: newAmount, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) { setBudgetLimit(newAmount); alert(`🎯 월간 고정 목표 예산이 ${newAmount.toLocaleString()}원으로 변경되었습니다!`); }
  };

  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const newCard = { card_name: cardName, owner: owner, card_type: cardType, is_active: true };
    const { data, error } = await supabase.from('payment_cards').insert([newCard]).select();
    if (!error && data) { setCards((prev) => [...prev, data[0]]); alert('💳 결제 수단이 등록되었습니다!'); }
  };

  const removeCard = async (cardId) => {
    if (!confirm('이 결제 수단을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('payment_cards').update({ is_active: false }).eq('id', cardId);
    if (!error) setCards((prev) => prev.filter((c) => c.id !== cardId));
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
