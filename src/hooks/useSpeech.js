import { useCallback, useEffect, useRef, useState } from 'react';

function IS_IOS_TEXT() {
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return ios
    ? '아이폰에서 음성 인식이 막혀 있어요. 설정 → 일반 → 키보드 → "받아쓰기 활성화"를 켜거나, 아래 버튼으로 키보드 받아쓰기를 써주세요.'
    : '이 화면에서는 음성 인식을 쓸 수 없어요. 아래 버튼으로 키보드 받아쓰기를 써주세요.';
}

const ERROR_TEXT = {
  'not-allowed': '마이크 권한이 꺼져 있어요. 휴대폰 설정에서 이 앱(또는 브라우저)의 마이크를 허용해주세요.',
  'service-not-allowed': IS_IOS_TEXT(),
  'audio-capture': '마이크를 찾을 수 없어요. 다른 앱이 마이크를 쓰고 있는지 확인해주세요.',
  network: '음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.',
  'no-speech': '말소리가 들리지 않았어요. 마이크 버튼을 누르고 조금 크게 말해주세요.',
  'language-not-supported': '한국어 음성 인식을 쓸 수 없어요. 키보드의 🎤 버튼을 눌러 말해보세요.',
};

const IS_IOS = typeof navigator !== 'undefined'
  && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const SILENCE_MS = 2500; // 말을 멈추고 이만큼 지나면 끝
const MAX_MS = 30000;

// 결과 묶음 정리: 안드로이드 크롬은 같은 문장을 누적해서 여러 번 주는 경우가 있어 앞 조각을 버림
function cleanSegments(segs) {
  const sq = (t) => t.replace(/[\s,.]/g, '');
  const out = [];
  for (const alts of segs) {
    const prev = out[out.length - 1];
    // 이번 조각의 후보 중 하나라도 앞 조각(후보 아무거나)으로 시작하면 → 앞 조각을 이어서 다시 준 것
    const repeats = prev && alts.some((a) => prev.some((p) => sq(a).startsWith(sq(p))));
    if (repeats) out[out.length - 1] = alts;
    else out.push(alts);
  }
  return out;
}

// 브라우저 음성 인식 (안드로이드 크롬, 아이폰 사파리)
// 지원하지 않으면 supported=false → 화면에서 키보드 받아쓰기를 안내
export function useSpeech() {
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const timers = useRef({});

  const clearTimers = () => { clearTimeout(timers.current.silence); clearTimeout(timers.current.max); };

  useEffect(() => () => { clearTimers(); try { recRef.current?.abort(); } catch { /* 무시 */ } }, []);

  // 반드시 버튼을 누른 순간에 호출 (아이폰은 그래야 마이크가 켜짐)
  // onResult(segments): segments = [[후보1, 후보2, ...], ...] 말한 조각별 후보 목록
  const start = useCallback(({ onResult, onError }) => {
    if (!SR) return false;
    try { recRef.current?.abort(); } catch { /* 무시 */ }
    clearTimers();
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    // 안드로이드: 중간에 쉬어도 끊기지 않게 계속 듣기. 아이폰 사파리는 계속 듣기 모드가 불안정해서 끔
    rec.continuous = !IS_IOS;
    rec.maxAlternatives = 5;
    let segments = [];
    let pendingLive = ''; // 아직 '확정'되지 않은 말 (아이폰은 끝까지 확정을 안 주는 경우가 많음)
    let failed = false;

    const stopSoon = () => {
      clearTimeout(timers.current.silence);
      timers.current.silence = setTimeout(() => { try { rec.stop(); } catch { /* 무시 */ } }, SILENCE_MS);
    };

    rec.onresult = (e) => {
      const finals = [];
      let live = '';
      for (let i = 0; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) {
          const alts = [];
          for (let k = 0; k < r.length; k += 1) { const t = r[k].transcript.trim(); if (t && !alts.includes(t)) alts.push(t); }
          if (alts.length) finals.push(alts);
        } else {
          live += r[0].transcript;
        }
      }
      segments = cleanSegments(finals);
      pendingLive = live.trim();
      setInterim([...segments.map((a) => a[0]), live.trim()].filter(Boolean).join(' '));
      stopSoon();
    };
    rec.onspeechend = () => stopSoon();
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      if (e.error === 'no-speech' && segments.length) return;
      failed = true;
      onError?.(ERROR_TEXT[e.error] || `음성 인식 오류 (${e.error})`, e.error);
    };
    rec.onend = () => {
      clearTimers();
      setListening(false);
      setInterim('');
      if (failed) return;
      // 확정 안 된 마지막 말도 버리지 않고 포함 (아이폰 대응)
      const all = pendingLive ? cleanSegments([...segments, [pendingLive]]) : segments;
      if (all.length) onResult(all);
      else onError?.(ERROR_TEXT['no-speech'], 'no-speech');
    };
    try {
      rec.start();
    } catch {
      onError?.(ERROR_TEXT['service-not-allowed'], 'start-failed');
      return false;
    }
    recRef.current = rec;
    timers.current.max = setTimeout(() => { try { rec.stop(); } catch { /* 무시 */ } }, MAX_MS);
    setListening(true);
    return true;
  }, [SR]);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* 무시 */ } }, []);
  const cancel = useCallback(() => { try { recRef.current?.abort(); } catch { /* 무시 */ } setListening(false); setInterim(''); }, []);

  return { supported: Boolean(SR), isIOS: IS_IOS, listening, interim, start, stop, cancel };
}
