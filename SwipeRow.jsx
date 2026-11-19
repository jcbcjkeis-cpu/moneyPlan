import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

const ACTION_W = 88;

// 왼쪽으로 밀면 삭제 버튼이 나오고, 끝까지 밀면 바로 삭제
export default function SwipeRow({ children, onDelete, label = '삭제' }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const st = useRef({ x: 0, y: 0, base: 0, axis: null, moved: false, width: 1 });

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st.current = { x: e.clientX, y: e.clientY, base: dx, axis: null, moved: false, width: e.currentTarget.offsetWidth || 1 };
  };

  const onPointerMove = (e) => {
    const s = st.current;
    if (s.x === 0 && s.y === 0) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (s.axis === 'x') { setDragging(true); e.currentTarget.setPointerCapture?.(e.pointerId); }
    }
    if (s.axis !== 'x') return;
    s.moved = true;
    setDx(Math.max(Math.min(s.base + mx, 0), -s.width));
  };

  const finish = () => {
    const s = st.current;
    st.current = { ...s, x: 0, y: 0 };
    if (s.axis !== 'x') return;
    setDragging(false);
    if (dx < -s.width * 0.55) {
      setRemoving(true);
      setDx(-s.width);
      setTimeout(() => { onDelete(); setDx(0); setRemoving(false); }, 180);
    } else if (dx < -ACTION_W / 2) setDx(-ACTION_W);
    else setDx(0);
  };

  // 밀다가 손을 뗀 경우나 열린 상태에서 탭하면 클릭(수정)이 실행되지 않게
  const onClickCapture = (e) => {
    if (st.current.moved || dx !== 0) {
      e.preventDefault();
      e.stopPropagation();
      st.current.moved = false;
      if (!st.current.axis) setDx(0);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${removing ? 'opacity-0 transition-opacity duration-150' : ''}`}>
      <div className="absolute inset-y-0 right-0 flex items-stretch bg-danger rounded-2xl" style={{ width: Math.max(-dx, ACTION_W) }}>
        <button
          type="button"
          onClick={() => { setDx(0); onDelete(); }}
          className="ml-auto w-[88px] flex flex-col items-center justify-center gap-0.5 text-white text-xs font-bold"
          tabIndex={dx === 0 ? -1 : 0}
          aria-hidden={dx === 0}
        >
          <Trash2 size={18} />
          {label}
        </button>
      </div>
      <div
        className="relative"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease-out', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
