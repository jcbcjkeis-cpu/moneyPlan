import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, normalizeCategory } from '../../constants/categories';
import { formatNumber, onlyDigits, toNumber } from '../../lib/format';
import ExpenseList from '../expense/ExpenseList';

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function matches(item, q, category) {
  if (category && normalizeCategory(item.category, item.is_income) !== category) return false;
  if (!q) return true;
  const digits = onlyDigits(q);
  const text = (item.content || '').toLowerCase();
  if (text.includes(q.toLowerCase())) return true;
  return digits.length > 0 && digits === q.replace(/[,\s원]/g, '') && String(Math.round(toNumber(item.amount))) === digits;
}

export default function SearchSheet({ isOpen, onClose, monthExpenses, yearMonth, cardMap, nicknames, onEdit, initialCategory, version }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('month'); // month | all
  const [remote, setRemote] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const month = Number(yearMonth.split('-')[1]);

  useEffect(() => {
    if (!isOpen) return;
    setCategory(initialCategory || '');
    setScope('month');
    setQuery('');
    if (!initialCategory) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, initialCategory]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // 전체 기간 검색은 DB에서 (최근 300건)
  useEffect(() => {
    if (!isOpen || scope !== 'all') return undefined;
    const q = query.trim();
    if (!q && !category) { setRemote([]); return undefined; }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      let req = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(300);
      const safe = q.replace(/[%,()*]/g, '');
      const digits = onlyDigits(q);
      if (safe) {
        req = digits && digits === q.replace(/[,\s원]/g, '')
          ? req.or(`content.ilike.%${safe}%,amount.eq.${digits}`)
          : req.ilike('content', `%${safe}%`);
      }
      const { data, error } = await req;
      setIsLoading(false);
      if (!error) setRemote((data || []).filter((i) => matches(i, '', category)));
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, scope, query, category, version]);

  const results = useMemo(() => {
    if (scope === 'all') return remote;
    return monthExpenses.filter((i) => matches(i, query.trim(), category));
  }, [scope, remote, monthExpenses, query, category]);

  const totals = useMemo(() => results.reduce((acc, i) => {
    if (i.is_income) acc.income += toNumber(i.amount); else acc.expense += toNumber(i.amount);
    return acc;
  }, { expense: 0, income: 0 }), [results]);

  if (!isOpen) return null;
  const hasFilter = query.trim() || category;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col max-w-[430px] mx-auto animate-fade-in" role="dialog" aria-modal="true" aria-label="내역 검색">
      <div className="bg-white border-b border-slate-200 px-4 pb-3 pt-safe space-y-2.5">
        <div className="flex items-center gap-2 pt-3">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="사용처나 금액 검색"
            className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="검색어"
          />
          <button type="button" onClick={onClose} className="px-2 py-2 text-sm font-bold text-slate-600">닫기</button>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button type="button" onClick={() => setScope('month')} className={`flex-1 py-1.5 text-xs font-black rounded-lg ${scope === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>{month}월만</button>
          <button type="button" onClick={() => setScope('all')} className={`flex-1 py-1.5 text-xs font-black rounded-lg ${scope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>전체 기간</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button type="button" onClick={() => setCategory('')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${!category ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>전체</button>
          {ALL_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c === category ? '' : c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${category === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-safe">
        {scope === 'all' && !hasFilter ? (
          <p className="py-10 text-center text-[13px] text-slate-500">검색어를 입력하거나 카테고리를 골라주세요.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between px-1 mb-3">
              <span className="text-[13px] font-bold text-slate-700">{isLoading ? '검색 중…' : `${results.length}건`}</span>
              <span className="text-[13px] font-black text-slate-900">
                {totals.expense > 0 && `지출 ${formatNumber(totals.expense)}원`}
                {totals.income > 0 && <span className="text-emerald-600 ml-2">수입 {formatNumber(totals.income)}원</span>}
              </span>
            </div>
            <ExpenseList items={results} nicknames={nicknames} cardMap={cardMap} onEdit={onEdit} emptyText="조건에 맞는 내역이 없어요." />
            {scope === 'all' && results.length >= 300 && <p className="text-center text-xs text-slate-500 mt-4">최근 300건까지만 보여요. 검색어를 더 구체적으로 입력해보세요.</p>}
          </>
        )}
      </div>
    </div>
  );
}
