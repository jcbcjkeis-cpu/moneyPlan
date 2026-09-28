import React, { useMemo, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, List, Search } from 'lucide-react';
import ExpenseItem from '../expense/ExpenseItem';
import ExpenseList from '../expense/ExpenseList';
import { currentYearMonth, formatNumber, formatShort, toNumber, toYmd } from '../../lib/format';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function budgetMessage({ yearMonth, total, budget, daysInMonth }) {
  const cur = currentYearMonth();
  const remaining = budget - total;
  if (yearMonth === cur) {
    if (remaining <= 0) return { text: `예산을 ${formatNumber(-remaining)}원 넘었어요`, tone: 'over' };
    const left = daysInMonth - new Date().getDate() + 1;
    return { text: `남은 ${left}일 동안 하루 ${formatNumber(Math.floor(remaining / left))}원씩 쓸 수 있어요`, tone: 'ok' };
  }
  if (yearMonth > cur) return { text: `하루 ${formatNumber(Math.floor(budget / daysInMonth))}원 꼴이에요`, tone: 'ok' };
  return remaining >= 0
    ? { text: `예산보다 ${formatNumber(remaining)}원 아꼈어요`, tone: 'ok' }
    : { text: `예산보다 ${formatNumber(-remaining)}원 더 썼어요`, tone: 'over' };
}

