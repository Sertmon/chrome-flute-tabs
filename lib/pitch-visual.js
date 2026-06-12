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
  axis: '#8a939e',
};

const MAX_HISTORY_MS = 30 * 60 * 1000;

export class PitchVisual {
  #canvas;
  #ctx;
  #minMidi;
  #maxMidi;
  #history = [];
  #scrollPxPerSec = 42;
  #timeAxisW = 34;
  #current = null;
  #live = false;
  #frozenAnchor = 0;
  #viewOffsetSec = 0;
  #lastRollH = 0;
  #scrollSlider = null;
  #scrollSliderCol = null;
  #dpr = 1;
  #lastWidth = 0;
  #lastHeight = 0;
  #resizeRaf = 0;
  #onSliderInput = () => this.#handleSliderInput();

  constructor(canvas, opts = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#minMidi = opts.minMidi ?? 36;
    this.#maxMidi = opts.maxMidi ?? 108;
    if (opts.scrollPxPerSec != null) {
      this.#scrollPxPerSec = opts.scrollPxPerSec;
    }
    const parent = canvas.parentElement;
    if (parent) {
      new ResizeObserver(() => this.#scheduleResize()).observe(parent);
    }
    this.#resize();
  }

  attachScrollSlider(input, column) {
    if (this.#scrollSlider) {
      this.#scrollSlider.removeEventListener('input', this.#onSliderInput);
    }
    this.#scrollSlider = input;
    this.#scrollSliderCol = column ?? input?.parentElement ?? null;
    this.#scrollSlider?.addEventListener('input', this.#onSliderInput);
    this.#syncScrollUi();
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

  setTapeOptions({ scrollPxPerSec } = {}) {
    if (Number.isFinite(scrollPxPerSec)) {
      this.#scrollPxPerSec = scrollPxPerSec;
    }
    this.#clampViewOffset();
    this.draw();
  }

  setLiveMode(live, anchorTime = performance.now()) {
    this.#live = live;
    if (live) {
      this.#viewOffsetSec = 0;
    } else {
      this.#frozenAnchor = anchorTime;
      this.#current = null;
    }
    this.#syncScrollUi();
    this.draw(this.#anchorTime());
  }

  update(sample, now = performance.now()) {
    if (!this.#live) {
      return;
    }

    if (sample?.active && Number.isFinite(sample.midiFloat)) {
      this.#current = {
        midiFloat: sample.midiFloat,
        cents: sample.cents ?? 0,
      };
      this.#history.push({ midiFloat: sample.midiFloat, t: now });
    } else {
      this.#current = null;
    }

    while (this.#history.length > 0 && now - this.#history[0].t > MAX_HISTORY_MS) {
      this.#history.shift();
    }

    this.#viewOffsetSec = 0;
    this.draw(now);
  }

  clear() {
    this.#history = [];
    this.#current = null;
    this.#viewOffsetSec = 0;
    this.#live = false;
    this.#syncScrollUi();
    this.draw();
  }

  hasHistory() {
    return this.#history.length > 0;
  }

  #anchorTime() {
    return this.#live ? performance.now() : this.#frozenAnchor;
  }

  #visibleSec() {
    return this.#lastRollH > 0 ? this.#lastRollH / this.#scrollPxPerSec : 0;
  }

  #maxViewOffsetSec() {
    if (!this.#history.length) {
      return 0;
    }
    const anchor = this.#anchorTime();
    const totalSec = (anchor - this.#history[0].t) / 1000;
    return Math.max(0, totalSec - this.#visibleSec() * 0.05);
  }

  #clampViewOffset() {
    this.#viewOffsetSec = Math.max(0, Math.min(this.#viewOffsetSec, this.#maxViewOffsetSec()));
  }

  #handleSliderInput() {
    if (this.#live || !this.#scrollSlider) {
      return;
    }
    const max = this.#maxViewOffsetSec();
    const ratio = Number(this.#scrollSlider.value) / 1000;
    this.#viewOffsetSec = max * ratio;
    this.#clampViewOffset();
    this.#syncScrollUi();
    this.draw(this.#frozenAnchor);
  }

  #syncScrollUi() {
    const max = this.#maxViewOffsetSec();
    const show = !this.#live && this.#history.length > 0 && max > 0.05;
    if (this.#scrollSliderCol) {
      this.#scrollSliderCol.hidden = !show;
    }
    if (this.#scrollSlider) {
      this.#scrollSlider.disabled = !show;
      if (show) {
        const ratio = max > 0 ? this.#viewOffsetSec / max : 0;
        this.#scrollSlider.value = String(Math.round(ratio * 1000));
      }
    }
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
    this.#clampViewOffset();
    this.draw();
  }

