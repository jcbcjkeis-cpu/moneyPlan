import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatWon } from '../lib/format';

// 앱 전체에서 한 번만 구독: 배우자의 추가/수정/삭제/정산을 모든 탭에 반영
export function useRealtimeSync({ onChange, myInsertIds, nicknames, toast }) {
  const latest = useRef({ onChange, nicknames, toast });
  latest.current = { onChange, nicknames, toast };

  useEffect(() => {
    let debounce = null;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => latest.current.onChange(), 300);
    };

    const channel = supabase
      .channel('buboo_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        refresh();
        if (payload.eventType !== 'INSERT') return;
        const row = payload.new;
        // 내 insert 응답보다 알림이 먼저 올 수 있어 잠깐 기다렸다가 확인
        setTimeout(() => {
          if (myInsertIds.current.has(String(row.id))) return;
          const { nicknames: n, toast: show } = latest.current;
          const who = row.payer === 'husband' ? n.husband : n.wife;
          const sign = row.is_income ? '+' : '-';
          show(`${who} · ${row.content || (row.is_income ? '수입' : '지출')} ${sign}${formatWon(row.amount)} 등록`, 'info');
        }, 1200);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, refresh)
      .subscribe();

    return () => { clearTimeout(debounce); supabase.removeChannel(channel); };
  }, [myInsertIds]);
}
