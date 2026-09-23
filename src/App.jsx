import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
import DaySheet from './components/calendar/DaySheet';
import BottomNav from './components/common/BottomNav';
import PwaInstallManager from './components/common/PwaInstallManager';
import { useToast } from './components/common/Toast';
import ExpenseInputModal from './components/modal/ExpenseInputModal';
import SettingsModal from './components/modal/SettingsModal';
import RoleSelectModal from './components/modal/RoleSelectModal';
import SearchSheet from './components/search/SearchSheet';
import CardSettlementTab from './components/settlement/CardSettlementTab';
import StatisticsTab from './components/statistics/StatisticsTab';
import { useExpenses, useExpenseMutations } from './hooks/useExpenses';
import { useSettings } from './hooks/useSettings';
import { useHistory } from './hooks/useHistory';
import { useFavorites } from './hooks/useFavorites';
import { useSettlements } from './hooks/useSettlements';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useTheme } from './hooks/useTheme';
import { buildCardMap, settlementOwner } from './lib/settlement';
import { currentYearMonth, formatNumber, shiftYearMonth, toNumber } from './lib/format';
import { haptic } from './lib/haptic';
import { exportExpensesToCsv } from './utils/exportToCsv';

const readLocal = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeLocal = (key, v) => { try { localStorage.setItem(key, v); } catch { /* 무시 */ } };
const UNDO_MS = 4500;