  #timeToY(t, top, height, anchorMs) {
    const bottomTimeSec = (anchorMs - t) / 1000 - this.#viewOffsetSec;
    return top + height - bottomTimeSec * this.#scrollPxPerSec;
  }

  #midiToX(midiFloat, width, pad, axisW) {
    const span = this.#maxMidi - this.#minMidi;
    const ratio = (midiFloat - this.#minMidi) / span;
    const left = pad + axisW;
    return left + ratio * (width - left - pad);
  }

  #isBlack(midi) {
    return BLACK_PCS.has(((Math.round(midi) % 12) + 12) % 12);
  }

  draw(now = this.#anchorTime()) {
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
    const axisW = this.#timeAxisW;
    const gaugeH = 28;
    const pianoH = 52;
    const rollTop = gaugeH + pianoH;
    const rollH = cssH - rollTop;
    this.#lastRollH = rollH;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cssW, cssH);

    this.#drawRoll(ctx, cssW, rollTop, rollH, pad, axisW, now);
    this.#drawPiano(ctx, cssW, gaugeH, pianoH, pad, axisW);
    this.#drawGauge(ctx, cssW, gaugeH, pad, axisW);

    if (this.#current && this.#live) {
      const x = this.#midiToX(this.#current.midiFloat, cssW, pad, axisW);
      ctx.strokeStyle = COLORS.gaugeLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }

    if (!this.#live) {
      this.#syncScrollUi();
    }
  }

  #drawGauge(ctx, width, height, pad, axisW) {
    const y = 4;
    const barH = height - 10;
    const left = pad + axisW;
    const barW = width - left - pad;
    const cx = left + barW / 2;

    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(left, y, barW, barH);

    const inTuneW = barW * (10 / 100);
    ctx.fillStyle = COLORS.inTune;
    ctx.fillRect(cx - inTuneW / 2, y, inTuneW, barH);

    ctx.fillStyle = COLORS.label;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♭', left + 8, y + barH - 4);
    ctx.fillText('♯', left + barW - 8, y + barH - 4);
    ctx.fillText('−12¢', left + barW * 0.15, y + 10);
    ctx.fillText('−5¢', cx - inTuneW / 2 - 4, y + 10);
    ctx.fillText('+5¢', cx + inTuneW / 2 + 4, y + 10);
    ctx.fillText('+12¢', left + barW * 0.85, y + 10);

    if (this.#current && this.#live) {
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

  #drawPiano(ctx, width, top, height, pad, axisW) {
    const span = this.#maxMidi - this.#minMidi + 1;
    const left = pad + axisW;
    const keyW = (width - left - pad) / span;
    const whiteH = height - 14;

    for (let midi = this.#minMidi; midi <= this.#maxMidi; midi++) {
      if (this.#isBlack(midi)) {
        continue;
      }
      const x = this.#midiToX(midi, width, pad, axisW) - keyW / 2;
      const active = this.#current
        && this.#live
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
      const x = this.#midiToX(midi, width, pad, axisW) - keyW * 0.32;
      const active = this.#current
        && this.#live
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

  #drawTimeScale(ctx, top, height, pad, axisW) {
    const visibleSec = this.#visibleSec();
    const step = visibleSec <= 4 ? 0.5 : visibleSec <= 8 ? 1 : 2;
    const bottomLabel = this.#live
      ? '0'
      : (this.#viewOffsetSec < 0.05 ? 'конец' : `${Math.round(this.#viewOffsetSec)} с`);

    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(pad, top, axisW, height);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad + axisW - 0.5, top);
    ctx.lineTo(pad + axisW - 0.5, top + height);
    ctx.stroke();

    ctx.fillStyle = COLORS.axis;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';

    for (let sec = 0; sec <= visibleSec + step * 0.01; sec += step) {
      const y = top + height - sec * this.#scrollPxPerSec;
      if (y < top - 1 || y > top + height + 1) {
        continue;
      }

      ctx.strokeStyle = sec === 0 ? COLORS.grid : '#dce2ea';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + axisW, y);
      ctx.lineTo(pad + axisW + 4, y);
      ctx.stroke();

      const label = sec === 0
        ? bottomLabel
        : `${sec % 1 === 0 ? sec : sec.toFixed(1)} с`;
      ctx.fillText(label, pad + axisW - 3, y + 3);
    }

    ctx.save();
    ctx.translate(pad + 4, top + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '8px system-ui, sans-serif';
    ctx.fillStyle = COLORS.label;
    ctx.fillText(this.#live ? 'назад' : 'история', 0, 0);
    ctx.restore();
  }

  #drawRoll(ctx, width, top, height, pad, axisW, anchorMs) {
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, top, width, height);

    this.#drawTimeScale(ctx, top, height, pad, axisW);

    for (let midi = this.#minMidi; midi <= this.#maxMidi; midi++) {
      const x = this.#midiToX(midi, width, pad, axisW);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + height);
      ctx.stroke();
    }

    ctx.strokeStyle = COLORS.history;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < this.#history.length; i += 1) {
      const prev = this.#history[i - 1];
      const curr = this.#history[i];
      const yPrev = this.#timeToY(prev.t, top, height, anchorMs);
      const yCurr = this.#timeToY(curr.t, top, height, anchorMs);
      if (yPrev < top && yCurr < top) {
        continue;
      }
      if (yPrev > top + height && yCurr > top + height) {
        continue;
      }
      const xPrev = this.#midiToX(prev.midiFloat, width, pad, axisW);
      const xCurr = this.#midiToX(curr.midiFloat, width, pad, axisW);
      ctx.beginPath();
      ctx.moveTo(xPrev, yPrev);
      ctx.lineTo(xCurr, yCurr);
      ctx.stroke();
    }

    if (this.#current && this.#live && this.#history.length > 0) {
      const last = this.#history[this.#history.length - 1];
      const yLast = this.#timeToY(last.t, top, height, anchorMs);
      const yNow = top + height;
      const xLast = this.#midiToX(last.midiFloat, width, pad, axisW);
      const xNow = this.#midiToX(this.#current.midiFloat, width, pad, axisW);
      ctx.beginPath();
      ctx.moveTo(xLast, yLast);
      ctx.lineTo(xNow, yNow);
      ctx.stroke();
    }
  }
}
