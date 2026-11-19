import { useCallback, useEffect, useRef, useState } from 'react';

const ERROR_TEXT = {
  'not-allowed': '마이크 권한이 꺼져 있어요. 휴대폰 설정에서 이 앱(또는 브라우저)의 마이크를 허용해주세요.',
  'service-not-allowed': '이 화면에서는 음성 인식을 쓸 수 없어요. 키보드의 🎤(받아쓰기) 버튼을 눌러 말해보세요.',
  'audio-capture': '마이크를 찾을 수 없어요. 다른 앱이 마이크를 쓰고 있는지 확인해주세요.',
  network: '음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.',
  'no-speech': '말소리가 들리지 않았어요. 마이크 버튼을 누르고 다시 말해주세요.',
  'language-not-supported': '한국어 음성 인식을 쓸 수 없어요. 키보드의 🎤 버튼을 눌러 말해보세요.',
};

// 브라우저 음성 인식 (안드로이드 크롬, 아이폰 사파리 14.5+)
// 지원하지 않으면 supported=false → 화면에서 키보드 받아쓰기를 안내
export function useSpeech() {
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* 무시 */ } }, []);

  // 반드시 버튼을 누른 순간에 호출 (아이폰은 그래야 마이크가 켜짐)
  const start = useCallback(({ onText, onError }) => {
    if (!SR) return false;
    try { recRef.current?.abort(); } catch { /* 무시 */ }
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) onText(r[0].transcript.trim());
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      onError?.(ERROR_TEXT[e.error] || `음성 인식 오류 (${e.error})`, e.error);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    try {
      rec.start();
    } catch (err) {
      onError?.(ERROR_TEXT['service-not-allowed'], 'start-failed');
      return false;
    }
    recRef.current = rec;
    setListening(true);
    return true;
  }, [SR]);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* 무시 */ } }, []);

  return { supported: Boolean(SR), listening, interim, start, stop };
}
