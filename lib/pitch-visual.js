const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

const COLORS = {
  bg: '#ffffff',
  grid: '#e8ecf2',
  whiteKey: '#ffffff',
  blackKey: '#2e343d',
  keyBorder: '#c5cdd8',
  activeKey: '#e8f4fc',
  activeBorder: '#e01b24',
  inTune: '#b8e6c8',
  gaugeLine: '#e01b24',
  history: '#e01b24',
  label: '#5c6672',
};

export class PitchVisual {
  #canvas;
  #ctx;
  #minMidi;
  #maxMidi;
  #history = [];
  #historyMaxMs = 9000;
  #scrollPxPerSec = 42;
  #current = null;
  #dpr = 1;
  #lastWidth = 0;
  #lastHeight = 0;
  #resizeRaf = 0;

  constructor(canvas, opts = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#minMidi = opts.minMidi ?? 36;
    this.#maxMidi = opts.maxMidi ?? 108;
    const parent = canvas.parentElement;
    if (parent) {
      new ResizeObserver(() => this.#scheduleResize()).observe(parent);
    }
    this.#resize();
  }

  #scheduleResize() {
    if (this.#resizeRaf) {
      return;
    }
    this.#resizeRaf = requestAnimationFrame(() => {
      this.#resizeRaf = 0;
      this.#resize();
    });
  }

  setRange(minMidi, maxMidi) {
    this.#minMidi = minMidi;
    this.#maxMidi = maxMidi;
    this.draw();
  }

  update(sample, now = performance.now()) {
    if (sample?.active && Number.isFinite(sample.midiFloat)) {
      this.#current = {
        midiFloat: sample.midiFloat,
        cents: sample.cents ?? 0,
      };
      this.#history.push({ midiFloat: sample.midiFloat, t: now });
    } else {
      this.#current = null;
    }

    while (this.#history.length > 0 && now - this.#history[0].t > this.#historyMaxMs) {
      this.#history.shift();
    }

    this.draw(now);
  }

  clear() {
    this.#history = [];
    this.#current = null;
    this.draw();
  }

  #resize() {
    const parent = this.#canvas.parentElement;
    if (!parent) {
      return;
    }
    this.#dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) {
      return;
    }
    if (w === this.#lastWidth && h === this.#lastHeight) {
      return;
    }
    this.#lastWidth = w;
    this.#lastHeight = h;
    this.#canvas.width = Math.round(w * this.#dpr);
    this.#canvas.height = Math.round(h * this.#dpr);
    this.draw();
  }

  #midiToX(midiFloat, width, pad) {
    const span = this.#maxMidi - this.#minMidi;
    const ratio = (midiFloat - this.#minMidi) / span;
    return pad + ratio * (width - pad * 2);
  }

  #isBlack(midi) {
    return BLACK_PCS.has(((Math.round(midi) % 12) + 12) % 12);
  }

  draw(now = performance.now()) {
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;
    if (!w || !h) {
      return;
    }

    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    const cssW = w / this.#dpr;
    const cssH = h / this.#dpr;
    const pad = 6;
    const gaugeH = 28;
    const pianoH = 52;
    const rollTop = gaugeH + pianoH;
    const rollH = cssH - rollTop;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cssW, cssH);

    this.#drawRoll(ctx, cssW, rollTop, rollH, pad, now);
    this.#drawPiano(ctx, cssW, gaugeH, pianoH, pad);
    this.#drawGauge(ctx, cssW, gaugeH, pad);

    if (this.#current) {
      const x = this.#midiToX(this.#current.midiFloat, cssW, pad);
      ctx.strokeStyle = COLORS.gaugeLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
  }

  #drawGauge(ctx, width, height, pad) {
    const y = 4;
    const barH = height - 10;
    const barW = width - pad * 2;
    const cx = pad + barW / 2;

    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(pad, y, barW, barH);

    const inTuneW = barW * (10 / 100);
    ctx.fillStyle = COLORS.inTune;
    ctx.fillRect(cx - inTuneW / 2, y, inTuneW, barH);

    ctx.fillStyle = COLORS.label;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♭', pad + 8, y + barH - 4);
    ctx.fillText('♯', pad + barW - 8, y + barH - 4);
    ctx.fillText('−12¢', pad + barW * 0.15, y + 10);
    ctx.fillText('−5¢', cx - inTuneW / 2 - 4, y + 10);
    ctx.fillText('+5¢', cx + inTuneW / 2 + 4, y + 10);
    ctx.fillText('+12¢', pad + barW * 0.85, y + 10);

    if (this.#current) {
      const cents = Math.max(-50, Math.min(50, this.#current.cents));
      const nx = cx + (cents / 50) * (barW / 2 - 12);
      ctx.strokeStyle = COLORS.gaugeLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, y);
      ctx.lineTo(nx, y + barH);
      ctx.stroke();
    }
  }

  #drawPiano(ctx, width, top, height, pad) {
    const span = this.#maxMidi - this.#minMidi + 1;
    const keyW = (width - pad * 2) / span;
    const whiteH = height - 14;

    for (let midi = this.#minMidi; midi <= this.#maxMidi; midi++) {
      if (this.#isBlack(midi)) {
        continue;
      }
      const x = this.#midiToX(midi, width, pad) - keyW / 2;
      const active = this.#current
        && Math.abs(this.#current.midiFloat - midi) < 0.55;
      ctx.fillStyle = active ? COLORS.activeKey : COLORS.whiteKey;
      ctx.fillRect(x, top, keyW + 0.5, whiteH);
      ctx.strokeStyle = active ? COLORS.activeBorder : COLORS.keyBorder;
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(x, top, keyW + 0.5, whiteH);

      if (midi % 12 === 0) {
        const octave = Math.floor(midi / 12) - 1;
        ctx.fillStyle = COLORS.label;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`C${octave}`, x + keyW / 2, top + whiteH + 10);
      }
    }

    const blackH = whiteH * 0.62;
    for (let midi = this.#minMidi; midi <= this.#maxMidi; midi++) {
      if (!this.#isBlack(midi)) {
        continue;
      }
      const x = this.#midiToX(midi, width, pad) - keyW * 0.32;
      const active = this.#current
        && Math.abs(this.#current.midiFloat - midi) < 0.55;
      ctx.fillStyle = active ? '#5a1014' : COLORS.blackKey;
      ctx.fillRect(x, top, keyW * 0.64, blackH);
      if (active) {
        ctx.strokeStyle = COLORS.activeBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, top, keyW * 0.64, blackH);
      }
    }
  }

  #drawRoll(ctx, width, top, height, pad, now) {
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, top, width, height);

    const span = this.#maxMidi - this.#minMidi;
    for (let midi = this.#minMidi; midi <= this.#maxMidi; midi++) {
      const x = this.#midiToX(midi, width, pad);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + height);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.history;
    for (const point of this.#history) {
      const age = (now - point.t) / 1000;
      const y = top + height - age * this.#scrollPxPerSec;
      if (y < top || y > top + height) {
        continue;
      }
      const x = this.#midiToX(point.midiFloat, width, pad);
      ctx.fillRect(x - 1.5, y - 1, 3, 3);
    }
  }
}
