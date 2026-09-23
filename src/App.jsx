import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalendarHome from './components/calendar/CalendarHome';
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
import { buildCardMap, settlementOwner } from './lib/settlement';
import { currentYearMonth, formatNumber, shiftYearMonth, toNumber } from './lib/format';
import { exportExpensesToCsv } from './utils/exportToCsv';

const readLocal = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeLocal = (key, v) => { try { localStorage.setItem(key, v); } catch { /* 무시 */ } };

export default function App() {
  const toast = useToast();
  const [currentTab, setCurrentTab] = useState('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [search, setSearch] = useState({ open: false, category: '' });
  const [viewMode, setViewMode] = useState(() => readLocal('buboo_view_mode') || 'calendar');
  const [role, setRole] = useState(() => readLocal('my_role')); // 처음이면 null → 선택 창
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());
  const [version, setVersion] = useState(0);
  const myInsertIds = useRef(new Set());

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const settings = useSettings();
  const { allCards, cards, budgetLimit, nicknames } = settings;
  const cardMap = useMemo(() => buildCardMap(allCards), [allCards]);

  const { expenses, prevMonthExpenses, isLoading, loadError, loadedMonth } = useExpenses(yearMonth, version);
  const { addExpense, updateExpense, deleteExpense } = useExpenseMutations({ onChanged: bump, myInsertIds });
  const { merchants } = useHistory(version);
  const favs = useFavorites();
  const settlements = useSettlements(version);

  useRealtimeSync({ onChange: bump, myInsertIds, nicknames, toast });

  useEffect(() => { if (loadError) toast(`내역을 불러오지 못했어요: ${loadError}`, 'error'); }, [loadError, toast]);

  // 예산 80% / 100% 알림 (이번 달, 기기별로 단계마다 한 번)
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
        level === 100
          ? `🚨 이번 달 예산을 ${formatNumber(total - budgetLimit)}원 넘었어요.`
          : `⚠️ 이번 달 예산의 ${Math.round(rate)}%를 썼어요. ${formatNumber(budgetLimit - total)}원 남았어요.`,
        'warning',
        { duration: 5000 },
      );
    }
    if (level !== shown) writeLocal(key, String(level)); // 예산을 올리거나 내역을 지우면 다시 알릴 수 있도록
  }, [expenses, budgetLimit, yearMonth, loadedMonth, isLoading, toast]);

  const handleMonthChange = (offset) => {
    const next = shiftYearMonth(yearMonth, offset);
    setYearMonth(next);
    setSelectedDate(next === currentYearMonth() ? new Date().getDate() : 1);
  };

  const defaultDate = useMemo(() => {
    const today = new Date();
    if (currentTab !== 'calendar' && yearMonth === currentYearMonth()) {
      return `${yearMonth}-${String(today.getDate()).padStart(2, '0')}`;
    }
    const [y, m] = yearMonth.split('-').map(Number);
    const day = Math.min(selectedDate, new Date(y, m, 0).getDate());
    return `${yearMonth}-${String(day).padStart(2, '0')}`;
  }, [currentTab, yearMonth, selectedDate]);

  const openExpenseModal = useCallback((item = null) => {
    setEditTarget(item && item.id ? item : null);
    setIsModalOpen(true);
  }, []);

  const handleDelete = async (item) => {
    const msg = item.is_settled
      ? `⚠️ 이미 정산이 끝난 내역이에요.\n'${item.content}'을(를) 삭제하면 지난 정산 금액과 달라져요. 삭제할까요?`
      : `'${item.content}' ${formatNumber(item.amount)}원을 삭제할까요?`;
    if (!window.confirm(msg)) return;
    const res = await deleteExpense(item.id);
    toast(res.ok ? '삭제했어요.' : `삭제하지 못했어요: ${res.error}`, res.ok ? 'success' : 'error');
  };

  const handleExport = () => {
    const res = exportExpensesToCsv({ expenses, yearMonth, cardMap, nicknames });
    toast(res.ok ? `${res.count}건을 CSV로 내보냈어요.` : res.error, res.ok ? 'success' : 'warning');
  };

  const handleRoleChange = (next) => {
    setRole(next);
    writeLocal('my_role', next);
  };

  const hasUnsettled = useMemo(
    () => settlements.unsettled.some((i) => settlementOwner(i, cardMap)),
    [settlements.unsettled, cardMap],
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col relative max-w-[430px] mx-auto shadow-2xl overflow-hidden">
      <PwaInstallManager />
      <main className="flex-1 bg-slate-50 flex flex-col overflow-x-hidden relative">
        {currentTab === 'calendar' && (
          <CalendarHome
            expenses={expenses}
            budgetLimit={budgetLimit}
            nicknames={nicknames}
            bgImageUrl={settings.bgImageUrl}
            cardMap={cardMap}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            yearMonth={yearMonth}
            onPrevMonth={() => handleMonthChange(-1)}
            onNextMonth={() => handleMonthChange(1)}
            onOpenModal={() => openExpenseModal(null)}
            onEditExpense={openExpenseModal}
            onDeleteExpense={handleDelete}
            onOpenSearch={() => setSearch({ open: true, category: '' })}
            onExport={handleExport}
            viewMode={viewMode}
            onViewModeChange={(m) => { setViewMode(m); writeLocal('buboo_view_mode', m); }}
          />
        )}
        {currentTab === 'statistics' && (
          <StatisticsTab
            expenses={expenses}
            prevMonthExpenses={prevMonthExpenses}
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
            unsettled={settlements.unsettled}
            history={settlements.history}
            historyAvailable={settlements.historyAvailable}
            onSettle={settlements.settle}
            onUndoSettlement={settlements.undoSettlement}
            onChanged={bump}
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

      <SearchSheet
        isOpen={search.open}
        initialCategory={search.category}
        onClose={() => setSearch({ open: false, category: '' })}
        monthExpenses={expenses}
        yearMonth={yearMonth}
        cardMap={cardMap}
        nicknames={nicknames}
        onEdit={openExpenseModal}
        version={version}
      />

      <ExpenseInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addExpense}
        onUpdate={updateExpense}
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
