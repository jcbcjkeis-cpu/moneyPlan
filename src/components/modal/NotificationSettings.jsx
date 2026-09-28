import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Check, ChevronDown, Copy, ExternalLink, KeyRound, Send } from 'lucide-react';
import { useToast } from '../common/Toast';
import { supabaseUrl } from '../../lib/supabase';
import {
  checkServer, currentSubscription, disablePush, enablePush, generateVapidKeys,
  isIOS, loadPrefs, pushAvailability, savePrefs, sendTestPush,
} from '../../lib/push';
import functionCode from '../../../supabase/functions/push/index.ts?raw';

const PREFS = [
  { id: 'partner', label: '배우자가 입력했을 때', desc: '"찬범님이 입력했어요 · 주유 70,000원"' },
  { id: 'budget', label: '예산 80%, 100% 도달', desc: '이번 달 예산 기준, 단계마다 한 번' },
  { id: 'settlement', label: '월말 정산 알림', desc: '매달 마지막 날 밤 9시, 보낼 돈이 있을 때만' },
];

function Toggle({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-[52px] h-8 rounded-full transition shrink-0 disabled:opacity-50 ${on ? 'bg-income' : 'bg-line'}`}
    >
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'left-[24px]' : 'left-1'}`} />
    </button>
  );
}

