// 부부로그 푸시 알림 서버 함수 (Supabase Edge Function 이름: push)
// 외부 라이브러리 없이 Web Crypto만으로 Web Push(RFC 8291 암호화 + VAPID 서명)를 처리합니다.
//
// 필요한 Secret: VAPID_PRIVATE_KEY  (앱 설정 > 알림 > "알림 키 만들기"에서 복사)
// 자동으로 들어있는 값: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 요청 종류
//   GET                              → 설정 상태 확인
//   POST {type:'expense', id}        → 새 내역 알림 (DB 트리거가 호출) + 예산 80/100% 알림
//   POST {type:'daily'}              → 매일 밤 9시 (월말이면 정산 알림)
//   POST {type:'test', endpoint}     → 이 휴대폰으로 테스트 알림

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- base64url ----------
const enc = new TextEncoder();
function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- DB (PostgREST, service role) ----------
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function db(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (SB_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SB_KEY}`;
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`DB ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ---------- 날짜 (한국 시간) ----------
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstToday = () => kstNow().toISOString().slice(0, 10);
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

// ---------- VAPID ----------
type Vapid = { publicKey: string; jwk: JsonWebKey; subject: string };

async function loadVapid(settings: Record<string, any>): Promise<Vapid> {
  const d = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();
  const publicKey = String(settings?.vapid_public_key ?? '').trim();
  if (!d) throw new Error('VAPID_PRIVATE_KEY Secret이 없어요.');
  if (!publicKey) throw new Error('앱에서 알림 키를 아직 만들지 않았어요.');
  const raw = unb64u(publicKey);
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('저장된 공개 키 형식이 올바르지 않아요.');
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', d, x: b64u(raw.slice(1, 33)), y: b64u(raw.slice(33, 65)), ext: true };
  const subject = /^(mailto:|https:)/.test(settings?.vapid_subject ?? '') ? settings.vapid_subject : 'mailto:push@bubolog.app';
  return { publicKey, jwk, subject };
}

const jwtCache = new Map<string, { token: string; exp: number }>();

async function vapidAuth(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const cached = jwtCache.get(aud);
  if (cached && cached.exp - now > 600) return `vapid t=${cached.token}, k=${v.publicKey}`;
  const exp = now + 12 * 3600;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp, sub: v.subject })));
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  const token = `${header}.${claims}.${b64u(sig)}`;
  jwtCache.set(aud, { token, exp });
  return `vapid t=${token}, k=${v.publicKey}`;
}

// 비밀 키와 공개 키가 짝이 맞는지 확인 (서명 후 검증)
async function checkKeyPair(v: Vapid): Promise<boolean> {
  try {
    const priv = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const pub = await crypto.subtle.importKey('raw', unb64u(v.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const msg = enc.encode('bubolog');
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, msg);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, msg);
  } catch {
    return false;
  }
}

// ---------- 암호화 (RFC 8291, aes128gcm) ----------
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

async function encrypt(payload: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));

  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

type Sub = { id: number; endpoint: string; p256dh: string; auth: string; role: string; prefs: Record<string, boolean> | null };
type Message = { title: string; body: string; url?: string; tag?: string };

async function sendOne(sub: Sub, msg: Message, v: Vapid, urgency = 'normal'): Promise<{ id: number; status: number; error?: string }> {
  try {
    const body = await encrypt(enc.encode(JSON.stringify(msg)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuth(sub.endpoint, v),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: urgency,
      },
      body,
    });
    const text = res.ok ? '' : (await res.text()).slice(0, 200);
    // 앱을 지웠거나 알림을 끈 휴대폰 → 목록에서 삭제
    if (res.status === 404 || res.status === 410) await db(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
    return { id: sub.id, status: res.status, error: text || undefined };
  } catch (e) {
    return { id: sub.id, status: 0, error: String(e) };
  }
}

async function sendMany(subs: Sub[], msg: Message, v: Vapid, urgency = 'normal') {
  return Promise.all(subs.map((s) => sendOne(s, msg, v, urgency)));
}

const wants = (s: Sub, pref: string) => s.prefs?.[pref] !== false;

// ---------- 정산 계산 (앱의 src/lib/settlement.js와 같은 규칙) ----------
function computeTransfer(items: any[], cards: any[]) {
  const cardMap = new Map(cards.map((c) => [String(c.id), c]));
  let husband = 0;
  let wife = 0;
  for (const e of items) {
    const card = e.card_id != null ? cardMap.get(String(e.card_id)) : null;
    const owner = card ? (card.owner === 'husband' || card.owner === 'wife' ? card.owner : null) : e.payer;
    if (owner === 'husband') husband += Number(e.amount) || 0;
    if (owner === 'wife') wife += Number(e.amount) || 0;
  }
  const diff = Math.abs(husband - wife);
  return { husband, wife, amount: Math.round(diff / 2), sender: husband > wife ? 'wife' : 'husband', count: items.length };
}

// ---------- 처리 ----------
async function getSettings() {
  const rows = await db('app_settings?id=eq.1&select=*');
  return rows?.[0] ?? {};
}

async function savePushState(state: Record<string, unknown>) {
  await db('app_settings?id=eq.1', { method: 'PATCH', body: JSON.stringify({ push_state: state }) });
}

