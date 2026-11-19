// 배경 사진을 화면에 맞는 크기로 줄여서 JPEG로 변환
// - 휴대폰 원본(4000px 이상, 수 MB)을 그대로 쓰면 그릴 때마다 버벅이고, 아이폰은 메모리 부족으로 화면이 깨질 수 있음
// - HEIC 등 브라우저가 못 읽는 형식은 여기서 걸러서 깨진 이미지가 올라가지 않게 함
const MAX_W = 1280;
const MAX_H = 1600;
const QUALITY = 0.82;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

export async function prepareBackground(file) {
  if (!file) throw new Error('사진을 선택해주세요.');
  if (file.size > 40 * 1024 * 1024) throw new Error('사진이 너무 커요 (40MB 초과).');

  let loaded;
  try {
    loaded = await loadImage(file);
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    throw new Error(heic
      ? 'HEIC 사진은 이 브라우저에서 열 수 없어요. 다른 사진을 고르거나, 사진을 캡처(스크린샷)해서 그걸 골라주세요.'
      : '이 사진을 열 수 없어요. 다른 사진을 골라주세요.');
  }

  const { img, url } = loaded;
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error('이 사진을 열 수 없어요. 다른 사진을 골라주세요.');
    const scale = Math.min(1, MAX_W / w, MAX_H / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827'; // 투명 PNG 대비
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    canvas.width = 0; // 메모리 바로 반환 (아이폰)
    canvas.height = 0;
    if (!blob) throw new Error('사진을 변환하지 못했어요. 다른 사진을 골라주세요.');
    return { blob, width: cw, height: ch, originalBytes: file.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}
