import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Merge, Search, Sparkles } from 'lucide-react';
import { HelpTitle } from '../common/Help';
import { supabase } from '../../lib/supabase';
import { useToast } from '../common/Toast';
import { editDistance, squash } from '../../lib/quickParse';
import { formatNumber, toNumber } from '../../lib/format';
import { guessCategory } from '../../lib/autoCategory';
import { normalizeCategory } from '../../constants/categories';

// 비슷한 이름 묶기: 띄어쓰기·대소문자만 다름 / 한쪽이 다른 쪽을 포함("이마트" ⊂ "이마트 성수점") / 한 글자 차이
function similarGroups(list) {
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const keys = list.map((m) => squash(m.name));
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (list[i].income !== list[j].income) continue;
      const a = keys[i];
      const b = keys[j];
      if (!a || !b) continue;
      const short = a.length <= b.length ? a : b;
      const long = a.length <= b.length ? b : a;
      if (a === b
        || (short.length >= 2 && long.startsWith(short))
        || (short.length >= 3 && editDistance(a, b) <= 1)) union(i, j);
    }
  }
  const groups = new Map();
  list.forEach((m, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(m);
  });
  // 남길 이름 기본값: 다른 이름들의 앞부분인 '기본 이름'("이마트") → 없으면 가장 많이 쓴 이름
  return [...groups.values()].filter((g) => g.length > 1).map((g) => {
    const sorted = g.sort((x, y) => y.count - x.count);
    const base = sorted.find((m) => sorted.every((o) => squash(o.name).startsWith(squash(m.name))));
    return base ? [base, ...sorted.filter((m) => m !== base)] : sorted;
  });
}

