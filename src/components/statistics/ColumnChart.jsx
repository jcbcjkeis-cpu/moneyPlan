import React, { useState } from 'react';
import { formatNumber, formatShort } from '../../lib/format';

// 세로 막대 (한 가지 값만): 막대 최대 24px, 끝 4px 둥글게, 현재 기간은 진하게.
// 휴대폰엔 마우스 오버가 없어서 막대를 누르면 위에 값이 나옴. 표로 보기도 제공.
export default function ColumnChart({ data, height = 128, unitLabel = '원', ariaLabel }) {
  const [sel, setSel] = useState(null);
  const [table, setTable] = useState(false);
  const max = Math.max(...data.map((d) => d.value), 1);
  const shown = sel !== null ? data[sel] : data.find((d) => d.current) || data[data.length - 1];
  const many = data.length > 12;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 min-h-[22px]">
        <p className="text-[14px] text-ink2 num">
          <span className="text-muted">{shown?.fullLabel || shown?.label}</span>{' '}
          <strong className="text-ink">{formatNumber(shown?.value || 0)}{unitLabel}</strong>
          {shown?.note && <span className="text-muted"> · {shown.note}</span>}
        </p>
        <button type="button" onClick={() => setTable((v) => !v)} className="text-[12px] font-semibold text-muted underline underline-offset-2 shrink-0">{table ? '그래프로' : '표로 보기'}</button>
      </div>

      {table ? (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-[13px] num">
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-muted">{d.fullLabel || d.label}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-ink">{formatNumber(d.value)}{unitLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={ariaLabel} className="relative pt-4">
          {/* 가장 큰 값 눈금 (흐리게, 그래프 위 자기 자리) */}
          <span className="absolute left-0 top-0 text-[11px] leading-none text-muted num pointer-events-none" aria-hidden="true">{formatShort(max)}</span>
          <div className="relative flex items-end border-b border-line" style={{ height, gap: many ? 2 : 6 }}>
            <div className="absolute left-0 right-0 top-0 border-t border-line pointer-events-none" aria-hidden="true" />
            {data.map((d, i) => {
              const h = d.value > 0 ? Math.max(3, Math.round((d.value / max) * height)) : 0;
              const active = sel === i || (sel === null && d.current);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSel(sel === i ? null : i)}
                  aria-label={`${d.fullLabel || d.label} ${formatNumber(d.value)}${unitLabel}`}
                  className="flex-1 h-full flex items-end justify-center"
                >
                  <span
                    className={`block w-full rounded-t-[4px] transition-colors ${active ? 'bg-ink' : d.highlight ? 'bg-ink/45' : 'bg-ink/15'}`}
                    style={{ height: h, maxWidth: 24 }}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex mt-1.5" style={{ gap: many ? 2 : 6 }}>
            {data.map((d, i) => (
              <span key={d.key} className={`flex-1 text-center text-[11px] num whitespace-nowrap ${sel === i || (sel === null && d.current) ? 'text-ink font-bold' : 'text-muted'}`}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
