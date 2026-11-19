import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, normalizeCategory } from '../../constants/categories';
import { formatNumber, onlyDigits, toNumber } from '../../lib/format';
import ExpenseList from '../expense/ExpenseList';

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const isAmountQuery = (q) => { const d = onlyDigits(q); return d.length > 0 && d === q.replace(/[,\s원]/g, ''); };

function matches(item, q, category) {
  if (category && normalizeCategory(item.category, item.is_income) !== category) return false;
  if (!q) return true;
  if ((item.content || '').toLowerCase().includes(q.toLowerCase())) return true;
  return isAmountQuery(q) && String(Math.round(toNumber(item.amount))) === onlyDigits(q);
}

export default function SearchSheet({ isOpen, onClose, monthExpenses, yearMonth, cardMap, nicknames, onEdit, onDelete, initialCategory, version, hiddenIds }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('month');
  const [remote, setRemote] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const month = Number(yearMonth.split('-')[1]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setCategory(initialCategory || '');
    setScope('month');
    setQuery('');
    if (!initialCategory) setTimeout(() => inputRef.current?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, initialCategory]);

  useEffect(() => {
    if (!isOpen || scope !== 'all') return undefined;
    const q = query.trim();
    if (!q && !category) { setRemote([]); return undefined; }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      let req = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(300);
      const safe = q.replace(/[%,()*]/g, '');
      if (safe) req = isAmountQuery(q) ? req.or(`content.ilike.%${safe}%,amount.eq.${onlyDigits(q)}`) : req.ilike('content', `%${safe}%`);
      const { data, error } = await req;
      setIsLoading(false);
      if (!error) setRemote((data || []).filter((i) => matches(i, '', category)));
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, scope, query, category, version]);

  const results = useMemo(() => {
    const list = scope === 'all' ? remote : monthExpenses.filter((i) => matches(i, query.trim(), category));
    return hiddenIds?.size ? list.filter((i) => !hiddenIds.has(String(i.id))) : list;
  }, [scope, remote, monthExpenses, query, category, hiddenIds]);
  const totals = useMemo(() => results.reduce((acc, i) => {
    if (i.is_income) acc.income += toNumber(i.amount); else acc.expense += toNumber(i.amount);
    return acc;
  }, { expense: 0, income: 0 }), [results]);

  if (!isOpen) return null;
  const hasFilter = query.trim() || category;
  const chip = (active) => `shrink-0 h-9 px-3.5 rounded-full text-[14px] font-semibold border ${active ? 'bg-ink text-card border-ink' : 'bg-card text-ink2 border-line'}`;

  return (
    <div className="fixed inset-0 z-50 bg-app flex flex-col max-w-[430px] mx-auto animate-fade-in" role="dialog" aria-modal="true" aria-label="내역 검색">
      <div className="bg-card border-b border-line pt-safe">
        <div className="flex items-center gap-1 px-2 pt-2">
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center text-ink" aria-label="검색 닫기"><ChevronLeft size={24} /></button>
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사용처나 금액 검색"
              className="w-full h-11 bg-fill rounded-xl pl-10 pr-3 text-base font-semibold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-husband"
              aria-label="검색어"
            />
          </div>
        </div>
        <div className="px-4 pt-3">
          <div className="flex bg-fill p-1 rounded-full">
            <button type="button" onClick={() => setScope('month')} className={`flex-1 h-9 rounded-full text-[14px] font-bold ${scope === 'month' ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>{month}월만</button>
            <button type="button" onClick={() => setScope('all')} className={`flex-1 h-9 rounded-full text-[14px] font-bold ${scope === 'all' ? 'bg-card text-ink shadow-xs' : 'text-muted'}`}>전체 기간</button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          <button type="button" onClick={() => setCategory('')} className={chip(!category)}>전체</button>
          {ALL_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c === category ? '' : c)} className={chip(category === c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-safe">
        {scope === 'all' && !hasFilter ? (
          <p className="py-12 text-center text-[14px] text-muted">검색어를 입력하거나 카테고리를 골라주세요.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between px-1 mb-3 num">
              <span className="text-[14px] font-semibold text-muted">{isLoading ? '검색 중…' : `${results.length}건`}</span>
              <span className="text-[15px] font-bold text-ink">
                {totals.expense > 0 && `지출 ${formatNumber(totals.expense)}원`}
                {totals.income > 0 && <span className="text-income ml-2">수입 {formatNumber(totals.income)}원</span>}
              </span>
            </div>
            <ExpenseList items={results} nicknames={nicknames} cardMap={cardMap} onEdit={onEdit} onDelete={onDelete} emptyText="조건에 맞는 내역이 없어요." />
            {scope === 'all' && results.length >= 300 && <p className="text-center text-[13px] text-muted mt-4">최근 300건까지만 보여요. 검색어를 더 구체적으로 입력해보세요.</p>}
          </>
        )}
      </div>
    </div>
  );
}
