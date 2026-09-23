/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // 색은 index.css의 CSS 변수에서 가져옴 → 다크모드는 변수만 바꿔서 처리
      colors: {
        app: token('app'),
        card: token('card'),
        fill: token('fill'),
        line: token('line'),
        ink: token('ink'),
        ink2: token('ink2'),
        muted: token('muted'),
        husband: { DEFAULT: token('husband'), soft: token('husband-soft') },
        wife: { DEFAULT: token('wife'), soft: token('wife-soft') },
        joint: { DEFAULT: token('joint'), soft: token('joint-soft') },
        income: { DEFAULT: token('income'), soft: token('income-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
      spacing: { 11: '2.75rem', 15: '3.75rem' },
      boxShadow: {
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sheet: '0 -8px 30px rgb(0 0 0 / 0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'toast-in': { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'sheet-up': 'sheet-up 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'toast-in': 'toast-in 0.2s ease-out',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
