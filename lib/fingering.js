/**
 * Аппликатура сопрано блокфлейты в C (7 отверстий спереди + большой палец).
 * Нумерация как на флейте: [Т, 1, 2, 3, 4, 5, 6, 7].
 * true = закрыто, false = открыто.
 *
 * Источник: Dolmetsch baroque / German (основное отличие — F и F#).
 */

const HOLE_LABELS = ['Т', '1', '2', '3', '4', '5', '6', '7'];
const HOLE_COUNT = HOLE_LABELS.length;

/** Закрытые отверстия в нотации 0–7 (0 = большой палец сзади). */
function stackToHoles(stackClosed) {
  if (!stackClosed.length) {
    return Array(HOLE_COUNT).fill(false);
  }
  const c = (n) => stackClosed.includes(n);
  return [c(0), c(1), c(2), c(3), c(4), c(5), c(6), c(7)];
}

const STACK_BAROQUE_SOPRANO_C = {
  72: [0, 1, 2, 3, 4, 5, 6, 7],
  73: [0, 1, 2, 3, 4, 5, 6],
  74: [0, 1, 2, 3, 4, 5, 6],
  75: [0, 1, 2, 3, 4, 5, 6],
  76: [0, 1, 2, 3, 4, 5],
  77: [0, 1, 2, 3, 4, 6, 7],
  78: [0, 1, 2, 3, 5, 6],
  79: [0, 1, 2, 3],
  80: [0, 1, 2, 4, 5, 6],
  81: [0, 1, 2],
  82: [0, 1, 3, 4],
  83: [0, 1],
  84: [],
  85: [1, 2, 3, 4, 5, 6, 7],
  86: [2],
  87: [2, 3, 4, 5, 6],
  88: [1, 2, 3, 4, 5],
  89: [1, 2, 3, 4, 6, 7],
  90: [1, 2, 3, 5],
  91: [1, 2, 3],
  92: [1, 2, 4],
  93: [1, 2],
  94: [1, 2, 5, 6],
  95: [1, 2, 4, 5],
  96: [0, 1, 2, 3, 4, 5, 6, 7],
  98: [0, 1, 2, 3, 4, 5, 6],
};

const BAROQUE_OVERRIDES = {
  75: [true, true, true, true, true, true, false, true],
};

function buildBaroqueFingering() {
  return Object.fromEntries(
    Object.entries(STACK_BAROQUE_SOPRANO_C).map(([midi, stack]) => {
      const n = Number(midi);
      return [n, BAROQUE_OVERRIDES[n] ?? stackToHoles(stack)];
    }),
  );
}

/** German: последовательная F; F# — вилка; C#6 — только большой палец. */
function buildGermanFingering(baroque) {
  return {
    ...baroque,
    77: stackToHoles([0, 1, 2, 3, 4]),
    78: stackToHoles([0, 1, 2, 3, 4, 6, 7]),
    85: stackToHoles([0]),
    89: stackToHoles([1, 2, 3, 4]),
    90: stackToHoles([1, 2, 3, 4, 6, 7]),
  };
}

const FINGERING_BY_SYSTEM = {
  baroque: buildBaroqueFingering(),
  german: buildGermanFingering(buildBaroqueFingering()),
};

function resolveFingeringSystem(fingeringSystem) {
  return fingeringSystem === 'german' ? 'german' : 'baroque';
}

function getTable(fingeringSystem = 'baroque') {
  return FINGERING_BY_SYSTEM[resolveFingeringSystem(fingeringSystem)];
}

function pitchClassFromMidi(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function recorderMidiForSung(sungMidi, recorderType = 'soprano_c', fingeringSystem = 'baroque') {
  const midi = Math.round(sungMidi);
  const pc = pitchClassFromMidi(midi);
  const table = getTable(fingeringSystem);

  const candidates = Object.keys(table).map(Number)
    .filter((m) => pitchClassFromMidi(m) === pc && table[m])
    .sort((a, b) => a - b);

  if (!candidates.length) {
    return null;
  }

  const exact = candidates.indexOf(midi);
  if (exact !== -1) {
    return candidates[exact];
  }

  if (midi < candidates[0]) {
    return candidates[0];
  }

  for (let i = 0; i < candidates.length - 1; i += 1) {
    const mid = (candidates[i] + candidates[i + 1]) / 2;
    if (midi < mid) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1];
}

export function getFingering(midi, recorderType = 'soprano_c', fingeringSystem = 'baroque') {
  const lookupMidi = recorderType === 'alto_f' ? midi + 7 : midi;
  const holes = getTable(fingeringSystem)[lookupMidi];
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

  const normalized = normalizeHoles(holes);
  const scale = size === 'large' ? 1.4 : 1;
  const r = 5 * scale;
  const gap = 4 * scale;
  const step = 2 * r + gap;
  const row2Count = 4;
  const w = row2Count * step - gap;
  const row2StartX = r;
  const row1StartX = r + step / 2;
  const row1Y = r;
  const row2Y = row1Y + step + 4;
  const thumbY = row2Y + step;
  const thumbX = w / 2;
  const h = thumbY + r;

  const circles = [];

  for (let i = 0; i < 3; i += 1) {
    circles.push(svgCircle(row1StartX + i * step, row1Y, r, normalized[i + 1], String(i + 1)));
  }
  for (let i = 0; i < 4; i += 1) {
    circles.push(svgCircle(row2StartX + i * step, row2Y, r, normalized[i + 4], String(i + 4)));
  }
  circles.push(svgCircle(thumbX, thumbY, r, normalized[0], 'Т'));

  return `<svg class="fingering-svg fingering-${size}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${circles.join('')}</svg>`;
}

/** Совместимость со старыми массивами [Т, 1..8]. */
function normalizeHoles(holes) {
  if (holes.length === HOLE_COUNT) {
    return holes;
  }
  if (holes.length === 9) {
    return [
      holes[0],
      holes[1],
      holes[2],
      holes[3],
      holes[4],
      holes[5],
      holes[6],
      holes[8],
    ];
  }
  return holes.slice(0, HOLE_COUNT);
}

function svgCircle(x, y, r, closed, label) {
  const fill = closed ? '#1a5fb4' : '#fff';
  const stroke = '#1a5fb4';
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="7" fill="${closed ? '#fff' : '#555'}">${label}</text>`;
}
