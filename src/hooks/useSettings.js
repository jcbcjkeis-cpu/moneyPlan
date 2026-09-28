import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_BG = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop';

const readCache = (key, fallback, parse = JSON.parse) => {
  try {
    const v = localStorage.getItem(key);
    return v ? parse(v) : fallback;
  } catch { return fallback; }
};
const writeCache = (key, value) => {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* 저장 공간 부족 등은 무시 */ }
};

export function useSettings() {
  // 숨긴 카드까지 포함한 전체 카드 (과거 정산 데이터 보존용)
  const [allCards, setAllCards] = useState(() => readCache('buboo_cache_all_cards', []));
  // 화면에 새 배열이 매번 만들어지지 않도록 메모 (입력창 초기화 버그 원인이었음)
  const cards = useMemo(() => allCards.filter((c) => c.is_active), [allCards]);

  const [budgetLimit, setBudgetLimit] = useState(() => readCache('buboo_cache_budget', 500000, Number));
  const [nicknames, setNicknames] = useState(() => readCache('buboo_nicknames', { husband: '남편', wife: '아내' }));
  const [bgImageUrl, setBgImageUrl] = useState(() => readCache('buboo_cache_bg', DEFAULT_BG, String));
  const [push, setPush] = useState(() => readCache('buboo_cache_push', { vapidPublicKey: '', functionUrl: '' }));

  const fetchSettings = useCallback(async () => {
    const [{ data: cardData }, { data: appData }] = await Promise.all([
      supabase.from('payment_cards').select('*').order('id', { ascending: true }),
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (cardData) { setAllCards(cardData); writeCache('buboo_cache_all_cards', cardData); }

    if (appData) {
      if (Number(appData.global_budget) > 0) {
        const v = Number(appData.global_budget);
        setBudgetLimit(v); writeCache('buboo_cache_budget', String(v));
      }
      const nicks = { husband: appData.husband_nickname || '남편', wife: appData.wife_nickname || '아내' };
      setNicknames((prev) => (prev.husband === nicks.husband && prev.wife === nicks.wife ? prev : nicks));
      writeCache('buboo_nicknames', nicks);
      const pushCfg = { vapidPublicKey: appData.vapid_public_key || '', functionUrl: appData.push_function_url || '' };
      setPush(pushCfg); writeCache('buboo_cache_push', pushCfg);
      const bg = appData.bg_image_url?.trim() ? appData.bg_image_url : DEFAULT_BG;
      setBgImageUrl(bg); writeCache('buboo_cache_bg', bg);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveAppSettings = async (patch) => {
    const { error } = await supabase.from('app_settings')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
    return error ? { ok: false, error: error.message } : { ok: true };
  };

  const uploadBackground = async (file) => {
    if (!file) return { ok: false, error: '사진을 선택해주세요.' };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: '5MB 이하의 사진만 올릴 수 있어요.' };
    const fileName = `custom_bg_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
    if (error) return { ok: false, error: `업로드 실패: ${error.message}` };
    const { data } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    const res = await saveAppSettings({ bg_image_url: data.publicUrl });
    if (!res.ok) return res;
    setBgImageUrl(data.publicUrl); writeCache('buboo_cache_bg', data.publicUrl);
    return { ok: true };
  };

  const resetBackground = async () => {
    const res = await saveAppSettings({ bg_image_url: '' });
    if (!res.ok) return res;
    setBgImageUrl(DEFAULT_BG); writeCache('buboo_cache_bg', DEFAULT_BG);
    return { ok: true };
  };

  const updateNicknames = async (h, w) => {
    const next = { husband: h.trim() || '남편', wife: w.trim() || '아내' };
    const res = await saveAppSettings({ husband_nickname: next.husband, wife_nickname: next.wife });
    if (!res.ok) return res;
    setNicknames(next); writeCache('buboo_nicknames', next);
    return { ok: true };
  };

  const updateBudget = async (amount) => {
    const res = await saveAppSettings({ global_budget: amount });
    if (!res.ok) return res;
    setBudgetLimit(amount); writeCache('buboo_cache_budget', String(amount));
    return { ok: true };
  };

  // 알림 공개 키 저장 (비밀 키는 저장하지 않음)
  const saveVapidPublicKey = async (publicKey) => {
    const res = await saveAppSettings({ vapid_public_key: publicKey, vapid_subject: window.location.origin });
    if (!res.ok) {
      return /vapid/.test(res.error) ? { ok: false, error: 'migration_v4_push.sql을 먼저 실행해주세요.' } : res;
    }
    setPush((prev) => { const next = { ...prev, vapidPublicKey: publicKey }; writeCache('buboo_cache_push', next); return next; });
    return { ok: true };
  };

  const updateCardsState = (updater) => {
    setAllCards((prev) => {
      const next = updater(prev);
      writeCache('buboo_cache_all_cards', next);
      return next;
    });
  };

  const addCard = async (cardName, owner, cardType = 'CREDIT') => {
    const { data, error } = await supabase.from('payment_cards')
      .insert([{ card_name: cardName, owner, card_type: cardType, is_active: true }]).select();
    if (error) return { ok: false, error: error.message };
    updateCardsState((prev) => [...prev, data[0]]);
    return { ok: true };
  };

  // 목록에서만 숨김 (과거 정산 내역 보존)
  const hideCard = async (cardId) => {
    const { error } = await supabase.from('payment_cards').update({ is_active: false }).eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    updateCardsState((prev) => prev.map((c) => (c.id === cardId ? { ...c, is_active: false } : c)));
    return { ok: true };
  };

  return {
    allCards, cards, budgetLimit, nicknames, bgImageUrl, push, saveVapidPublicKey,
    addCard, hideCard, updateBudget, updateNicknames, uploadBackground, resetBackground,
    refreshSettings: fetchSettings,
  };
}
