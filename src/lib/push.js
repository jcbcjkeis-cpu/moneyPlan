import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';

export const FUNCTION_URL = `${supabaseUrl}/functions/v1/push`;

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// 이 휴대폰이 알림을 받을 수 있는 상태인지
export function pushAvailability() {
  if (pushSupported()) return { ok: true };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-browser' };
  return { ok: false, reason: 'unsupported' };
}

// 알림 키 만들기 (브라우저에서 생성 → 공개 키만 DB에 저장, 비밀 키는 화면에 한 번만 보여줌)
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { publicKey: b64u(raw), privateKey: jwk.d };
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

function sameKey(sub, vapidPublicKey) {
  const k = sub?.options?.applicationServerKey;
  if (!k || !vapidPublicKey) return true; // 알 수 없으면 같다고 봄
  return b64u(k) === vapidPublicKey;
}

async function saveSubscription(sub, role) {
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    role,
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(/push_subscriptions/.test(error.message) ? 'migration_v4_push.sql을 먼저 실행해주세요.' : error.message);
}

// 알림 켜기 (버튼을 누른 순간에 호출해야 아이폰에서 허용 창이 뜸)
export async function enablePush({ vapidPublicKey, role }) {
  if (!vapidPublicKey) throw new Error('아직 알림 키가 없어요. 아래 "처음 한 번 설정"을 먼저 해주세요.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? '알림이 차단돼 있어요. 휴대폰 설정에서 부부로그 알림을 허용해주세요.'
      : '알림 허용을 선택하지 않았어요.');
  }
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, vapidPublicKey)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(vapidPublicKey) });
  await saveSubscription(sub, role);
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// 앱을 열 때: 키가 바뀌었거나 역할이 바뀌었으면 조용히 다시 연결
export async function syncPush({ vapidPublicKey, role }) {
  if (!pushSupported() || Notification.permission !== 'granted' || !vapidPublicKey || !role) return;
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) return; // 사용자가 끈 상태
  if (!sameKey(sub, vapidPublicKey)) {
    await sub.unsubscribe();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(vapidPublicKey) });
  }
  await saveSubscription(sub, role);
}

export async function loadPrefs(endpoint) {
  const { data } = await supabase.from('push_subscriptions').select('prefs').eq('endpoint', endpoint).maybeSingle();
  return data?.prefs ?? null;
}

