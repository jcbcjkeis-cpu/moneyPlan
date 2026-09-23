import { useEffect, useState } from 'react';

// 아이폰은 키보드가 올라와도 화면 높이가 줄지 않아서 하단 고정 버튼이 키보드에 가려짐
// → visualViewport로 키보드 높이를 계산해서 그만큼 올려줌
export function useKeyboardInset(active) {
  const [state, setState] = useState({ inset: 0, height: null });

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) return undefined;
    const vv = window.visualViewport;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setState({ inset: kb > 80 ? kb : 0, height: vv.height });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setState({ inset: 0, height: null });
    };
  }, [active]);

  return state;
}