export default function App() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [initialSms, setInitialSms] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [search, setSearch] = useState({ open: false, category: '' });
  const [viewMode, setViewMode] = useState(() => readLocal('buboo_view_mode') || 'calendar');
  const [role, setRole] = useState(() => readLocal('my_role'));
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  const [version, setVersion] = useState(0);
  const [pendingDeletes, setPendingDeletes] = useState(() => new Set());
  const myInsertIds = useRef(new Set());
  const deleteTimers = useRef(new Map());
  const focusProxy = useRef(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const settings = useSettings();
  const { allCards, cards, budgetLimit, nicknames } = settings;
  const cardMap = useMemo(() => buildCardMap(allCards), [allCards]);

  const { expenses: rawExpenses, prevMonthExpenses, isLoading, loadError, loadedMonth } = useExpenses(yearMonth, version);
  const { addExpense, updateExpense, deleteExpense } = useExpenseMutations({ onChanged: bump, myInsertIds });
  const { merchants } = useHistory(version);
  const favs = useFavorites();
  const settlements = useSettlements(version);

  // 삭제 대기 중(되돌리기 가능)인 내역은 화면에서 먼저 숨김
  const hide = useCallback((list) => (pendingDeletes.size ? list.filter((i) => !pendingDeletes.has(String(i.id))) : list), [pendingDeletes]);
  const expenses = useMemo(() => hide(rawExpenses), [hide, rawExpenses]);
  const unsettled = useMemo(() => hide(settlements.unsettled), [hide, settlements.unsettled]);
  const isStale = loadedMonth !== yearMonth;

  useRealtimeSync({ onChange: bump, myInsertIds, nicknames, toast });

  useEffect(() => { if (loadError) toast(`내역을 불러오지 못했어요: ${loadError}`, 'error'); }, [loadError, toast]);

  // 단축어/바로가기: ?sms=문자내용 또는 ?add=1 로 열면 입력 화면을 바로 띄움
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sms = params.get('sms');
    if (sms || params.get('add')) {
      if (sms) setInitialSms(sms);
      setEditTarget(null);
      setIsModalOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // 예산 80% / 100% 알림 (이번 달, 기기별 단계마다 한 번)
  useEffect(() => {
    const ym = currentYearMonth();
    if (isLoading || loadedMonth !== ym || yearMonth !== ym || !budgetLimit) return;
    const total = expenses.filter((e) => !e.is_income).reduce((a, c) => a + toNumber(c.amount), 0);
    const rate = (total / budgetLimit) * 100;
    const level = rate >= 100 ? 100 : rate >= 80 ? 80 : 0;
    const key = `buboo_budget_alert_${ym}`;
    const shown = Number(readLocal(key) || 0);
    if (level > shown) {
      toast(
        level === 100 ? `이번 달 예산을 ${formatNumber(total - budgetLimit)}원 넘었어요.` : `이번 달 예산의 ${Math.round(rate)}%를 썼어요. ${formatNumber(budgetLimit - total)}원 남았어요.`,
        'warning',
        { duration: 5000 },
      );
    }
    if (level !== shown) writeLocal(key, String(level));
  }, [expenses, budgetLimit, yearMonth, loadedMonth, isLoading, toast]);

  // 삭제: 바로 지우지 않고 4.5초 동안 되돌리기 가능
  const commitDelete = useCallback(async (item) => {
    const key = String(item.id);
    deleteTimers.current.delete(key);
    const res = await deleteExpense(item.id);
    if (!res.ok) toast(`삭제하지 못했어요: ${res.error}`, 'error');
    setTimeout(() => setPendingDeletes((prev) => { const n = new Set(prev); n.delete(key); return n; }), res.ok ? 1500 : 0);
  }, [deleteExpense, toast]);

  const handleDelete = useCallback((item) => {
    if (item.is_settled && !window.confirm(`이미 정산이 끝난 내역이에요.\n'${item.content}'을(를) 삭제하면 지난 정산 금액과 달라져요. 삭제할까요?`)) return;
    const key = String(item.id);
    haptic();
    setPendingDeletes((prev) => new Set(prev).add(key));
    const timer = setTimeout(() => commitDelete(item), UNDO_MS);
    deleteTimers.current.set(key, { timer, item });
    toast(`'${item.content}' 삭제했어요.`, 'info', {
      duration: UNDO_MS,
      action: {
        label: '되돌리기',
        onClick: () => {
          clearTimeout(timer);
          deleteTimers.current.delete(key);
          setPendingDeletes((prev) => { const n = new Set(prev); n.delete(key); return n; });
        },
      },
    });
  }, [commitDelete, toast]);

  // 앱을 내리거나 닫으면 대기 중인 삭제를 바로 처리
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      deleteTimers.current.forEach(({ timer, item }) => { clearTimeout(timer); commitDelete(item); });
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [commitDelete]);

  const handleMonthChange = (offset) => {
    const next = shiftYearMonth(yearMonth, offset);
    setYearMonth(next);
    setSelectedDate(next === currentYearMonth() ? new Date().getDate() : 1);
  };

  const defaultDate = useMemo(() => {
    if (currentTab !== 'calendar' && yearMonth === currentYearMonth()) {
      return `${yearMonth}-${String(new Date().getDate()).padStart(2, '0')}`;
    }
    const [y, m] = yearMonth.split('-').map(Number);
    return `${yearMonth}-${String(Math.min(selectedDate, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
  }, [currentTab, yearMonth, selectedDate]);

  const openExpenseModal = useCallback((item = null) => {
    const isNew = !(item && item.id);
    // 아이폰은 코드로 입력칸에 포커스를 줘도 키보드가 안 뜸 → 누른 순간 임시 입력칸에 포커스를 줘서 키보드를 먼저 띄움
    if (isNew) focusProxy.current?.focus({ preventScroll: true });
    setEditTarget(isNew ? null : item);
    setIsModalOpen(true);
  }, []);

  const handleExport = () => {
    const res = exportExpensesToCsv({ expenses, yearMonth, cardMap, nicknames });
    toast(res.ok ? `${res.count}건을 CSV로 내보냈어요.` : res.error, res.ok ? 'success' : 'warning');
  };

  const handleRoleChange = (next) => { setRole(next); writeLocal('my_role', next); };

  const hasUnsettled = useMemo(() => unsettled.some((i) => settlementOwner(i, cardMap)), [unsettled, cardMap]);
  const selectedYmd = `${yearMonth}-${String(selectedDate).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-app flex flex-col relative max-w-[430px] mx-auto overflow-hidden">
      <input
        ref={focusProxy}
        aria-hidden="true"
        tabIndex={-1}
        inputMode="numeric"
        className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none text-base"
        readOnly
      />
      <main className="flex-1 flex flex-col overflow-x-hidden relative">
        {currentTab === 'calendar' && (
          <CalendarHome
            expenses={expenses}
            isStale={isStale}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
            bgImageUrl={settings.bgImageUrl}
            cardMap={cardMap}
            selectedDate={selectedDate}
            onSelectDate={(day) => { setSelectedDate(day); setIsDayOpen(true); }}
            yearMonth={yearMonth}
            onPrevMonth={() => handleMonthChange(-1)}
            onNextMonth={() => handleMonthChange(1)}
            onEditExpense={openExpenseModal}
            onDeleteExpense={handleDelete}
            onOpenSearch={() => setSearch({ open: true, category: '' })}
            onExport={handleExport}
            viewMode={viewMode}
            installBanner={<PwaInstallManager />}
            onViewModeChange={(m) => { setViewMode(m); writeLocal('buboo_view_mode', m); }}
          />
        )}
        {currentTab === 'statistics' && (
          <StatisticsTab
            expenses={expenses}
            prevMonthExpenses={prevMonthExpenses}
            isStale={isStale}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
            yearMonth={yearMonth}
            onPrevMonth={() => handleMonthChange(-1)}
            onNextMonth={() => handleMonthChange(1)}
            onCategoryClick={(category) => setSearch({ open: true, category })}
          />
        )}
        {currentTab === 'settlement' && (
          <CardSettlementTab
            expenses={expenses}
            allCards={allCards}
            cardMap={cardMap}
            nicknames={nicknames}
            yearMonth={yearMonth}
            unsettled={unsettled}
            history={settlements.history}
            historyAvailable={settlements.historyAvailable}
            onSettle={settlements.settle}
            onUndoSettlement={settlements.undoSettlement}
            onChanged={bump}
            onEditExpense={openExpenseModal}
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenModal={() => openExpenseModal(null)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settlementBadge={hasUnsettled}
      />

      <DaySheet
        isOpen={isDayOpen}
        onClose={() => setIsDayOpen(false)}
        ymd={selectedYmd}
        expenses={expenses}
        nicknames={nicknames}
        cardMap={cardMap}
        onEdit={openExpenseModal}
        onDelete={handleDelete}
        onAdd={() => { setIsDayOpen(false); openExpenseModal(null); }}
      />

      <SearchSheet
        isOpen={search.open}
        initialCategory={search.category}
        onClose={() => setSearch({ open: false, category: '' })}
        monthExpenses={expenses}
        yearMonth={yearMonth}
        cardMap={cardMap}
        nicknames={nicknames}
        onEdit={openExpenseModal}
        onDelete={handleDelete}
        hiddenIds={pendingDeletes}
        version={version}
      />

      <ExpenseInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addExpense}
        onUpdate={updateExpense}
        onDelete={handleDelete}
        editTarget={editTarget}
        currentUserRole={role || 'husband'}
        cards={cards}
        cardMap={cardMap}
        nicknames={nicknames}
        defaultDate={defaultDate}
        merchants={merchants}
        favorites={favs.favorites}
        favoritesAvailable={favs.isAvailable}
        onAddFavorite={favs.addFavorite}
        initialSms={initialSms}
        onInitialSmsUsed={() => setInitialSms(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cards={cards}
        budgetLimit={budgetLimit}
        nicknames={nicknames}
        bgImageUrl={settings.bgImageUrl}
        currentUserRole={role || 'husband'}
        onRoleChange={handleRoleChange}
        theme={theme}
        onThemeChange={setTheme}
        onAddCard={settings.addCard}
        onHideCard={settings.hideCard}
        onUpdateBudget={settings.updateBudget}
        onUpdateNicknames={settings.updateNicknames}
        onUploadBackground={settings.uploadBackground}
        onResetBackground={settings.resetBackground}
        favorites={favs.favorites}
        favoritesAvailable={favs.isAvailable}
        onRemoveFavorite={favs.removeFavorite}
      />

      {!role && <RoleSelectModal nicknames={nicknames} onSelect={handleRoleChange} />}
    </div>
  );
}