export async function savePrefs(endpoint, prefs) {
  const { error } = await supabase.from('push_subscriptions').update({ prefs, updated_at: new Date().toISOString() }).eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

function functionHeaders() {
  const h = { 'Content-Type': 'application/json', apikey: supabaseAnonKey };
  if (supabaseAnonKey.startsWith('eyJ')) h.Authorization = `Bearer ${supabaseAnonKey}`;
  return h;
}

export async function sendTestPush(endpoint) {
  const res = await fetch(FUNCTION_URL, { method: 'POST', headers: functionHeaders(), body: JSON.stringify({ type: 'test', endpoint }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `서버 응답 ${res.status}`);
  return data;
}

// 서버 연결 확인. DB 트리거는 인증 없이 부르므로, 인증 없이도 열리는지까지 확인
export async function checkServer() {
  let res;
  try {
    res = await fetch(FUNCTION_URL, { method: 'GET' });
  } catch {
    return { ok: false, step: 'function', message: '서버 함수 "push"를 찾지 못했어요. 3단계를 확인해주세요.' };
  }
  if (res.status === 401) return { ok: false, step: 'jwt', message: '서버 함수의 "Verify JWT"가 켜져 있어요. 3단계 마지막을 확인해 꺼주세요.' };
  if (res.status === 404) return { ok: false, step: 'function', message: '서버 함수 "push"를 찾지 못했어요. 이름이 push인지 확인해주세요.' };
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, step: 'function', message: `서버 응답이 이상해요 (${res.status}).` };
  if (!data.hasSecret) return { ok: false, step: 'secret', message: 'VAPID_PRIVATE_KEY Secret이 없어요. 4단계를 확인해주세요.' };
  if (!data.publicKeySaved) return { ok: false, step: 'keys', message: '알림 키가 저장되지 않았어요. 2단계를 다시 해주세요.' };
  if (!data.keyMatch) return { ok: false, step: 'secret', message: 'Secret 값이 지금 알림 키와 짝이 맞지 않아요. 2단계에서 새로 만든 비밀 키를 다시 넣어주세요.' };
  const { error } = await supabase.from('app_settings').update({ push_function_url: FUNCTION_URL }).eq('id', 1);
  if (error) return { ok: false, step: 'sql', message: 'migration_v4_push.sql을 먼저 실행해주세요.' };
  return { ok: true, message: '서버 설정이 끝났어요. 이제 위에서 알림을 켜세요.' };
}

// ---------- 알림 진단 ----------
const deviceName = (ua = '') => (/iphone|ipad/i.test(ua) ? '아이폰' : /android/i.test(ua) ? (/samsung/i.test(ua) ? '갤럭시' : '안드로이드') : 'PC/기타');

// 알림이 어디서 막히는지 단계별로 확인 (읽기만 함)
export async function diagnosePush({ role, nicknames, functionUrl }) {
  const name = (r) => (r === 'husband' ? nicknames.husband : r === 'wife' ? nicknames.wife : r);
  const partner = role === 'husband' ? 'wife' : 'husband';
  const steps = [];
  let verdict = null;

  // 1) 서버
  const server = await checkServer();
  steps.push({ ok: server.ok && Boolean(functionUrl || server.ok), label: '알림 서버', detail: server.ok ? '정상' : server.message });
  if (!server.ok) verdict = { kind: 'server', text: server.message };

  // 2) 등록된 휴대폰
  const { data: subs, error: subErr } = await supabase.from('push_subscriptions').select('role, endpoint, user_agent, updated_at');
  const mine = await currentSubscription().catch(() => null);
  const list = subErr ? [] : (subs || []);
  const roles = { husband: list.filter((s) => s.role === 'husband'), wife: list.filter((s) => s.role === 'wife') };
  const thisPhone = mine ? list.find((s) => s.endpoint === mine.endpoint) : null;
  steps.push({
    ok: Boolean(thisPhone) && thisPhone.role === role && Notification.permission === 'granted',
    label: `이 휴대폰 (${name(role)})`,
    detail: !mine ? '알림이 꺼져 있어요' : !thisPhone ? '알림 목록에 없어요. 알림 받기를 껐다 켜주세요' : thisPhone.role !== role ? `${name(thisPhone.role)}(으)로 잘못 등록돼 있어요` : `등록됨 · ${Notification.permission === 'granted' ? '알림 허용' : '알림 차단됨'}`,
  });
  steps.push({
    ok: roles[partner].length > 0,
    label: `배우자 휴대폰 (${name(partner)})`,
    detail: roles[partner].length ? roles[partner].map((s) => deviceName(s.user_agent)).join(', ') + ' 등록됨' : '등록된 휴대폰이 없어요',
  });
  if (!verdict && mine && Notification.permission !== 'granted') {
    verdict = /iphone|ipad/i.test(navigator.userAgent)
      ? { kind: 'device-ios', text: '이 휴대폰에서 부부로그 알림이 차단돼 있어요. 아이폰 설정 → 알림 → 부부로그 → 알림 허용을 켜주세요.' }
      : { kind: 'device-android', text: '이 휴대폰에서 부부로그 알림이 차단돼 있어요. 아래 마지막 항목대로 알림을 "허용"으로 바꿔주세요.' };
  }
  if (!verdict && mine && thisPhone && thisPhone.role !== role) verdict = { kind: 'role', text: `이 휴대폰이 ${name(thisPhone.role)}(으)로 등록돼 있어요. 알림 받기를 껐다 다시 켜면 고쳐져요.` };
  if (!verdict && !roles[partner].length) verdict = { kind: 'partner', text: `${name(partner)}님 폰이 알림 목록에 없어요. ${name(partner)}님 폰에서 설정 → 알림 → 알림 받기를 켜야 해요.` };
  if (!verdict && (!mine || !thisPhone)) verdict = { kind: 'mine', text: '이 휴대폰 알림이 꺼져 있거나 목록에서 빠졌어요. 위의 알림 받기를 다시 켜주세요.' };

  // 3) 최근 내역을 서버가 처리했는지 (push_sent_at)
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: recent, error: recErr } = await supabase.from('expenses')
    .select('id, content, created_at, created_by, payer, push_sent_at')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(8);
  const rows = recErr ? [] : (recent || []);
  const handled = rows.filter((r) => r.push_sent_at).length;
  steps.push({
    ok: rows.length === 0 || handled > 0,
    label: '새 내역 → 서버 전달',
    detail: recErr ? '확인할 수 없어요 (migration_v4_push.sql 필요)' : rows.length === 0 ? '최근 3일 내역이 없어서 확인할 수 없어요' : `최근 ${rows.length}건 중 ${handled}건 전달됨`,
    rows: rows.map((r) => ({ id: r.id, content: r.content, by: name(r.created_by || r.payer), at: r.created_at, sent: Boolean(r.push_sent_at) })),
  });
  if (!verdict && rows.length && handled === 0) {
    verdict = { kind: 'trigger', text: '새 내역이 알림 서버로 전달되지 않고 있어요. Supabase에서 migration_v4_push.sql을 다시 실행하고, push 함수의 Verify JWT가 꺼져 있는지 확인해주세요.' };
  }

  // 4) 여기까지 정상이면 휴대폰 쪽 문제
  if (!verdict) {
    const ua = navigator.userAgent;
    verdict = /iphone|ipad/i.test(ua)
      ? { kind: 'device-ios', text: '서버는 알림을 정상적으로 보내고 있어요. 아이폰 설정 쪽을 확인해주세요.' }
      : { kind: 'device-android', text: '서버는 알림을 정상적으로 보내고 있어요. 휴대폰이 크롬을 잠재워서 알림이 늦게(앱을 열 때) 오는 경우가 대부분이에요.' };
  }
  return { steps, verdict };
}
