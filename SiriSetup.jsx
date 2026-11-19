import React, { useState } from 'react';
import { Copy, Check, Mic } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { useToast } from '../common/Toast';

// 아이폰 단축어("시리야, 생활비") 설정 도우미
// 단축어에 붙여넣을 값들을 버튼 하나로 복사하고, 문장 해석을 미리 테스트
export default function SiriSetup({ currentUserRole, nicknames }) {
  const toast = useToast();
  const [copied, setCopied] = useState('');
  const [sample, setSample] = useState('이마트 5만 2천');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const payer = currentUserRole === 'husband' ? 'husband' : 'wife';

  const values = [
    { id: 'url', label: 'URL', value: `${supabaseUrl}/rest/v1/rpc/quick_add` },
    { id: 'apikey', label: 'apikey 헤더 값', value: supabaseAnonKey },
    { id: 'auth', label: 'Authorization 헤더 값', value: `Bearer ${supabaseAnonKey}` },
    { id: 'payer', label: `p_payer 값 (${payer === 'husband' ? nicknames.husband : nicknames.wife})`, value: payer },
  ];

  const copy = async (item) => {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(item.id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      toast('복사하지 못했어요.', 'error');
    }
  };

  const test = async () => {
    setTesting(true);
    const { data, error } = await supabase.rpc('quick_add', { p_text: sample, p_payer: payer, p_dry_run: true });
    setTesting(false);
    if (error) {
      setResult({ ok: false, message: /quick_add|function/i.test(error.message) ? 'Supabase에서 migration_v3_siri.sql을 먼저 실행해주세요.' : error.message });
      return;
    }
    setResult(data);
  };

  const step = 'flex gap-3';
  const num = 'w-6 h-6 rounded-full bg-ink text-card text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5';
  const body = 'text-[14px] text-ink2 leading-relaxed';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-fill p-4">
        <p className="text-[14px] font-semibold text-ink flex items-center gap-1.5"><Mic size={16} /> 이렇게 쓰게 돼요</p>
        <p className="text-[14px] text-ink2 mt-1.5 leading-relaxed">
          "시리야, 생활비" → "어디서 얼마 썼어요?" → <strong>"이마트 5만 2천"</strong><br />
          앱을 열지 않아도 공용 생활비로 저장돼요. "어제 스타벅스 4500원"처럼 날짜도 말할 수 있어요.
        </p>
      </div>

      <div>
        <p className="text-[14px] font-semibold text-ink mb-2">먼저 테스트해보기 (저장되지 않아요)</p>
        <div className="flex gap-2">
          <input value={sample} onChange={(e) => setSample(e.target.value)} className="flex-1 h-12 bg-fill rounded-xl px-4 text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-husband" aria-label="테스트 문장" />
          <button type="button" onClick={test} disabled={testing} className="h-12 px-4 rounded-xl bg-ink text-card text-[15px] font-bold shrink-0 disabled:opacity-50">{testing ? '확인 중' : '해석'}</button>
        </div>
        {result && (
          <p className={`mt-2 text-[14px] font-semibold rounded-xl px-3 py-2.5 ${result.ok ? 'bg-income-soft text-income' : 'bg-danger-soft text-danger'}`}>{result.message}</p>
        )}
      </div>

      <div>
        <p className="text-[14px] font-semibold text-ink mb-2">단축어에 붙여넣을 값</p>
        <div className="rounded-2xl border border-line overflow-hidden">
          {values.map((v) => (
            <button key={v.id} type="button" onClick={() => copy(v)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left border-b border-line last:border-0 active:bg-fill">
              <span className="min-w-0">
                <span className="block text-[13px] text-muted">{v.label}</span>
                <span className="block text-[14px] font-semibold text-ink truncate">{v.value}</span>
              </span>
              {copied === v.id ? <Check size={18} className="text-income shrink-0" /> : <Copy size={18} className="text-muted shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[14px] font-semibold text-ink mb-3">단축어 만들기</p>
        <ol className="space-y-3.5">
          <li className={step}><span className={num}>1</span><p className={body}><strong>단축어</strong> 앱 → 오른쪽 위 <strong>+</strong> → 맨 위 이름을 <strong>생활비</strong>로 바꾸기</p></li>
          <li className={step}><span className={num}>2</span><p className={body}>동작 검색에서 <strong>입력 요청</strong> 추가 → '프롬프트'에 <strong>어디서 얼마 썼어요?</strong> 입력</p></li>
          <li className={step}><span className={num}>3</span><p className={body}><strong>URL의 콘텐츠 가져오기</strong> 추가 → URL 자리에 위의 <strong>URL</strong> 붙여넣기 → <strong>›</strong> 눌러 펼치기</p></li>
          <li className={step}><span className={num}>4</span><p className={body}>방법 <strong>POST</strong> → 헤더 추가: 키 <code>apikey</code> / 값은 위의 <strong>apikey 헤더 값</strong> → 헤더 하나 더: 키 <code>Authorization</code> / 값은 <strong>Authorization 헤더 값</strong></p></li>
          <li className={step}><span className={num}>5</span><p className={body}>요청 본문 <strong>JSON</strong> → 새로운 필드 → 텍스트: 키 <code>p_text</code>, 값은 키보드 위 변수에서 <strong>제공된 입력</strong> 선택 → 새로운 필드 → 텍스트: 키 <code>p_payer</code>, 값 <code>{payer}</code></p></li>
          <li className={step}><span className={num}>6</span><p className={body}><strong>사전 값 가져오기</strong> 추가 → 키에 <code>message</code> 입력 (사전은 'URL의 콘텐츠'로 자동 연결)</p></li>
          <li className={step}><span className={num}>7</span><p className={body}><strong>결과 표시</strong> 추가 → '사전 값' 연결 → 완료. 이제 <strong>"시리야, 생활비"</strong>라고 말해보세요.</p></li>
        </ol>
      </div>

      <div className="rounded-2xl bg-fill p-4 space-y-1.5 text-[14px] text-ink2 leading-relaxed">
        <p><strong className="text-ink">더 빠르게:</strong> 설정 → 손쉬운 사용 → 터치 → <strong>뒷면 탭</strong> → 이중 탭 → '생활비'. 폰 뒷면을 두 번 두드리면 바로 입력창이 떠요 (키보드의 마이크로 말해도 돼요).</p>
        <p><strong className="text-ink">한 명이 만들어서 공유:</strong> 완성한 단축어를 길게 눌러 공유 → iCloud 링크로 보내면, 받은 사람은 <code>p_payer</code> 값만 바꾸면 돼요 (husband / wife).</p>
      </div>
    </div>
  );
}