export default function CalendarHome({
  expenses = [], isStale, budgetLimit, nicknames, bgImageUrl, cardMap,
  selectedDate, onSelectDate, yearMonth, onPrevMonth, onNextMonth,
  onEditExpense, onDeleteExpense, onOpenSearch, onExport, viewMode, onViewModeChange, installBanner,
}) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const todayYmd = toYmd(new Date());
  const touch = useRef(null);

  const totalExpense = useMemo(() => expenses.filter((e) => !e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [expenses]);
  const totalIncome = useMemo(() => expenses.filter((e) => e.is_income).reduce((a, c) => a + toNumber(c.amount), 0), [expenses]);
  const realRate = budgetLimit > 0 ? Math.round((totalExpense / budgetLimit) * 100) : 0;
  const gauge = realRate >= 100 ? 'bg-rose-400' : realRate >= 80 ? 'bg-amber-300' : 'bg-white';
  const msg = budgetMessage({ yearMonth, total: totalExpense, budget: budgetLimit, daysInMonth });

  const dailyMap = useMemo(() => {
    const map = {};
    expenses.forEach((ex) => {
      if (!ex.expense_date) return;
      const day = Number(ex.expense_date.split('-')[2]);
      if (!map[day]) map[day] = { expense: 0, income: 0, husband: false, wife: false };
      if (ex.is_income) map[day].income += toNumber(ex.amount);
      else map[day].expense += toNumber(ex.amount);
      if (ex.payer === 'husband') map[day].husband = true;
      if (ex.payer === 'wife') map[day].wife = true;
    });
    return map;
  }, [expenses]);

  const recent = useMemo(
    () => [...expenses].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 3),
    [expenses],
  );

  // 달력을 좌우로 밀어서 달 이동
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onNextMonth : onPrevMonth)();
  };

  const heroBtn = 'w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition';
  const skeleton = (w) => <span className={`inline-block h-[1em] ${w} rounded-md bg-white/30 animate-shimmer align-middle`} />;

  return (
    <div className="flex flex-col w-full min-h-screen pb-28 bg-app">
      {/* 배경 사진은 이 영역에만: 글씨 대비를 위해 어두운 그라데이션 */}
      <section className="relative overflow-hidden rounded-b-[32px]">
        <img src={bgImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        <div className="relative pt-safe">
          <header className="flex items-center justify-between px-3 pt-2">
            <div className="flex items-center">
              <button type="button" onClick={onPrevMonth} className={heroBtn} aria-label="이전 달"><ChevronLeft size={22} /></button>
              <h1 className="text-[17px] font-bold text-white px-1.5 min-w-[96px] text-center num">{year}년 {month}월</h1>
              <button type="button" onClick={onNextMonth} className={heroBtn} aria-label="다음 달"><ChevronRight size={22} /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onViewModeChange(viewMode === 'calendar' ? 'list' : 'calendar')} className={heroBtn} aria-label={viewMode === 'calendar' ? '리스트로 보기' : '달력으로 보기'}>
                {viewMode === 'calendar' ? <List size={20} /> : <CalendarDays size={20} />}
              </button>
              <button type="button" onClick={onOpenSearch} className={heroBtn} aria-label="내역 검색"><Search size={20} /></button>
              <button type="button" onClick={onExport} className={heroBtn} aria-label="이번 달 CSV로 내보내기"><Download size={20} /></button>
            </div>
          </header>

          <div className="px-6 pt-5 pb-7 text-white">
            <p className="text-[14px] text-white/75">이번 달 지출</p>
            <p className="text-[34px] leading-tight font-extrabold num mt-0.5">
              {isStale ? skeleton('w-40') : <>{formatNumber(totalExpense)}<span className="text-[18px] font-semibold text-white/75 ml-1">원</span></>}
            </p>
            <p className={`text-[14px] font-semibold mt-1 ${msg.tone === 'over' ? 'text-rose-300' : 'text-white/90'}`}>
              {isStale ? skeleton('w-56') : msg.text}
            </p>
            <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden" role="progressbar" aria-valuenow={realRate} aria-valuemin={0} aria-valuemax={100} aria-label="예산 사용률">
              <div className={`h-full rounded-full transition-all duration-500 ${gauge}`} style={{ width: `${isStale ? 0 : Math.min(realRate, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[13px] text-white/75 num">
              <span>예산 {formatNumber(budgetLimit)}원 중 {realRate}%</span>
              <span>수입 +{formatNumber(totalIncome)}원</span>
            </div>
          </div>
        </div>
      </section>

      {viewMode === 'calendar' ? (
        <>
          <section className="px-3 pt-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="bg-card rounded-3xl p-2.5 border border-line">
              <div className="grid grid-cols-7 text-center py-1.5 text-[12px] font-semibold">
                {WEEK.map((w, i) => (
                  <span key={w} className={i === 0 ? 'text-wife' : i === 6 ? 'text-husband' : 'text-muted'}>{w}</span>
                ))}
              </div>
              {/* 칸 높이는 내용에 맞춰 늘어나고(auto-rows-fr로 모든 줄 높이 통일), 점은 글자 아래에 배치 → 겹침 없음 */}
              <div key={yearMonth} className="grid grid-cols-7 gap-x-0.5 gap-y-1 auto-rows-fr animate-fade-in">
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => <div key={`e-${idx}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const d = isStale ? null : dailyMap[day];
                  const isSelected = selectedDate === day;
                  const dow = (firstDayOfWeek + day - 1) % 7;
                  const isToday = `${yearMonth}-${String(day).padStart(2, '0')}` === todayYmd;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => onSelectDate(day)}
                      aria-label={`${month}월 ${day}일${d?.expense ? `, 지출 ${formatNumber(d.expense)}원` : ''}${d?.income ? `, 수입 ${formatNumber(d.income)}원` : ''}`}
                      className={`min-w-0 min-h-[62px] flex flex-col items-center pt-1 pb-1.5 rounded-xl transition ${isSelected ? 'bg-fill' : 'active:bg-fill'}`}
                    >
                      <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-[13px] font-semibold ${isToday ? 'bg-ink text-card' : dow === 0 ? 'text-wife' : dow === 6 ? 'text-husband' : 'text-ink2'}`}>{day}</span>
                      <span className="w-full flex flex-col items-center leading-[1.2] num mt-0.5">
                        {d?.expense > 0 && <span className="max-w-full truncate text-[11px] font-semibold text-ink2 tracking-tight">-{formatShort(d.expense)}</span>}
                        {d?.income > 0 && <span className="max-w-full truncate text-[11px] font-semibold text-income tracking-tight">+{formatShort(d.income)}</span>}
                      </span>
                      {(d?.husband || d?.wife) && (
                        <span className="flex gap-1 mt-auto pt-1" aria-hidden="true">
                          {d.husband && <span className="w-1 h-1 rounded-full bg-husband" />}
                          {d.wife && <span className="w-1 h-1 rounded-full bg-wife" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-[12px] text-muted mt-2">날짜를 누르면 내역, 좌우로 밀면 다른 달</p>
          </section>

          {installBanner}

          {recent.length > 0 && (
            <section className="px-4 pt-5">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[15px] font-bold text-ink">최근 입력</h3>
                <button type="button" onClick={() => onViewModeChange('list')} className="h-9 px-2 text-[14px] font-semibold text-husband">전체 보기</button>
              </div>
              <div className="space-y-2">
                {recent.map((item) => (
                  <ExpenseItem key={item.id} item={item} nicknames={nicknames} cardMap={cardMap} onEdit={onEditExpense} onDelete={onDeleteExpense} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="px-4 pt-4">
          {isStale ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-card border border-line animate-shimmer" />)}</div>
          ) : (
            <ExpenseList
              items={expenses}
              nicknames={nicknames}
              cardMap={cardMap}
              onEdit={onEditExpense}
              onDelete={onDeleteExpense}
              emptyText={`${month}월에 등록된 내역이 없어요. 아래 + 버튼으로 추가해보세요.`}
            />
          )}
        </section>
      )}
    </div>
  );
}