async function handleExpense(id: number) {
  // 같은 내역으로 두 번 알림이 가지 않도록 "처리중" 표시를 먼저 가져감 (15분 지난 내역은 무시)
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const claimed = await db(
    `expenses?id=eq.${id}&push_sent_at=is.null&created_at=gte.${encodeURIComponent(since)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ push_sent_at: new Date().toISOString() }) },
  );
  const e = claimed?.[0];
  if (!e) return { skipped: 'already sent or too old' };

  const settings = await getSettings();
  const v = await loadVapid(settings);
  const subs: Sub[] = await db('push_subscriptions?select=*');
  const names: Record<string, string> = { husband: settings.husband_nickname || '남편', wife: settings.wife_nickname || '아내' };
  const author = e.created_by === 'husband' || e.created_by === 'wife' ? e.created_by : e.payer;
  const results: unknown[] = [];

  // 1) 배우자에게 새 내역 알림
  const partnerSubs = subs.filter((s) => s.role !== author && wants(s, 'partner'));
  if (partnerSubs.length) {
    const kind = e.is_income ? '수입' : e.is_joint_expense ? '공용' : '개인';
    results.push(...await sendMany(partnerSubs, {
      title: `${names[author] ?? ''}님이 입력했어요`,
      body: `${e.content} ${e.is_income ? '+' : ''}${won(Number(e.amount))} · ${kind}`,
      url: `/?day=${e.expense_date}`,
      tag: `expense-${e.id}`,
    }, v));
  }

  // 2) 예산 80% / 100% 알림 (이번 달 지출일 때, 단계마다 한 번)
  const month = kstToday().slice(0, 7);
  const budget = Number(settings.global_budget) || 0;
  if (!e.is_income && budget > 0 && String(e.expense_date).startsWith(month)) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const rows = await db(`expenses?select=amount&is_income=eq.false&expense_date=gte.${month}-01&expense_date=lte.${month}-${String(last).padStart(2, '0')}`);
    const total = rows.reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0);
    const rate = (total / budget) * 100;
    const level = rate >= 100 ? 100 : rate >= 80 ? 80 : 0;
    const state = settings.push_state ?? {};
    const sent = Number(state.budget?.[month] ?? 0);
    if (level > sent) {
      const targets = subs.filter((s) => wants(s, 'budget'));
      results.push(...await sendMany(targets, {
        title: level === 100 ? '이번 달 예산을 넘었어요' : `이번 달 예산의 ${Math.round(rate)}%를 썼어요`,
        body: level === 100 ? `예산보다 ${won(total - budget)} 더 썼어요.` : `${won(budget - total)} 남았어요.`,
        url: '/?tab=statistics',
        tag: `budget-${month}`,
      }, v, 'high'));
      await savePushState({ ...state, budget: { ...(state.budget ?? {}), [month]: level } });
    }
  }
  return { sent: results };
}

async function handleDaily(force = false) {
  const today = kstToday();
  const [y, m, d] = today.split('-').map(Number);
  const isLastDay = d === new Date(y, m, 0).getDate();
  if (!isLastDay && !force) return { skipped: 'not last day of month' };

  const settings = await getSettings();
  const state = settings.push_state ?? {};
  if (state.settlement_sent === today && !force) return { skipped: 'already sent today' };

  const [items, cards] = await Promise.all([
    db('expenses?select=amount,payer,card_id&is_joint_expense=eq.true&is_settled=eq.false&is_income=eq.false'),
    db('payment_cards?select=id,owner'),
  ]);
  const t = computeTransfer(items, cards);
  if (t.amount <= 0) return { skipped: 'nothing to settle' };

  const v = await loadVapid(settings);
  const subs: Sub[] = (await db('push_subscriptions?select=*')).filter((s: Sub) => wants(s, 'settlement'));
  const names: Record<string, string> = { husband: settings.husband_nickname || '남편', wife: settings.wife_nickname || '아내' };
  const receiver = t.sender === 'wife' ? 'husband' : 'wife';
  const results = await sendMany(subs, {
    title: `${m}월 정산할 시간이에요`,
    body: `${names[t.sender]}님이 ${names[receiver]}님께 ${won(t.amount)} 보내면 끝나요.`,
    url: '/?tab=settlement',
    tag: `settlement-${today}`,
  }, v);
  await savePushState({ ...state, settlement_sent: today });
  return { sent: results };
}

async function handleTest(endpoint: string) {
  const settings = await getSettings();
  const v = await loadVapid(settings);
  const subs: Sub[] = await db(`push_subscriptions?select=*&endpoint=eq.${encodeURIComponent(endpoint)}`);
  if (!subs.length) return { ok: false, error: '이 휴대폰이 알림 목록에 없어요. 알림을 다시 켜주세요.' };
  const [r] = await sendMany(subs, { title: '부부로그 알림이 연결됐어요', body: '이제 배우자가 입력하면 여기로 알려드릴게요.', url: '/', tag: 'test' }, v, 'high');
  return { ok: r.status >= 200 && r.status < 300, status: r.status, error: r.error };
}

async function handleStatus() {
  const hasSecret = !!Deno.env.get('VAPID_PRIVATE_KEY');
  let keyMatch = false;
  let publicKeySaved = false;
  let error: string | undefined;
  try {
    const settings = await getSettings();
    publicKeySaved = !!settings.vapid_public_key;
    if (hasSecret && publicKeySaved) keyMatch = await checkKeyPair(await loadVapid(settings));
  } catch (e) {
    error = String(e);
  }
  return { ok: hasSecret && publicKeySaved && keyMatch, hasSecret, publicKeySaved, keyMatch, error };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (req.method === 'GET') return json(await handleStatus());
    const body = await req.json().catch(() => ({}));
    if (body.type === 'expense' && body.id != null) return json(await handleExpense(Number(body.id)));
    if (body.type === 'daily') return json(await handleDaily(false));
    if (body.type === 'test' && body.endpoint) return json(await handleTest(String(body.endpoint)));
    return json({ ok: false, error: 'unknown request' }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