export default function NotificationSettings({ role, nicknames, push, onSaveVapidKey, onRefreshSettings }) {
  const toast = useToast();
  const avail = pushAvailability();
  const [endpoint, setEndpoint] = useState(null);
  const [prefs, setPrefs] = useState({ partner: true, budget: true, settlement: true });
  const [busy, setBusy] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [copied, setCopied] = useState('');
  const [check, setCheck] = useState(null);
  const serverReady = Boolean(push.vapidPublicKey && push.functionUrl);
  const [setupOpen, setSetupOpen] = useState(!serverReady);
  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const dash = (path) => (ref ? `https://supabase.com/dashboard/project/${ref}/${path}` : 'https://supabase.com/dashboard');
  const name = role === 'husband' ? nicknames.husband : nicknames.wife;

  useEffect(() => {
    if (!avail.ok) return;
    currentSubscription().then(async (sub) => {
      if (!sub) return;
      setEndpoint(sub.endpoint);
      const p = await loadPrefs(sub.endpoint);
      if (p) setPrefs((prev) => ({ ...prev, ...p }));
    }).catch(() => {});
  }, [avail.ok]);

  const copy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      toast('복사하지 못했어요.', 'error');
    }
  };

  const toggleOn = async (on) => {
    setBusy('toggle');
    try {
      if (on) {
        const sub = await enablePush({ vapidPublicKey: push.vapidPublicKey, role });
        setEndpoint(sub.endpoint);
        toast('알림을 켰어요. 테스트 알림을 보내보세요.', 'success');
      } else {
        await disablePush();
        setEndpoint(null);
        toast('이 휴대폰 알림을 껐어요.', 'info');
      }
    } catch (e) {
      toast(e.message, 'error', { duration: 6000 });
    }
    setBusy('');
  };

  const togglePref = async (id, on) => {
    const next = { ...prefs, [id]: on };
    setPrefs(next);
    try { await savePrefs(endpoint, next); } catch (e) { toast(e.message, 'error'); setPrefs(prefs); }
  };

  const test = async () => {
    setBusy('test');
    try {
      await sendTestPush(endpoint);
      toast('테스트 알림을 보냈어요. 몇 초 안에 도착해요.', 'success');
    } catch (e) {
      toast(`보내지 못했어요: ${e.message}`, 'error', { duration: 6000 });
    }
    setBusy('');
  };

  const makeKeys = async () => {
    if (push.vapidPublicKey && !window.confirm('이미 알림 키가 있어요. 새로 만들면 4단계의 Secret도 새 값으로 바꿔야 하고, 두 휴대폰 모두 앱을 한 번 열어야 다시 연결돼요. 새로 만들까요?')) return;
    setBusy('keys');
    try {
      const keys = await generateVapidKeys();
      const res = await onSaveVapidKey(keys.publicKey);
      if (!res.ok) throw new Error(res.error);
      setPrivateKey(keys.privateKey);
      setCheck(null);
      toast('알림 키를 만들었어요. 아래 비밀 키를 복사해두세요.', 'success');
    } catch (e) {
      toast(e.message, 'error', { duration: 6000 });
    }
    setBusy('');
  };

  const runCheck = async () => {
    setBusy('check');
    const r = await checkServer();
    setCheck(r);
    setBusy('');
    if (r.ok) { onRefreshSettings(); toast(r.message, 'success'); }
  };

  const section = 'rounded-2xl border border-line overflow-hidden';
  const row = 'px-4 py-3.5 flex items-center justify-between gap-3 border-b border-line last:border-0';
  const stepNum = 'w-7 h-7 rounded-full bg-ink text-card text-[13px] font-bold flex items-center justify-center shrink-0';
  const body = 'text-[14px] text-ink2 leading-relaxed';
  const btn = 'h-11 px-4 rounded-xl bg-fill text-[14px] font-semibold text-ink flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50';
  const link = 'inline-flex items-center gap-1 text-husband font-semibold underline underline-offset-2';

  return (
    <div className="space-y-6 py-5">
      {/* 이 휴대폰 알림 */}
      <section>
        <h3 className="text-[15px] font-bold text-ink mb-1">이 휴대폰({name}) 알림</h3>
        {!avail.ok ? (
          <div className="rounded-2xl bg-warn-soft p-4 text-[14px] text-ink2 leading-relaxed mt-2">
            {avail.reason === 'ios-browser' ? (
              <>아이폰은 <strong>홈 화면에 추가한 앱</strong>에서만 알림을 받을 수 있어요. 사파리 공유 버튼 → <strong>홈 화면에 추가</strong> 후, 홈 화면의 부부로그 아이콘으로 열어서 여기서 알림을 켜주세요. (iOS 16.4 이상)</>
            ) : (
              <>이 브라우저는 알림을 지원하지 않아요. {isIOS() ? 'iOS 16.4 이상으로 업데이트해주세요.' : '크롬이나 삼성 인터넷에서 열어주세요.'}</>
            )}
          </div>
        ) : (
          <div className={`${section} mt-2`}>
            <div className={row}>
              <div className="flex items-center gap-3 min-w-0">
                {endpoint ? <Bell size={20} className="text-income shrink-0" /> : <BellOff size={20} className="text-muted shrink-0" />}
                <div>
                  <p className="text-[15px] font-semibold text-ink">알림 받기</p>
                  <p className="text-[13px] text-muted">{endpoint ? '켜져 있어요' : serverReady ? '꺼져 있어요' : '먼저 아래 서버 설정을 끝내주세요'}</p>
                </div>
              </div>
              <Toggle on={Boolean(endpoint)} onChange={toggleOn} label="이 휴대폰에서 알림 받기" disabled={busy === 'toggle' || (!endpoint && !push.vapidPublicKey)} />
            </div>
            {endpoint && PREFS.map((p) => (
              <div key={p.id} className={row}>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{p.label}</p>
                  <p className="text-[13px] text-muted">{p.desc}</p>
                </div>
                <Toggle on={prefs[p.id] !== false} onChange={(on) => togglePref(p.id, on)} label={p.label} />
              </div>
            ))}
            {endpoint && (
              <div className="p-3">
                <button type="button" onClick={test} disabled={busy === 'test' || !serverReady} className={`${btn} w-full`}>
                  <Send size={16} /> {busy === 'test' ? '보내는 중…' : '테스트 알림 보내기'}
                </button>
              </div>
            )}
          </div>
        )}
        <p className="text-[13px] text-muted mt-2 px-1">내가 입력한 건 나에게 오지 않고 배우자 폰에만 가요. 두 사람 모두 각자 폰에서 알림을 켜야 해요.</p>
      </section>

      {/* 서버 설정 (한 번만) */}
      <section>
        <button type="button" onClick={() => setSetupOpen((v) => !v)} className="w-full flex items-center justify-between py-1" aria-expanded={setupOpen}>
          <span className="text-left">
            <span className="block text-[15px] font-bold text-ink">처음 한 번: 서버 설정</span>
            <span className={`block text-[13px] ${serverReady ? 'text-income' : 'text-muted'}`}>{serverReady ? '설정 완료 · 한 사람만 하면 돼요' : '한 사람만 하면 돼요 (PC에서 하면 편해요)'}</span>
          </span>
          <ChevronDown size={20} className={`text-muted transition ${setupOpen ? 'rotate-180' : ''}`} />
        </button>

        {setupOpen && (
          <ol className="mt-4 space-y-6">
            <li className="flex gap-3">
              <span className={stepNum}>1</span>
              <div className="space-y-2 min-w-0 flex-1">
                <p className={body}><strong>DB 준비</strong>: Supabase <a className={link} href={dash('sql/new')} target="_blank" rel="noreferrer">SQL Editor<ExternalLink size={13} /></a>에서 <code>supabase/migration_v4_push.sql</code> 내용을 붙여넣고 Run.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className={stepNum}>2</span>
              <div className="space-y-2 min-w-0 flex-1">
                <p className={body}><strong>알림 키 만들기</strong>: 아래 버튼을 누르면 키가 만들어져요. 공개 키는 자동 저장되고, <strong>비밀 키는 지금 한 번만</strong> 보여줘요.</p>
                <button type="button" onClick={makeKeys} disabled={busy === 'keys'} className={btn}>
                  <KeyRound size={16} /> {push.vapidPublicKey ? '알림 키 새로 만들기' : '알림 키 만들기'}
                </button>
                {push.vapidPublicKey && !privateKey && <p className="text-[13px] text-income">알림 키가 이미 있어요. 비밀 키를 잃어버렸을 때만 새로 만드세요.</p>}
                {privateKey && (
                  <button type="button" onClick={() => copy('priv', privateKey)} className="w-full text-left rounded-xl bg-warn-soft px-4 py-3 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] text-warn font-semibold">비밀 키 (4단계에서 사용, 다른 사람에게 보내지 마세요)</span>
                      <span className="block text-[14px] font-semibold text-ink break-all">{privateKey}</span>
                    </span>
                    {copied === 'priv' ? <Check size={18} className="text-income shrink-0" /> : <Copy size={18} className="text-muted shrink-0" />}
                  </button>
                )}
              </div>
            </li>

            <li className="flex gap-3">
              <span className={stepNum}>3</span>
              <div className="space-y-2 min-w-0 flex-1">
                <p className={body}>
                  <strong>서버 함수 만들기</strong>: <a className={link} href={dash('functions')} target="_blank" rel="noreferrer">Edge Functions<ExternalLink size={13} /></a> → <strong>Deploy a new function</strong> → <strong>Via Editor</strong>
                </p>
                <p className={body}>편집기에 있던 예시 코드를 <strong>전부 지우고</strong>, 아래 버튼으로 복사한 코드를 붙여넣어요. 함수 이름을 <code>push</code>로 바꾸고 <strong>Deploy function</strong>.</p>
                <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy('code', functionCode)} className={btn}>
                  {copied === 'code' ? <Check size={16} className="text-income" /> : <Copy size={16} />} 함수 코드 복사 ({Math.round(functionCode.length / 1000)}KB)
                </button>
                <button type="button" onClick={() => copy('name', 'push')} className={btn}>
                  {copied === 'name' ? <Check size={16} className="text-income" /> : <Copy size={16} />} 이름: push
                </button>
                </div>
                <p className={body}>배포가 끝나면 함수 화면의 <strong>Details</strong>(또는 Settings) → <strong>Verify JWT</strong> 스위치를 <strong>끄고</strong> 저장해요. (DB가 알림을 보낼 때 필요)</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className={stepNum}>4</span>
              <div className="space-y-2 min-w-0 flex-1">
                <p className={body}><strong>비밀 키 넣기</strong>: <a className={link} href={dash('functions/secrets')} target="_blank" rel="noreferrer">Edge Function Secrets<ExternalLink size={13} /></a> → Name과 Value에 아래 값 → <strong>Save</strong></p>
                <button type="button" onClick={() => copy('secret', 'VAPID_PRIVATE_KEY')} className={btn}>
                  {copied === 'secret' ? <Check size={16} className="text-income" /> : <Copy size={16} />} Name: VAPID_PRIVATE_KEY
                </button>
                <p className="text-[13px] text-muted">Value에는 2단계의 비밀 키를 붙여넣어요.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className={stepNum}>5</span>
              <div className="space-y-2 min-w-0 flex-1">
                <p className={body}><strong>연결 확인</strong>: 모두 맞으면 초록색으로 떠요.</p>
                <button type="button" onClick={runCheck} disabled={busy === 'check'} className={btn}>
                  {busy === 'check' ? '확인 중…' : '서버 연결 확인'}
                </button>
                {check && (
                  <p className={`text-[14px] font-semibold rounded-xl px-3 py-2.5 ${check.ok ? 'bg-income-soft text-income' : 'bg-danger-soft text-danger'}`}>{check.message}</p>
                )}
              </div>
            </li>
          </ol>
        )}
      </section>
    </div>
  );
}
