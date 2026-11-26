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
import StatisticsTab from './components/statistics/StatisticsTab';
import { useExpenses, useExpenseMutations } from './hooks/useExpenses';
import { useSettings } from './hooks/useSettings';
import { useHistory } from './hooks/useHistory';
import { useFavorites } from './hooks/useFavorites';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useTheme } from './hooks/useTheme';
import { buildCardMap } from './lib/cards';
import { currentYearMonth, formatNumber, shiftYearMonth, toNumber } from './lib/format';
import { haptic } from './lib/haptic';
import { syncPush } from './lib/push';
import { useSpeech } from './hooks/useSpeech';
import { scoreTranscript } from './lib/quickParse';
import QuickAddSheet from './components/quick/QuickAddSheet';
import SavedListSheet from './components/quick/SavedListSheet';
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
  const [quick, setQuick] = useState({ open: false, focus: false });
  const [quickText, setQuickText] = useState('');
  const speech = useSpeech();
  const [speechHelp, setSpeechHelp] = useState('');
  const [savedIds, setSavedIds] = useState(null); // 빠른 입력으로 방금 저장한 여러 건
  const [plusAction, setPlusAction] = useState(() => readLocal('buboo_plus_action') || 'detail');

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const settings = useSettings();
  const { allCards, cards, budgetLimit, nicknames } = settings;
  const cardMap = useMemo(() => buildCardMap(allCards), [allCards]);

  const { expenses: rawExpenses, prevMonthExpenses, isLoading, loadError, loadedMonth } = useExpenses(yearMonth, version);
  const { addExpense, updateExpense, deleteExpense } = useExpenseMutations({ onChanged: bump, myInsertIds });
  const { merchants } = useHistory(version);
  const favs = useFavorites();

  // 삭제 대기 중(되돌리기 가능)인 내역은 화면에서 먼저 숨김
  const hide = useCallback((list) => (pendingDeletes.size ? list.filter((i) => !pendingDeletes.has(String(i.id))) : list), [pendingDeletes]);
  const expenses = useMemo(() => hide(rawExpenses), [hide, rawExpenses]);
  const isStale = loadedMonth !== yearMonth;

  useRealtimeSync({ onChange: bump, myInsertIds, nicknames, toast });

  useEffect(() => { if (loadError) toast(`내역을 불러오지 못했어요: ${loadError}`, 'error'); }, [loadError, toast]);

  // 링크로 열기
  //  ?sms=문자 / ?add=1 → 입력 화면, ?day=2026-09-28 → 그날 내역, ?tab=statistics → 통계 탭
  const openFromUrl = useCallback((href) => {
    const params = new URL(href, window.location.origin).searchParams;
    const sms = params.get('sms');
    const day = params.get('day');
    const tab = params.get('tab');
    if (sms || params.get('add')) {
      if (sms) setInitialSms(sms);
      setEditTarget(null);
      setIsModalOpen(true);
    } else if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setCurrentTab('calendar');
      setYearMonth(day.slice(0, 7));
      setSelectedDate(Number(day.slice(8, 10)));
      setIsDayOpen(true);
    } else if (tab === 'statistics') {
      setCurrentTab(tab);
    } else if (params.get('quick')) {
      setQuick({ open: true, focus: true, mic: false });
    } else if (params.get('mic')) {
      // 바로가기로 열면 화면을 한 번 눌러야 마이크가 켜짐 (브라우저 규칙) → 큰 마이크 버튼을 보여줌
      setQuick({ open: true, focus: false, mic: true });
    } else if (params.get('search')) {
      setSearch({ open: true, category: '' });
    }
  }, []);

  useEffect(() => {
    if (window.location.search) {
      openFromUrl(window.location.href);
      window.history.replaceState(null, '', window.location.pathname);
    }
    // 앱이 열려 있을 때 알림을 누르면 서비스워커가 보내는 메시지
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data?.type === 'navigate') { openFromUrl(e.data.url); bump(); }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [openFromUrl, bump]);

  // 알림을 켜 둔 휴대폰: 키나 역할이 바뀌었으면 조용히 다시 연결
  useEffect(() => {
    syncPush({ vapidPublicKey: settings.push.vapidPublicKey, role }).catch(() => {});
  }, [settings.push.vapidPublicKey, role]);

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
    if (isNew && focusProxy.current) { focusProxy.current.inputMode = 'numeric'; focusProxy.current.focus({ preventScroll: true }); }
    setEditTarget(isNew ? null : item);
    setIsModalOpen(true);
  }, []);

  // 빠른 입력 열기 (글자로)
  const openQuick = useCallback(() => {
    if (focusProxy.current) { focusProxy.current.inputMode = 'text'; focusProxy.current.focus({ preventScroll: true }); }
    setQuick({ open: true, focus: true });
  }, []);

  // 말로 입력: 버튼을 누른 순간 음성 인식을 시작해야 아이폰에서도 마이크가 켜짐
  const startMic = useCallback(() => {
    const started = speech.start({
      // 조각마다 후보 중 가장 말이 되는 것(사용처+금액, 아는 사용처)을 골라 이어 붙임
      onResult: (segments) => {
        const picked = segments.map((alts) => alts.reduce((best, t) => (
          scoreTranscript(t, { merchants, cards, nicknames }) > scoreTranscript(best, { merchants, cards, nicknames }) ? t : best
        ), alts[0])).join(' ');
        setQuickText((prev) => (prev.trim() ? `${prev.trim()}, ${picked}` : picked));
      },
      // 실패하면 빠른 입력 화면에 '키보드 받아쓰기' 안내를 띄움 (아이폰은 버튼을 눌러야 키보드가 열림)
      onError: (msg) => setSpeechHelp(msg),
    });
    if (!started) {
      if (focusProxy.current) { focusProxy.current.inputMode = 'text'; focusProxy.current.focus({ preventScroll: true }); }
      setSpeechHelp(speech.supported ? '음성 인식을 시작하지 못했어요. 키보드의 🎤(받아쓰기)로 말해주세요.' : '이 화면에서는 음성 인식을 쓸 수 없어요. 키보드의 🎤(받아쓰기)로 말해주세요.');
    } else {
      setSpeechHelp('');
    }
    setQuick({ open: true, focus: !started });
  }, [speech, toast, merchants, cards, nicknames]);

  const handleExport = () => {
    const res = exportExpensesToCsv({ expenses, yearMonth, cardMap, nicknames });
    toast(res.ok ? `${res.count}건을 CSV로 내보냈어요.` : res.error, res.ok ? 'success' : 'warning');
  };

  const handleRoleChange = (next) => { setRole(next); writeLocal('my_role', next); };

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
            onQuickAdd={openQuick}
            onQuickMic={startMic}
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
            onCategoryClick={(category, range) => setSearch({ open: true, category, range })}
            onMerchantClick={(query, range) => setSearch({ open: true, category: '', query, range })}
            onEditExpense={openExpenseModal}
            version={version}
            hiddenIds={pendingDeletes}
            allCards={allCards}
            cardMap={cardMap}
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenModal={() => (plusAction === 'quick' ? openQuick() : openExpenseModal(null))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSearch={() => setSearch({ open: true, category: '' })}
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
        initialQuery={search.query}
        initialRange={search.range}
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

      <QuickAddSheet
        isOpen={quick.open}
        focusOnOpen={quick.focus}
        micPrompt={quick.mic}
        onClose={() => { setQuick({ open: false, focus: false }); setSpeechHelp(''); }}
        text={quickText}
        setText={setQuickText}
        speech={speech}
        speechHelp={speechHelp}
        onDismissSpeechHelp={() => setSpeechHelp('')}
        onMic={startMic}
        onSave={(record) => addExpense({ ...record, created_by: role || undefined })}
        onUndo={async (ids) => {
          const results = await Promise.all(ids.map((id) => deleteExpense(id)));
          const failed = results.filter((r) => !r.ok).length;
          toast(failed ? `${failed}건은 되돌리지 못했어요.` : '저장을 취소했어요.', failed ? 'error' : 'info');
        }}
        onEditSaved={(rows) => (rows.length === 1 ? openExpenseModal(rows[0]) : setSavedIds(rows.map((r) => r.id)))}
        onOpenDetail={() => { setQuick({ open: false, focus: false }); openExpenseModal(null); }}
        merchants={merchants}
        cards={cards}
        cardMap={cardMap}
        role={role || 'husband'}
        nicknames={nicknames}
      />

      <SavedListSheet
        isOpen={Boolean(savedIds)}
        onClose={() => setSavedIds(null)}
        ids={savedIds}
        nicknames={nicknames}
        cardMap={cardMap}
        onEdit={openExpenseModal}
        onDelete={handleDelete}
        version={version}
        hiddenIds={pendingDeletes}
      />

      <ExpenseInputModal
        onReopen={openExpenseModal}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(record) => addExpense({ ...record, created_by: role || undefined })}
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
        plusAction={plusAction}
        onPlusActionChange={(v) => { setPlusAction(v); writeLocal('buboo_plus_action', v); }}
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
        push={settings.push}
        onSaveVapidKey={settings.saveVapidPublicKey}
        onRefreshSettings={settings.refreshSettings}
        onDataChanged={bump}
      />

      {!role && <RoleSelectModal nicknames={nicknames} onSelect={handleRoleChange} />}
    </div>
  );
}
