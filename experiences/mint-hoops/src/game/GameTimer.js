import { GAME_SECONDS } from './config.js';

export class GameTimer {
  constructor(duration = GAME_SECONDS) {
    this.duration = duration;
    this.remaining = duration;
    this.running = false;
  }

  start(duration = this.duration) {
    this.duration = duration;
    this.remaining = duration;
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  resume() {
    if (this.remaining <= 0) return false;
    this.running = true;
    return true;
  }

  update(deltaSeconds) {
    if (!this.running) return false;
    this.remaining = Math.max(0, this.remaining - deltaSeconds);
    if (this.remaining === 0) {
      this.running = false;
      return true;
    }
    return false;
  }
}
