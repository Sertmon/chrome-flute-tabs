/**
 * Аппликатура барокко, сопрано блокфлейта в C.
 * Массив из 9 значений: [большой палец, 1, 2, 3, 4, 5, 6, 7, 8].
 * true = отверстие закрыто, false = открыто.
 */
const FINGERING = {
  72: [true, true, true, true, true, true, true, true, true],   // C5
  73: [true, true, true, true, true, true, true, false, true], // C#5
  74: [true, true, true, true, true, true, true, true, false], // D5
  75: [true, true, true, true, true, true, true, false, false], // D#5
  76: [true, true, true, true, true, true, false, false, false], // E5
  77: [true, true, true, true, true, false, false, false, false], // F5
  78: [true, true, true, true, false, true, false, true, false], // F#5
  79: [true, true, true, false, false, false, false, false, false], // G5
  80: [true, true, false, true, false, false, false, true, false], // G#5
  81: [true, true, false, false, false, false, false, false, false], // A5
  82: [true, false, true, false, false, false, false, false, false], // Bb5
  83: [true, false, false, false, false, false, false, false, false], // B5
  84: [false, false, false, false, false, false, false, false, false], // C6
  85: [false, true, true, true, true, true, true, true, true], // C#6
  86: [false, false, false, false, false, false, false, false, true], // D6
  87: [false, false, false, false, false, false, false, true, true], // D#6
  88: [false, false, false, false, false, false, true, true, true], // E6
  89: [false, false, false, false, false, true, true, true, true], // F6
  90: [false, false, false, false, true, false, true, false, true], // F#6
  91: [false, false, false, true, true, true, true, true, true], // G6
  92: [false, false, true, true, true, true, true, true, true], // G#6
  93: [false, false, true, false, false, false, false, false, false], // A6
  94: [false, true, true, false, false, false, false, false, false], // Bb6
  95: [false, true, true, true, true, true, true, true, true], // B6
  96: [true, true, true, true, true, true, true, true, true], // C7
  98: [true, true, true, true, true, true, true, false, false], // D7
};

const HOLE_LABELS = ['Т', '1', '2', '3', '4', '5', '6', '7', '8'];

export function getFingering(midi) {
  const holes = FINGERING[midi];
  if (!holes) {
    return null;
  }
  return {
    midi,
    holes: [...holes],
    text: holes.map((closed, i) => (closed ? HOLE_LABELS[i] : '·')).join(' '),
    compact: holes.map((closed) => (closed ? '●' : '○')).join(''),
  };
}

export function renderFingeringSvg(holes, size = 'small') {
  if (!holes) {
    return '';
  }

  const scale = size === 'large' ? 1.4 : 1;
  const r = 5 * scale;
  const gap = 4 * scale;
  const rowW = 4 * (2 * r + gap) - gap;
  const cx = (i) => r + i * (2 * r + gap);
  const thumbY = r;
  const row1Y = thumbY + 2 * r + gap + 4;
  const row2Y = row1Y + 2 * r + gap;
  const w = rowW;
  const h = row2Y + r;
  const thumbX = w / 2;

  const circles = [];

  circles.push(svgCircle(thumbX, thumbY, r, holes[0], 'Т'));

  for (let i = 0; i < 4; i++) {
    circles.push(svgCircle(cx(i), row1Y, r, holes[i + 1], String(i + 1)));
  }
  for (let i = 0; i < 4; i++) {
    circles.push(svgCircle(cx(i), row2Y, r, holes[i + 5], String(i + 5)));
  }

  return `<svg class="fingering-svg fingering-${size}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${circles.join('')}</svg>`;
}

function svgCircle(x, y, r, closed, label) {
  const fill = closed ? '#1a5fb4' : '#fff';
  const stroke = '#1a5fb4';
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="7" fill="${closed ? '#fff' : '#555'}">${label}</text>`;
}
