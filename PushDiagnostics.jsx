import React, { useState } from 'react';
import { CircleAlert, CircleCheck, Stethoscope } from 'lucide-react';
import { diagnosePush } from '../../lib/push';

const DEVICE_TIPS = {
  'device-android': [
    '휴대폰 설정 → 애플리케이션 → Chrome → 배터리 → "제한 없음"(또는 "최적화 안 함")으로 바꿔요.',
    '갤럭시: 설정 → 배터리 → 백그라운드 사용 제한 → "절전 상태 앱"·"깊은 절전 상태 앱" 목록에 Chrome이 있으면 빼고, "절전 예외 앱"에 Chrome을 추가해요.',
    '홈 화면에 설치한 부부로그도 Chrome으로 동작해서, Chrome만 예외로 두면 돼요.',
    'Chrome → ⋮ → 설정 → 알림 → 사이트 목록에서 money-plan-sigma.vercel.app이 "허용"인지 확인해요.',
  ],
  'device-ios': [
    '아이폰 설정 → 알림 → 부부로그 → 알림 허용, 잠금 화면·배너가 켜져 있는지 확인해요.',
    '집중 모드(방해금지·수면·업무)가 켜져 있으면 알림이 조용히 쌓여요. 설정 → 집중 모드에서 부부로그를 허용 앱에 추가해요.',
    '저전력 모드에서는 알림이 늦게 올 수 있어요.',
    '앱을 홈 화면에서 지웠다 다시 추가했다면, 설정 → 알림 탭에서 알림 받기를 다시 켜야 해요.',
  ],
};

const time = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PushDiagnostics({ role, nicknames, functionUrl }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setResult(await diagnosePush({ role, nicknames, functionUrl }));
    } catch (e) {
      setResult({ steps: [], verdict: { kind: 'error', text: `진단 중 오류: ${e.message}` } });
    }
    setBusy(false);
  };

  const tips = result && DEVICE_TIPS[result.verdict.kind];
  const deviceSide = Boolean(tips);

  return (
    <section>
      <h3 className="text-[15px] font-bold text-ink mb-1">알림이 안 올 때</h3>
      <p className="text-[13px] text-muted mb-3">어디서 막히는지 단계별로 확인해요. 데이터는 바꾸지 않아요.</p>
      <button type="button" onClick={run} disabled={busy} className="h-11 px-4 rounded-xl bg-fill text-[14px] font-semibold text-ink flex items-center gap-1.5 disabled:opacity-50">
        <Stethoscope size={16} /> {busy ? '확인 중…' : '알림 진단하기'}
      </button>

      {result && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-line overflow-hidden">
            {result.steps.map((s) => (
              <div key={s.label} className="px-4 py-3 border-b border-line last:border-0">
                <div className="flex items-start gap-2.5">
                  {s.ok ? <CircleCheck size={18} className="text-income shrink-0 mt-0.5" /> : <CircleAlert size={18} className="text-danger shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{s.label}</p>
                    <p className="text-[13px] text-muted">{s.detail}</p>
                  </div>
                </div>
                {s.rows?.length > 0 && (
                  <ul className="mt-2 ml-7 space-y-1">
                    {s.rows.map((r) => (
                      <li key={r.id} className="text-[12px] text-muted flex justify-between gap-2 num">
                        <span className="truncate">{time(r.at)} · {r.by} · {r.content}</span>
                        <span className={r.sent ? 'text-income shrink-0' : 'text-danger shrink-0'}>{r.sent ? '전달됨' : '안 됨'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className={`rounded-2xl p-4 ${deviceSide ? 'bg-warn-soft' : result.verdict.kind === 'error' ? 'bg-danger-soft' : 'bg-danger-soft'}`}>
            <p className="text-[14px] font-bold text-ink">{result.verdict.text}</p>
            {tips && (
              <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[14px] text-ink2 leading-relaxed">
                {tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
            {deviceSide && (
              <p className="text-[13px] text-muted mt-3">
                확인 방법: 위의 <strong>테스트 알림 보내기</strong>를 누르자마자 홈 화면으로 나가보세요. 몇 초 안에 오면 정상이에요.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
