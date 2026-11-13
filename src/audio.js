// All sound is synthesised with WebAudio: no audio files to ship.
const BASS = [0, 0, 12, 0, 0, 12, 0, 10, 3, 3, 15, 3, 5, 5, 17, 7];

export class Sfx {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.timer = null;
    }

    /** Must be called from a user gesture. */
    init() {
        if (this.ctx) {
            this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    }

    tone(freq, dur, { type = 'square', vol = 0.15, to = null, at = 0, cutoff = null } = {}) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + at;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = osc;
        if (cutoff) {
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = cutoff;
            osc.connect(f);
            node = f;
        }
        node.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    noise(dur, { vol = 0.2, hp = 1000, at = 0 } = {}) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + at;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = hp;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(gain).connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.02);
    }

    shoot() {
        this.tone(880, 0.12, { type: 'sawtooth', vol: 0.12, to: 110 });
        this.noise(0.07, { vol: 0.12, hp: 2500 });
    }
    kill(combo = 0) {
        const base = 440 * Math.pow(2, Math.min(combo, 12) / 12);
        this.tone(base, 0.07, { vol: 0.1 });
        this.tone(base * 1.5, 0.1, { vol: 0.1, at: 0.06 });
        this.noise(0.18, { vol: 0.1, hp: 400 });
    }
    headshot() {
        this.tone(1760, 0.16, { type: 'triangle', vol: 0.16, at: 0.03 });
    }
    gold() {
        [660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.13, at: i * 0.06 }));
    }
    bugDown() {
        this.tone(300, 0.1, { vol: 0.1, to: 900 });
    }
    hurt() {
        this.tone(140, 0.35, { type: 'sawtooth', vol: 0.25, to: 45 });
        this.noise(0.3, { vol: 0.2, hp: 200 });
    }
    warn() {
        this.tone(620, 0.08, { vol: 0.06 });
        this.tone(620, 0.08, { vol: 0.06, at: 0.12 });
    }
    tick() {
        this.tone(1200, 0.05, { vol: 0.08 });
    }
    sprint() {
        [330, 440, 660].forEach((f, i) => this.tone(f, 0.18, { type: 'sawtooth', vol: 0.1, at: i * 0.09, cutoff: 2000 }));
    }
    over() {
        [440, 330, 220, 110].forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', vol: 0.14, at: i * 0.16, cutoff: 1500 }));
    }

    startMusic() {
        if (!this.ctx || this.timer) return;
        const stepDur = 60 / 118 / 4;
        let step = 0;
        let next = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => {
            while (next < this.ctx.currentTime + 0.25) {
                const at = next - this.ctx.currentTime;
                const freq = 55 * Math.pow(2, BASS[step % 16] / 12);
                this.tone(freq, stepDur * 0.9, { type: 'sawtooth', vol: 0.09, at, cutoff: 500 });
                if (step % 4 === 0) this.tone(120, 0.14, { type: 'sine', vol: 0.3, to: 40, at });
                if (step % 4 === 2) this.noise(0.04, { vol: 0.05, hp: 6000, at });
                if (step % 8 === 4) this.noise(0.12, { vol: 0.08, hp: 1500, at });
                step++;
                next += stepDur;
            }
        }, 60);
    }

    stopMusic() {
        clearInterval(this.timer);
        this.timer = null;
    }
}
