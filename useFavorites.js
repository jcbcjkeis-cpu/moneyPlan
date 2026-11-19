import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true); // 테이블이 아직 없으면 false

  const fetchFavorites = useCallback(async () => {
    const { data, error } = await supabase.from('favorites').select('*').order('created_at', { ascending: true });
    if (error) { setIsAvailable(false); return; }
    setIsAvailable(true);
    setFavorites(data || []);
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const addFavorite = async (fav) => {
    const { data, error } = await supabase.from('favorites').insert([fav]).select();
    if (error) return { ok: false, error: error.message };
    setFavorites((prev) => [...prev, data[0]]);
    return { ok: true };
  };

  const removeFavorite = async (id) => {
    const { error } = await supabase.from('favorites').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    return { ok: true };
  };

  return { favorites, isAvailable, addFavorite, removeFavorite, refreshFavorites: fetchFavorites };
}
