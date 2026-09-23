// 짧은 진동 피드백
// - 안드로이드: navigator.vibrate
// - 아이폰(iOS 18+): 사파리는 vibrate를 지원하지 않지만, "스위치형 체크박스"를 누를 때
//   시스템 햅틱이 나는 점을 이용 (지원 안 되는 버전에서는 조용히 무시)
let iosSwitch = null;

function iosHaptic() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function haptic(ms = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
    else if (isIOS) iosHaptic();
  } catch { /* 무시 */ }
}
