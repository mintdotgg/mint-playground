import { BALL, COLORS, COURT, FIXED_TIMESTEP, GAME_SECONDS } from './config.js';
import { GameTimer } from './GameTimer.js';
import { InputController } from './InputController.js';
import { getLaunchVelocity, isBallOutOfBounds, stepBall } from './Physics.js';
import { GameRenderer } from './Renderer.js';
import { getBasketCrossing, getBasketValue, isThreePointMode } from './Scoring.js';
import { SoundSystem } from './Sound.js';
import { createGameState, resetBall } from './state.js';

export class Game {
  constructor(canvas, modelCanvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.state = createGameState();
    this.timer = new GameTimer(GAME_SECONDS);
    this.renderer = new GameRenderer(canvas, modelCanvas);
    this.sound = new SoundSystem();
    this.input = new InputController(canvas, {
      start: (point, pointerId, pointerType) => this.beginDrag(point, pointerId, pointerType),
      move: (point) => this.moveDrag(point),
      end: (point) => this.releaseDrag(point),
      cancel: () => this.cancelDrag(),
    });

    this.accumulator = 0;
    this.retiredBallAccumulator = 0;
    this.nextRetiredBallId = 1;
    this.lastTime = performance.now();
    this.fpsSamples = [];
    this.assets = null;
    this.lastBasket = null;
    this.lastRimReset = null;
    this.lastFloorReset = null;
    this.pausedForScreenshot = false;
    this.testSeed = 20260714;
    this.animationFrame = null;
    this.lastUi = {
      score: null,
      streak: null,
      time: null,
      phase: null,
      ballMode: null,
      power: null,
      threePointMode: null,
    };

    this.startGame = this.startGame.bind(this);
    this.pauseGame = this.pauseGame.bind(this);
    this.resumeGame = this.resumeGame.bind(this);
    this.togglePause = this.togglePause.bind(this);
    this.toggleMute = this.toggleMute.bind(this);
    this.loop = this.loop.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.preventContextMenu = (event) => event.preventDefault();

    ui.startButton.addEventListener('click', this.startGame);
    ui.playAgainButton.addEventListener('click', this.startGame);
    ui.restartButton.addEventListener('click', this.startGame);
    ui.pauseButton.addEventListener('click', this.togglePause);
    ui.resumeButton.addEventListener('click', this.resumeGame);
    ui.muteButton.addEventListener('click', this.toggleMute);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('keydown', this.onKeyDown);

    this.installDiagnostics();
    this.updateUi(true);
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  setAssets(assets) {
    this.assets = assets;
    this.renderer.setAssets(assets);
  }

  requiresFallbackImages() {
    return !this.renderer.isWebglAvailable();
  }

  async startGame() {
    void this.sound.unlock().catch(() => {});
    this.state = createGameState();
    this.lastBasket = null;
    this.lastRimReset = null;
    this.lastFloorReset = null;
    this.state.phase = 'playing';
    this.timer.start(GAME_SECONDS);
    this.accumulator = 0;
    this.retiredBallAccumulator = 0;
    this.nextRetiredBallId = 1;
    this.lastTime = performance.now();
    this.input.cancelActivePointer();
    this.cancelDrag();
    this.hideOverlay(this.ui.startScreen);
    this.hideOverlay(this.ui.pauseScreen);
    this.hideOverlay(this.ui.gameOverScreen);
    this.ui.swishBanner.classList.remove('show', 'snapshot-show');
    this.ui.swishBanner.textContent = 'Swish!';
    this.ui.liveStatus.textContent = 'Game started. Sixty seconds on the clock.';
    this.updateUi(true);
  }

  pauseGame({ moveFocus = true, message = 'Game paused.' } = {}) {
    if (this.state.phase !== 'playing') return false;
    this.state.phase = 'paused';
    this.timer.stop();
    this.input.cancelActivePointer();
    this.cancelDrag();
    this.showOverlay(this.ui.pauseScreen);
    this.ui.liveStatus.textContent = message;
    this.updateUi(true);
    if (moveFocus && !document.hidden) {
      window.setTimeout(() => this.ui.resumeButton.focus(), 120);
    }
    return true;
  }

  resumeGame() {
    if (this.state.phase !== 'paused') return false;
    this.state.phase = 'playing';
    this.timer.resume();
    this.lastTime = performance.now();
    this.hideOverlay(this.ui.pauseScreen);
    this.ui.liveStatus.textContent = 'Game resumed.';
    this.updateUi(true);
    window.setTimeout(() => this.ui.pauseButton.focus(), 80);
    return true;
  }

  togglePause() {
    if (this.state.phase === 'playing') return this.pauseGame();
    if (this.state.phase === 'paused') return this.resumeGame();
    return false;
  }

  endGame() {
    if (this.state.phase !== 'playing' && this.state.phase !== 'paused') return;
    this.state.phase = 'over';
    this.state.threePointMode = false;
    this.timer.stop();
    this.input.cancelActivePointer();
    this.cancelDrag();
    this.state.ball.vx = 0;
    this.state.ball.vy = 0;
    this.ui.swishBanner.classList.remove('show', 'snapshot-show');
    this.ui.finalScore.value = String(this.state.score);
    this.ui.finalScore.textContent = String(this.state.score);
    const accuracy = this.state.shotsTaken > 0
      ? Math.round((this.state.madeShots / this.state.shotsTaken) * 100)
      : 0;
    this.ui.finalAccuracy.value = `${accuracy}%`;
    this.ui.finalAccuracy.textContent = `${accuracy}%`;
    const peakMultiplier = `×${Math.max(1, this.state.bestStreak)}`;
    this.ui.finalStreak.value = peakMultiplier;
    this.ui.finalStreak.textContent = peakMultiplier;
    this.ui.resultMessage.textContent = this.getResultMessage(this.state.score);
    this.hideOverlay(this.ui.pauseScreen);
    this.showOverlay(this.ui.gameOverScreen);
    this.ui.liveStatus.textContent = `Time's up. Final score: ${this.state.score}.`;
    this.sound.endGame();
    this.updateUi(true);
    window.setTimeout(() => this.ui.playAgainButton.focus(), 180);
  }

  getResultMessage(score) {
    if (score === 0) return 'The next one is going in.';
    if (score < 6) return 'Nice touch — run it back!';
    if (score < 15) return 'You found your rhythm!';
    return 'Certified bucket getter!';
  }

  showOverlay(element) {
    element.classList.add('visible');
    element.setAttribute('aria-hidden', 'false');
  }

  hideOverlay(element) {
    element.classList.remove('visible');
    element.setAttribute('aria-hidden', 'true');
  }

  async toggleMute() {
    await this.sound.unlock();
    const muted = this.sound.toggleMuted();
    this.ui.muteButton.setAttribute('aria-pressed', String(muted));
    this.ui.muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    this.ui.muteButton.classList.toggle('muted', muted);
    this.ui.liveStatus.textContent = muted ? 'Sound muted.' : 'Sound on.';
  }

  beginDrag(point, pointerId, pointerType) {
    const { ball } = this.state;
    if (this.state.phase !== 'playing' || ball.mode !== 'ready') return false;
    if (Math.hypot(point.x - ball.x, point.y - ball.y) > ball.radius + 25) return false;
    this.state.drag.active = true;
    this.state.drag.pointerId = pointerId;
    this.state.drag.pointerType = pointerType;
    this.moveDrag(point);
    void this.sound.unlock();
    return true;
  }

  moveDrag(point) {
    if (!this.state.drag.active) return;
    const { ball, drag } = this.state;
    const rawDx = point.x - ball.x;
    const rawDy = point.y - ball.y;
    const distance = Math.hypot(rawDx, rawDy);
    const scale = distance > BALL.maxDragDistance ? BALL.maxDragDistance / distance : 1;
    drag.x = point.x;
    drag.y = point.y;
    drag.dx = rawDx * scale;
    drag.dy = rawDy * scale;
    drag.distance = Math.min(distance, BALL.maxDragDistance);
  }

  releaseDrag(point) {
    if (!this.state.drag.active) return;
    this.moveDrag(point);
    const { drag, ball } = this.state;
    const launch = getLaunchVelocity(drag.dx, drag.dy);
    drag.active = false;
    drag.pointerId = null;
    if (!launch || this.state.phase !== 'playing') return;

    ball.vx = launch.vx;
    ball.vy = launch.vy;
    ball.mode = 'flying';
    ball.shotAge = 0;
    ball.restTime = 0;
    ball.floorContactAge = null;
    ball.scoredThisShot = false;
    ball.missRecorded = false;
    this.state.shotsTaken += 1;
    this.sound.shoot(launch.speed / BALL.maxLaunchSpeed);
    this.ui.liveStatus.textContent = 'Shot released.';
  }

  cancelDrag() {
    this.state.drag.active = false;
    this.state.drag.pointerId = null;
    this.state.drag.dx = 0;
    this.state.drag.dy = 0;
    this.state.drag.distance = 0;
  }

  loop(now) {
    // Starting/restarting can reset lastTime between a queued RAF timestamp and
    // its callback; clamp both ends so the countdown can never move backward.
    // Retain real-time game feel on lower-power/mobile GPUs. Visibility
    // changes reset lastTime separately, so a 100 ms ceiling is enough to
    // absorb a slow render without making a shot take twice as long.
    const realDelta = Math.max(0, Math.min((now - this.lastTime) / 1000, 0.1));
    this.lastTime = now;
    this.update(realDelta);
    this.renderer.render(this.state);
    this.updateUi();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  update(deltaSeconds) {
    this.state.frame += 1;
    if (this.pausedForScreenshot) return;
    this.state.elapsed += deltaSeconds;
    this.trackFps(deltaSeconds);

    if (this.state.phase === 'playing') {
      const expired = this.timer.update(deltaSeconds);
      this.state.timeRemaining = this.timer.remaining;
      const threePointMode = isThreePointMode(this.state.timeRemaining);
      if (threePointMode !== this.state.threePointMode) {
        this.state.threePointMode = threePointMode;
        if (threePointMode) {
          this.ui.liveStatus.textContent = 'Final 15 seconds. Three-point mode is active.';
        }
      }
      if (expired) this.endGame();
    }

    const ball = this.state.ball;
    this.updateRetiredBalls(deltaSeconds);
    if (this.state.phase === 'playing' && ball.mode === 'flying') {
      this.accumulator += deltaSeconds;
      while (this.accumulator >= FIXED_TIMESTEP) {
        ball.shotAge += FIXED_TIMESTEP;
        const hadRimContact = ball.rimContactAge !== null;
        stepBall(ball, FIXED_TIMESTEP, (type, impact) => this.handleCollision(type, impact));
        const crossing = getBasketCrossing(ball, COURT.hoop);
        if (crossing) this.scoreBasket(crossing);

        if (hadRimContact) {
          ball.rimContactAge = Math.min(
            BALL.rimResetDelay,
            ball.rimContactAge + FIXED_TIMESTEP,
          );
        }
        if (ball.floorContactAge !== null) ball.floorContactAge += FIXED_TIMESTEP;

        if (ball.rimContactAge >= BALL.rimResetDelay) {
          this.lastRimReset = {
            frame: this.state.frame,
            contactAge: ball.rimContactAge,
          };
          this.retainBallUntilFloor(ball);
          resetBall(ball);
          this.accumulator = 0;
          break;
        }

        const floorResetReady = ball.floorContactAge >= BALL.floorResetDelay;
        if (floorResetReady) {
          this.lastFloorReset = {
            frame: this.state.frame,
            contactAge: ball.floorContactAge,
            shotAge: ball.shotAge,
          };
        }
        const shotFinished =
          floorResetReady ||
          ball.shotAge > BALL.maxShotSeconds ||
          isBallOutOfBounds(ball);
        if (shotFinished) {
          this.beginBallReset();
          this.accumulator = 0;
          break;
        }
        this.accumulator -= FIXED_TIMESTEP;
      }
    } else {
      this.accumulator = 0;
    }

    if (this.state.phase === 'playing' && ball.mode === 'resetting') {
      ball.resetTime += deltaSeconds;
      if (ball.resetTime >= BALL.resetSeconds) resetBall(ball);
    }

    this.updateEffects(deltaSeconds);
  }

  retainBallUntilFloor(ball) {
    if (ball.floorContactAge !== null) return false;
    this.state.retiredBalls.push({
      ...ball,
      id: this.nextRetiredBallId,
    });
    this.nextRetiredBallId += 1;
    return true;
  }

  updateRetiredBalls(deltaSeconds) {
    const balls = this.state.retiredBalls;
    if (this.state.phase !== 'playing' || balls.length === 0) {
      this.retiredBallAccumulator = 0;
      return;
    }

    this.retiredBallAccumulator += deltaSeconds;
    while (this.retiredBallAccumulator >= FIXED_TIMESTEP && balls.length > 0) {
      for (let index = balls.length - 1; index >= 0; index -= 1) {
        const ball = balls[index];
        ball.shotAge += FIXED_TIMESTEP;
        stepBall(ball, FIXED_TIMESTEP, (type, impact) => this.handleCollision(type, impact));
        const crossing = getBasketCrossing(ball, COURT.hoop);
        if (crossing) this.scoreBasket(crossing, ball);
        if (
          ball.floorContactAge !== null ||
          ball.shotAge > BALL.maxShotSeconds ||
          isBallOutOfBounds(ball)
        ) {
          this.registerMiss(ball);
          balls.splice(index, 1);
        }
      }
      this.retiredBallAccumulator -= FIXED_TIMESTEP;
    }
  }

  trackFps(deltaSeconds) {
    if (deltaSeconds <= 0) return;
    this.fpsSamples.push(1 / deltaSeconds);
    if (this.fpsSamples.length > 45) this.fpsSamples.shift();
    const total = this.fpsSamples.reduce((sum, sample) => sum + sample, 0);
    this.state.fps = Math.round(total / this.fpsSamples.length);
  }

  handleCollision(type, impact) {
    if (type === 'rim' || type === 'backboard') {
      this.state.effects.rimFlash = Math.min(1, 0.32 + impact / 900);
      this.sound.rim(impact);
    } else if (type === 'floor') {
      this.sound.floor(impact);
    }
  }

  scoreBasket(crossing, ball = this.state.ball) {
    const { effects } = this.state;
    if (!crossing || ball.scoredThisShot) return false;
    ball.scoredThisShot = true;
    this.state.streak += 1;
    this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
    const multiplier = this.state.streak;
    const basePoints = getBasketValue(this.state.timeRemaining);
    const points = getBasketValue(this.state.timeRemaining, multiplier);
    this.state.score += points;
    this.state.madeShots += 1;
    this.lastBasket = {
      source: 'downward-rim-plane-crossing',
      frame: this.state.frame,
      shotAge: ball.shotAge,
      ballLifecycle: ball === this.state.ball ? 'active' : 'retired',
      basePoints,
      multiplier,
      points,
      threePointMode: basePoints > 1,
      ...crossing,
    };
    effects.swishTime = 1.05;
    effects.scorePulse = 1;
    this.spawnScoreParticles();
    this.sound.score(basePoints, multiplier);
    this.ui.score.classList.remove('score-pop');
    void this.ui.score.offsetWidth;
    this.ui.score.classList.add('score-pop');
    this.ui.swishBanner.classList.remove('show');
    this.ui.swishBanner.textContent = `+${points} · ×${multiplier}`;
    void this.ui.swishBanner.offsetWidth;
    this.ui.swishBanner.classList.add('show');
    this.ui.liveStatus.textContent = `${basePoints}-point basket times ${multiplier}. ${points} added. Score ${this.state.score}.`;
    return true;
  }

  spawnScoreParticles() {
    const colors = [COLORS.mint, COLORS.mintDeep, COLORS.orange, COLORS.coral, COLORS.white];
    for (let i = 0; i < 24; i += 1) {
      const angle = -Math.PI + (i / 23) * Math.PI;
      const speed = 125 + ((i * 47) % 105);
      this.state.effects.particles.push({
        x: (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2,
        y: COURT.hoop.rimY + 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 55,
        rotation: i * 0.61,
        rotationSpeed: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4)),
        size: 5 + (i % 4),
        color: colors[i % colors.length],
        shape: i % 3 === 0 ? 'circle' : 'dash',
        life: 0.72 + (i % 5) * 0.055,
        maxLife: 0.72 + (i % 5) * 0.055,
      });
    }
  }

  updateEffects(deltaSeconds) {
    const effects = this.state.effects;
    effects.rimFlash = Math.max(0, effects.rimFlash - deltaSeconds * 3.8);
    effects.scorePulse = Math.max(0, effects.scorePulse - deltaSeconds * 4.5);
    effects.swishTime = Math.max(0, effects.swishTime - deltaSeconds);
    if (effects.swishTime === 0) this.ui.swishBanner.classList.remove('show');

    for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
      const particle = effects.particles[i];
      particle.life -= deltaSeconds;
      if (particle.life <= 0) {
        effects.particles.splice(i, 1);
        continue;
      }
      particle.vy += 430 * deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.rotation += particle.rotationSpeed * deltaSeconds;
    }

    const { ball } = this.state;
    if (this.state.phase === 'playing' && ball.mode === 'flying') {
      const latest = effects.trail.at(-1);
      if (!latest || Math.hypot(latest.x - ball.x, latest.y - ball.y) >= 22) {
        effects.trail.push({ x: ball.x, y: ball.y, life: 0.34, maxLife: 0.34 });
        if (effects.trail.length > 20) effects.trail.shift();
      }
    }
    for (let i = effects.trail.length - 1; i >= 0; i -= 1) {
      effects.trail[i].life -= deltaSeconds;
      if (effects.trail[i].life <= 0) effects.trail.splice(i, 1);
    }
  }

