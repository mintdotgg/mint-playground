export class SoundSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.events = { shoot: 0, rim: 0, floor: 0, score: 0, endGame: 0 };
  }

  async unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.18);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1337;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.015);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ frequency, endFrequency = frequency, duration = 0.12, gain = 0.16, type = 'sine', delay = 0 }) {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  noise(duration = 0.08, gain = 0.08, highpass = 500) {
    if (!this.context || !this.master || !this.noiseBuffer || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }

  shoot(power = 1) {
    this.events.shoot += 1;
    this.tone({ frequency: 180 + power * 65, endFrequency: 95, duration: 0.16, gain: 0.11, type: 'sine' });
    this.noise(0.1, 0.045, 380);
  }

  rim(impact = 300) {
    this.events.rim += 1;
    const pitch = Math.min(520, 250 + impact * 0.22);
    this.tone({ frequency: pitch, endFrequency: pitch * 0.72, duration: 0.09, gain: 0.12, type: 'triangle' });
  }

  floor(impact = 200) {
    if (impact < 150) return;
    this.events.floor += 1;
    this.tone({ frequency: 105, endFrequency: 62, duration: 0.08, gain: 0.045, type: 'sine' });
  }

  score(basePoints = 1, multiplier = 1) {
    this.events.score += 1;
    const streakLift = Math.min(4, Math.max(0, multiplier - 1)) * 18;
    this.noise(0.16, 0.05, 900);
    this.tone({ frequency: 523.25 + streakLift, duration: 0.18, gain: 0.13, type: 'sine' });
    this.tone({ frequency: 659.25 + streakLift, duration: 0.2, gain: 0.12, type: 'sine', delay: 0.07 });
    this.tone({ frequency: 783.99 + streakLift, duration: 0.25, gain: 0.11, type: 'sine', delay: 0.14 });
    if (basePoints > 1) {
      this.tone({ frequency: 1046.5, duration: 0.28, gain: 0.1, type: 'triangle', delay: 0.21 });
    }
  }

  endGame() {
    this.events.endGame += 1;
    this.tone({ frequency: 392, endFrequency: 196, duration: 0.42, gain: 0.13, type: 'triangle' });
    this.tone({ frequency: 261.6, endFrequency: 130.8, duration: 0.44, gain: 0.1, type: 'triangle', delay: 0.12 });
  }

  getDiagnostics() {
    return {
      supported: Boolean(window.AudioContext || window.webkitAudioContext),
      contextState: this.context?.state ?? 'not-created',
      muted: this.muted,
      masterGain: this.master?.gain.value ?? (this.muted ? 0 : 0.72),
      events: { ...this.events },
      sources: 'procedural-web-audio',
    };
  }

  destroy() {
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}