export default function MerchantManager({ onChanged }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [finalName, setFinalName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('expenses').select('id, content, amount, is_income, category').limit(10000);
    if (error) { toast(`불러오지 못했어요: ${error.message}`, 'error'); return; }
    setRows(data || []);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // 이름별 횟수·합계
  const names = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((r) => {
      const name = String(r.content || '').trim();
      if (!name) return;
      const key = `${r.is_income ? 'I' : 'E'}|${name}`;
      if (!map.has(key)) map.set(key, { name, income: !!r.is_income, count: 0, total: 0 });
      const m = map.get(key);
      m.count += 1;
      m.total += toNumber(r.amount);
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  const suggestions = useMemo(
    () => similarGroups(names).filter((g) => !dismissed.has(g.map((m) => m.name).join('|'))).slice(0, 12),
    [names, dismissed],
  );
  const [picked, setPicked] = useState({}); // 제안 묶음별로 고른 최종 이름

  // '기타'(또는 지금 목록에 없는 옛 카테고리)로 들어간 내역 중 이름으로 분류할 수 있는 것
  const [skipFix, setSkipFix] = useState(() => new Set());
  const fixable = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((r) => {
      const name = String(r.content || '').trim();
      if (!name) return;
      const income = !!r.is_income;
      const now = normalizeCategory(r.category, income);
      if (now !== (income ? '기타 수입' : '기타')) return;
      const guess = guessCategory(name, { income });
      if (!guess || guess === now) return;
      const key = `${income ? 'I' : 'E'}|${name}`;
      if (!map.has(key)) map.set(key, { key, name, income, guess, rows: [] });
      map.get(key).rows.push({ id: r.id, category: r.category });
    });
    return [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [rows]);
  const fixTargets = fixable.filter((f) => !skipFix.has(f.key));
  const fixCount = fixTargets.reduce((n, f) => n + f.rows.length, 0);

  const applyFix = async () => {
    if (!fixTargets.length) return;
    setBusy(true);
    const byCat = new Map();
    fixTargets.forEach((f) => { if (!byCat.has(f.guess)) byCat.set(f.guess, []); byCat.get(f.guess).push(...f.rows.map((r) => r.id)); });
    const results = await Promise.all([...byCat.entries()].map(([category, ids]) => supabase.from('expenses').update({ category }).in('id', ids)));
    setBusy(false);
    const err = results.find((r) => r.error)?.error;
    if (err) { toast(`실패: ${err.message}`, 'error'); load(); return; }
    // 되돌리기: 원래 카테고리별로 id 기억
    const before = new Map();
    fixTargets.forEach((f) => f.rows.forEach((r) => { const c = r.category ?? '기타'; if (!before.has(c)) before.set(c, []); before.get(c).push(r.id); }));
    toast(`${fixCount}건을 자동 분류했어요.`, 'success', {
      duration: 7000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          await Promise.all([...before.entries()].map(([category, ids]) => supabase.from('expenses').update({ category }).in('id', ids)));
          toast('원래대로 되돌렸어요.', 'info');
          load(); onChanged?.();
        },
      },
    });
    setSkipFix(new Set());
    load(); onChanged?.();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? names.filter((m) => m.name.toLowerCase().includes(q)) : names;
  }, [names, query]);

  const toggle = (name) => setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  // 실제 합치기: 바꿀 이름들의 내역 id를 먼저 기억 → 되돌리기 가능
  const merge = async (fromNames, target) => {
    const to = target.trim();
    const sources = fromNames.filter((n) => n !== to);
    if (!to || !sources.length) return;
    if (!window.confirm(`${sources.map((n) => `'${n}'`).join(', ')} 내역을 모두 '${to}'(으)로 바꿀까요?`)) return;
    setBusy(true);
    const { data: affected, error: e1 } = await supabase.from('expenses').select('id, content').in('content', sources);
    if (e1) { setBusy(false); toast(`실패: ${e1.message}`, 'error'); return; }
    const ids = (affected || []).map((r) => r.id);
    const { error: e2 } = ids.length ? await supabase.from('expenses').update({ content: to }).in('id', ids) : { error: null };
    setBusy(false);
    if (e2) { toast(`실패: ${e2.message}`, 'error'); return; }
    const byName = new Map();
    (affected || []).forEach((r) => { if (!byName.has(r.content)) byName.set(r.content, []); byName.get(r.content).push(r.id); });
    toast(`${ids.length}건을 '${to}'(으)로 합쳤어요.`, 'success', {
      duration: 7000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          await Promise.all([...byName.entries()].map(([name, list]) => supabase.from('expenses').update({ content: name }).in('id', list)));
          toast('원래 이름으로 되돌렸어요.', 'info');
          load(); onChanged?.();
        },
      },
    });
    setSelected([]); setFinalName('');
    load(); onChanged?.();
  };

  if (!rows) return <p className="py-10 text-center text-[14px] text-muted">불러오는 중…</p>;

  const chip = (on) => `h-9 px-3 rounded-full text-[13px] font-semibold border ${on ? 'bg-ink text-card border-ink' : 'bg-card text-ink2 border-line'}`;

  return (
    <div className="space-y-6 py-5">
      {fixable.length > 0 && (
        <section>
          <HelpTitle className="text-[15px] font-bold text-ink" help="이름을 보고 카테고리를 찾았어요. 아닌 건 눌러서 빼고 분류하세요. 분류한 뒤에도 되돌릴 수 있어요.">'기타'로 들어간 내역 자동 분류</HelpTitle>
          <div className="rounded-2xl border border-line overflow-hidden max-h-[300px] overflow-y-auto overscroll-contain">
            {fixable.map((f) => {
              const on = !skipFix.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSkipFix((prev) => { const n = new Set(prev); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left border-b border-line last:border-0 ${on ? '' : 'opacity-45'}`}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-ink border-ink text-card' : 'border-line'}`}>{on && <Check size={13} />}</span>
                  <span className="flex-1 min-w-0 text-[14px] font-semibold text-ink truncate">{f.name} <span className="text-[12px] font-medium text-muted num">{f.rows.length}건</span></span>
                  <span className="shrink-0 text-[12px] font-bold text-ink2 bg-fill rounded-full px-2.5 py-1">{f.guess}</span>
                </button>
              );
            })}
          </div>
          <button type="button" disabled={busy || !fixCount} onClick={applyFix} className="mt-2 w-full h-11 rounded-xl bg-ink text-card text-[14px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Sparkles size={15} /> {fixCount}건 한 번에 분류하기
          </button>
        </section>
      )}

      <section>
        <HelpTitle className="text-[15px] font-bold text-ink" help="같은 곳인데 이름이 흩어져 있으면 통계와 추천이 정확하지 않아요. 묶음마다 남길 이름을 누르고 합치세요. 합친 뒤에도 되돌릴 수 있어요.">비슷한 이름 합치기 제안</HelpTitle>
        {suggestions.length === 0 ? (
          <p className="text-[14px] text-muted rounded-2xl bg-fill p-4">비슷한 이름이 없어요. 아래에서 직접 골라 합칠 수도 있어요.</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((g) => {
              const key = g.map((m) => m.name).join('|');
              const target = picked[key] || g[0].name;
              return (
                <div key={key} className="rounded-2xl border border-line p-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {g.map((m) => (
                      <button key={m.name} type="button" onClick={() => setPicked((p) => ({ ...p, [key]: m.name }))} className={chip(target === m.name)}>
                        {target === m.name && <Check size={13} className="inline -mt-0.5 mr-0.5" />}{m.name} <span className="opacity-60 num">{m.count}건</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" disabled={busy} onClick={() => merge(g.map((m) => m.name), target)} className="flex-1 h-10 rounded-xl bg-ink text-card text-[14px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Merge size={15} /> '{target}'(으)로 합치기
                    </button>
                    <button type="button" onClick={() => setDismissed((d) => new Set(d).add(key))} className="h-10 px-3 rounded-xl bg-fill text-[13px] font-semibold text-muted">다른 곳이에요</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <HelpTitle className="text-[15px] font-bold text-ink" help={'"emart"와 "이마트"처럼 자동으로 못 찾는 이름을 두 개 이상 골라서 합쳐요.'}>직접 골라 합치기</HelpTitle>
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="사용처 검색" className="w-full h-11 bg-fill rounded-xl pl-9 pr-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-husband" aria-label="사용처 검색" />
        </div>
        <div className="rounded-2xl border border-line overflow-hidden max-h-[320px] overflow-y-auto overscroll-contain">
          {filtered.slice(0, 200).map((m) => {
            const on = selected.includes(m.name);
            return (
              <button key={`${m.income}|${m.name}`} type="button" onClick={() => toggle(m.name)} aria-pressed={on} className={`w-full px-4 py-2.5 flex items-center gap-3 text-left border-b border-line last:border-0 ${on ? 'bg-fill' : ''}`}>
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-ink border-ink text-card' : 'border-line'}`}>{on && <Check size={13} />}</span>
                <span className="flex-1 min-w-0 text-[14px] font-semibold text-ink truncate">{m.name}{m.income && <span className="ml-1 text-[12px] text-income">수입</span>}</span>
                <span className="text-[12px] text-muted num shrink-0">{m.count}건 · {formatNumber(m.total)}원</span>
              </button>
            );
          })}
          {!filtered.length && <p className="p-4 text-[14px] text-muted">찾는 이름이 없어요.</p>}
        </div>

        {selected.length >= 2 && (
          <div className="mt-3 rounded-2xl bg-fill p-3.5 space-y-2 animate-fade-in">
            <p className="text-[13px] text-ink2">{selected.length}개를 어떤 이름으로 합칠까요?</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((n) => (
                <button key={n} type="button" onClick={() => setFinalName(n)} className={chip((finalName || selected[0]) === n)}>{n}</button>
              ))}
            </div>
            <input value={finalName} onChange={(e) => setFinalName(e.target.value)} placeholder={`또는 새 이름 입력 (기본: ${selected[0]})`} className="w-full h-11 bg-card rounded-xl px-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-husband" aria-label="합칠 이름" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => merge(selected, finalName || selected[0])} className="flex-1 h-11 rounded-xl bg-ink text-card text-[14px] font-bold disabled:opacity-50">합치기</button>
              <button type="button" onClick={() => { setSelected([]); setFinalName(''); }} className="h-11 px-4 rounded-xl bg-card border border-line text-[14px] font-semibold text-ink2">선택 해제</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