  beginBallReset() {
    const ball = this.state.ball;
    if (ball.mode !== 'flying') return;
    this.registerMiss(ball);
    ball.mode = 'resetting';
    ball.resetTime = 0;
    ball.vx = 0;
    ball.vy = 0;
  }

  registerMiss(ball) {
    if (!ball || ball.scoredThisShot || ball.missRecorded) return false;
    ball.missRecorded = true;
    this.state.streak = 0;
    this.ui.liveStatus.textContent = 'Missed shot. Multiplier reset to times one.';
    return true;
  }

  updateUi(force = false) {
    const time = Math.ceil(this.state.timeRemaining);
    if (force || time !== this.lastUi.time) {
      this.ui.timer.value = String(time);
      this.ui.timer.textContent = String(time).padStart(2, '0');
      const urgent = this.state.phase === 'playing' && time <= 10;
      this.ui.timerReadout.classList.toggle('urgent', urgent);
      this.lastUi.time = time;
    }
    if (force || this.state.score !== this.lastUi.score) {
      this.ui.score.value = String(this.state.score);
      this.ui.score.textContent = String(this.state.score);
      this.lastUi.score = this.state.score;
    }
    if (force || this.state.streak !== this.lastUi.streak) {
      const streakLabel = `×${Math.max(1, this.state.streak)}`;
      this.ui.streak.value = streakLabel;
      this.ui.streak.textContent = streakLabel;
      this.ui.mobileStreak.value = streakLabel;
      this.ui.mobileStreak.textContent = streakLabel;
      this.ui.streak.classList.toggle('is-hot', this.state.streak > 1);
      this.lastUi.streak = this.state.streak;
    }
    if (force || this.state.threePointMode !== this.lastUi.threePointMode) {
      this.ui.gameStage.classList.toggle('three-point-mode', this.state.threePointMode);
      this.ui.timerReadout.classList.toggle('three-point', this.state.threePointMode);
      this.lastUi.threePointMode = this.state.threePointMode;
    }
    if (force || this.state.phase !== this.lastUi.phase) {
      const paused = this.state.phase === 'paused';
      const pausable = this.state.phase === 'playing' || paused;
      this.ui.pauseButton.disabled = !pausable;
      this.ui.pauseButton.classList.toggle('paused', paused);
      this.ui.pauseButton.setAttribute('aria-pressed', String(paused));
      this.ui.pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    }
    const power = this.state.drag.active
      ? Math.min(1, this.state.drag.distance / BALL.maxDragDistance)
      : 0;
    const roundedPower = Math.round(power * 100);
    if (force || roundedPower !== this.lastUi.power) {
      this.ui.powerValue.textContent = String(roundedPower).padStart(2, '0');
      this.ui.mobilePowerValue.value = `${String(roundedPower).padStart(2, '0')}%`;
      this.ui.mobilePowerValue.textContent = `${String(roundedPower).padStart(2, '0')}%`;
      this.ui.powerFill.style.width = `${roundedPower}%`;
      this.ui.mobilePowerFill.style.width = `${roundedPower}%`;
      this.ui.gameStage.style.setProperty('--shot-power', power.toFixed(3));
      this.lastUi.power = roundedPower;
    }
    const { phase } = this.state;
    const ballMode = this.state.ball.mode;
    if (force || ballMode !== this.lastUi.ballMode || phase !== this.lastUi.phase || this.state.drag.active) {
      let shotStatus = 'Drag to aim';
      let instruction = 'Drag the ball toward the hoop and release to shoot.';
      if (phase === 'paused') {
        shotStatus = 'Timeout';
      } else if (phase === 'over') {
        shotStatus = 'Final buzzer';
      } else if (phase !== 'playing') {
        shotStatus = 'Court ready';
      } else if (this.state.drag.active) {
        shotStatus = power < 0.34 ? 'Soft touch' : power < 0.72 ? 'In range' : 'Full send';
        instruction = 'Release to shoot.';
      } else if (ballMode === 'flying') {
        shotStatus = 'Shot in flight';
        instruction = 'Track the arc.';
      } else if (ballMode === 'resetting') {
        shotStatus = 'Next ball';
        instruction = 'Resetting the ball.';
      }
      this.ui.shotStatus.textContent = shotStatus;
      this.ui.mobileShotStatus.textContent = shotStatus;
      this.ui.instruction.textContent = instruction;
      this.lastUi.ballMode = ballMode;
    }
    this.ui.gameStage.style.setProperty(
      '--time-progress',
      `${Math.max(0, Math.min(1, this.state.timeRemaining / GAME_SECONDS))}`,
    );
    this.ui.gameStage.classList.toggle('is-playing', phase === 'playing');
    this.ui.gameStage.classList.toggle('is-aiming', this.state.drag.active);
    this.ui.gameStage.classList.toggle('is-flying', ballMode === 'flying');
    this.ui.gameStage.classList.toggle('is-scoring', this.state.effects.scorePulse > 0);
    this.ui.mobileDeck.classList.toggle('is-dimmed', phase === 'paused' || phase === 'over');
    this.canvas.classList.toggle('can-grab', this.state.phase === 'playing' && this.state.ball.mode === 'ready');
    this.canvas.classList.toggle('is-dragging', this.state.drag.active);
    this.lastUi.phase = this.state.phase;
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.lastTime = performance.now();
      if (this.state.phase === 'playing') {
        this.pauseGame({
          moveFocus: false,
          message: 'Game paused because the tab was hidden.',
        });
      } else {
        this.input.cancelActivePointer();
        this.cancelDrag();
      }
    }
  }

  onKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (this.state.phase !== 'playing' && this.state.phase !== 'paused') return;
    event.preventDefault();
    this.togglePause();
  }

  setTimeRemaining(seconds) {
    const value = Math.max(0, Number(seconds));
    this.timer.remaining = Number.isFinite(value) ? value : 0;
    this.state.timeRemaining = this.timer.remaining;
    this.state.threePointMode = isThreePointMode(this.state.timeRemaining);
    this.updateUi(true);
  }

  installDiagnostics() {
    // Diagnostics getters need a stable reference to the live Game instance.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const game = this;
    const diagnostics = {
      get frame() { return game.state.frame; },
      get phase() { return game.state.phase; },
      get score() { return game.state.score; },
      get shotsTaken() { return game.state.shotsTaken; },
      get madeShots() { return game.state.madeShots; },
      get streak() { return game.state.streak; },
      get bestStreak() { return game.state.bestStreak; },
      get timeRemaining() { return game.state.timeRemaining; },
      get threePointMode() { return game.state.threePointMode; },
      get testSeed() { return game.testSeed; },
      get fps() { return game.state.fps; },
      get ball() {
        const {
          x,
          y,
          vx,
          vy,
          radius,
          mode,
          shotAge,
          rimContactAge,
          floorContactAge,
          scoredThisShot,
        } = game.state.ball;
        return {
          x,
          y,
          vx,
          vy,
          radius,
          mode,
          shotAge,
          rimContactAge,
          floorContactAge,
          scoredThisShot,
        };
      },
      get retiredBalls() {
        return game.state.retiredBalls.map((ball) => ({
          id: ball.id,
          x: ball.x,
          y: ball.y,
          vx: ball.vx,
          vy: ball.vy,
          radius: ball.radius,
          shotAge: ball.shotAge,
          floorContactAge: ball.floorContactAge,
        }));
      },
      get lastBasket() { return game.lastBasket ? { ...game.lastBasket } : null; },
      get lastRimReset() { return game.lastRimReset ? { ...game.lastRimReset } : null; },
      get lastFloorReset() { return game.lastFloorReset ? { ...game.lastFloorReset } : null; },
      get input() {
        return { active: game.state.drag.active, pointerId: game.state.drag.pointerId };
      },
      get assets() {
        return {
          fallbackImagesRequested: game.assets?.fallbackImagesRequested ?? null,
          basketball: game.assets?.basketball?.loaded ?? false,
          hoop: game.assets?.hoop?.loaded ?? false,
          basketballGlb: game.assets?.basketball?.glb?.loaded ?? false,
          hoopGlb: game.assets?.hoop?.glb?.loaded ?? false,
          logoGlb: game.assets?.logo?.glb?.loaded ?? false,
          modelStats: {
            basketball: game.assets?.basketball?.glb?.stats ?? null,
            hoop: game.assets?.hoop?.glb?.stats ?? null,
            logo: game.assets?.logo?.glb?.stats ?? null,
          },
        };
      },
      get graphics() {
        return game.renderer.getGraphicsDiagnostics();
      },
      get audio() {
        return game.sound.getDiagnostics();
      },
      physics: {
        engine: 'custom-2d-fixed-step',
        timestep: FIXED_TIMESTEP,
        get bodies() { return 1 + game.state.retiredBalls.length; },
        colliders: 4,
        sensors: 1,
        ccd: false,
        maxLaunchTravelPerStep: BALL.maxLaunchSpeed * FIXED_TIMESTEP,
        collisionProxies: {
          rim: [
            { x: COURT.hoop.rimLeft, y: COURT.hoop.rimY, radius: COURT.hoop.rimRadius },
            { x: COURT.hoop.rimRight, y: COURT.hoop.rimY, radius: COURT.hoop.rimRadius },
          ],
          backboard: { ...COURT.hoop.backboard },
          floorY: COURT.floorY,
        },
        scoreSensor: {
          type: 'downward-rim-plane-crossing',
          y: COURT.hoop.rimY,
          openingLeft: COURT.hoop.rimLeft + Math.max(COURT.hoop.scoreInset, BALL.radius + COURT.hoop.rimRadius),
          openingRight: COURT.hoop.rimRight - Math.max(COURT.hoop.scoreInset, BALL.radius + COURT.hoop.rimRadius),
          duplicateGuard: 'scoredThisShot',
        },
        resetTiming: {
          rimContactToReadySeconds: BALL.rimResetDelay,
          floorContactDelaySeconds: BALL.floorResetDelay,
          transitionSeconds: BALL.resetSeconds,
          totalAfterFloorContactSeconds: BALL.floorResetDelay + BALL.resetSeconds,
        },
      },
    };
    window.__MINT_HOOPS_DIAGNOSTICS__ = diagnostics;
    window.__THREE_GAME_DIAGNOSTICS__ = diagnostics;

    // Mutation hooks exist only for local development and automated browser
    // runs. A normal production player can earn points only through the
    // authoritative rim-plane sensor in update().
    if (!import.meta.env.DEV && navigator.webdriver !== true) return;

    const ensurePlaying = async () => {
      if (game.state.phase === 'paused') {
        game.resumeGame();
      } else if (game.state.phase !== 'playing') {
        await game.startGame();
      }
    };
    const hooks = {
      startGame: () => game.startGame(),
      seed: (value) => {
        const seed = Number(value) >>> 0;
        game.testSeed = seed;
        return seed;
      },
      setState: async (name) => {
        if (name === 'game-over') {
          await ensurePlaying();
          game.endGame();
          return game.state.phase;
        }
        await ensurePlaying();
        if (name === 'active-play') game.setTimeRemaining(42);
        if (name === 'three-point') game.setTimeRemaining(15);
        if (name === 'paused') game.pauseGame({ moveFocus: false });
        return game.state.phase;
      },
      setTime: (seconds) => game.setTimeRemaining(seconds),
      shootVelocity: (vx, vy) => {
        if (game.state.phase !== 'playing') return false;
        const ball = game.state.ball;
        resetBall(ball);
        ball.vx = Number(vx);
        ball.vy = Number(vy);
        ball.mode = 'flying';
        return true;
      },
      placeBall: ({ x, y, vx = 0, vy = 0, mode = 'flying' }) => {
        const ball = game.state.ball;
        ball.x = Number(x);
        ball.y = Number(y);
        ball.previousX = ball.x;
        ball.previousY = ball.y;
        ball.vx = Number(vx);
        ball.vy = Number(vy);
        ball.mode = mode;
        ball.scoredThisShot = false;
      },
      forceGameOver: () => game.endGame(),
      setPausedForScreenshot: (paused) => {
        game.pausedForScreenshot = Boolean(paused);
      },
      setReducedMotion: (enabled) => {
        game.renderer.setReducedMotion(enabled);
      },
      stabilizePhysicsEvidenceFrame: () => {
        game.state.effects.particles.length = 0;
        game.state.effects.rimFlash = 0;
        game.state.effects.scorePulse = 0;
      },
      setCaptureSafeMode: (enabled) => {
        window.__MINT_HOOPS_CAPTURE_SAFE_MODE__ = Boolean(enabled);
      },
      setDragPreview: (dx, dy) => {
        const drag = game.state.drag;
        const distance = Math.hypot(Number(dx), Number(dy));
        const scale = distance > BALL.maxDragDistance ? BALL.maxDragDistance / distance : 1;
        drag.active = true;
        drag.pointerId = -1;
        drag.dx = Number(dx) * scale;
        drag.dy = Number(dy) * scale;
        drag.distance = Math.min(distance, BALL.maxDragDistance);
      },
      showScoreFeedbackForScreenshot: (targetMultiplier = 1) => {
        game.cancelDrag();
        if (game.state.score === 0) {
          const ball = game.state.ball;
          const centerX = (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2;
          const makes = Math.max(1, Math.floor(Number(targetMultiplier) || 1));
          for (let make = 0; make < makes; make += 1) {
            resetBall(ball);
            ball.previousX = centerX;
            ball.x = centerX;
            ball.previousY = COURT.hoop.rimY - 2;
            ball.y = COURT.hoop.rimY + 2;
            ball.vy = 210;
            ball.mode = 'flying';
            game.scoreBasket(getBasketCrossing(ball, COURT.hoop));
          }
        }
        game.updateEffects(0.16);
        game.pausedForScreenshot = true;
        game.ui.swishBanner.classList.remove('show');
        game.ui.swishBanner.classList.add('snapshot-show');
        game.ui.score.classList.remove('score-pop');
        game.updateUi(true);
      },
      getState: () => ({
        phase: game.state.phase,
        score: game.state.score,
        timeRemaining: game.state.timeRemaining,
        ball: { ...game.state.ball },
      }),
    };
    window.__MINT_HOOPS_TEST_HOOKS__ = hooks;
    window.__THREE_GAME_TEST_HOOKS__ = hooks;
  }

  destroy() {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.ui.startButton.removeEventListener('click', this.startGame);
    this.ui.playAgainButton.removeEventListener('click', this.startGame);
    this.ui.restartButton.removeEventListener('click', this.startGame);
    this.ui.pauseButton.removeEventListener('click', this.togglePause);
    this.ui.resumeButton.removeEventListener('click', this.resumeGame);
    this.ui.muteButton.removeEventListener('click', this.toggleMute);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.input.destroy();
    this.renderer.destroy();
    this.sound.destroy();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
