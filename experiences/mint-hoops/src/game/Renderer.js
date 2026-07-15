import { BALL, COLORS, COURT, VIEWPORT } from './config.js';
import { ThreeModelLayer } from './ThreeModelLayer.js';

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

export class GameRenderer {
  constructor(canvas, modelCanvas) {
    this.canvas = canvas;
    // This canvas is now a transparent input/HUD surface. The WebGL canvas
    // beneath it owns the visible court, hoop, ball, lighting, and effects.
    // Transparent desynchronized canvases can leak black compositor tiles in
    // Chromium screenshots and some integrated GPUs, so keep the HUD surface
    // on the normal compositing path.
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.modelLayer = new ThreeModelLayer(modelCanvas);
    this.assets = null;
    this.dpr = 1;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  setAssets(assets) {
    this.assets = assets;
    this.modelLayer.setAssets(assets);
  }

  isWebglAvailable() {
    return this.modelLayer.isAvailable();
  }

  setReducedMotion(enabled) {
    this.modelLayer.setReducedMotion(enabled);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssScale = rect.width > 0 ? rect.width / VIEWPORT.width : 1;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 760 ? 1.5 : 2);
    // Match the backing store to the canvas's actual CSS footprint. Keeping a
    // fixed 1280×720 buffer on a 392 px phone stage needlessly shades ~10×
    // more pixels and makes touch shots feel delayed.
    this.dpr = cssScale * pixelRatio;
    const width = Math.max(1, Math.round(VIEWPORT.width * this.dpr));
    const height = Math.max(1, Math.round(VIEWPORT.height * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render(state) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);

    if (!this.modelLayer.isAvailable()) {
      // Canvas2D remains a graceful fallback for browsers without WebGL.
      this.drawBackground(ctx, state.elapsed);
      this.drawCourt(ctx);
      this.drawHoop(ctx, state.effects.rimFlash);
      this.drawParticles(ctx, state.effects.particles);
      for (const retiredBall of state.retiredBalls) {
        this.drawBall(ctx, retiredBall, false, state.elapsed);
      }
      this.drawBall(ctx, state.ball, state.drag.active, state.elapsed);
      this.drawForeground(ctx);
    }

    // WebGL uses the depth-aware arrow beside the ball. The screen-space meter
    // is retained only for the Canvas2D fallback.
    if (state.drag.active && !this.modelLayer.isAvailable()) this.drawAimFeedback(ctx, state);
    this.modelLayer.render(state);
  }

  drawBackground(ctx, elapsed) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT.height);
    gradient.addColorStop(0, '#FFFDF7');
    gradient.addColorStop(0.66, COLORS.cream);
    gradient.addColorStop(1, '#F6E9D2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

    // Large soft geometry gives the court depth without competing with aim.
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = COLORS.mintLight;
    ctx.beginPath();
    ctx.arc(1110, 82, 286, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.19;
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(85, 125, 152, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(23, 63, 53, 0.055)';
    ctx.lineWidth = 2;
    for (let x = 48; x < VIEWPORT.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 210, COURT.floorY);
      ctx.stroke();
    }
    ctx.restore();

    const drift = Math.sin(elapsed * 0.7) * 3;
    this.drawSpark(ctx, 332, 126 + drift, COLORS.orange, 0.4);
    this.drawSpark(ctx, 755, 86 - drift, COLORS.mintDeep, 0.35);
    this.drawSpark(ctx, 1180, 438 + drift, COLORS.coral, 0.32);
  }

  drawSpark(ctx, x, y, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    roundedRect(ctx, -6, -19, 12, 38, 6);
    ctx.fill();
    ctx.rotate(Math.PI / 2);
    roundedRect(ctx, -6, -19, 12, 38, 6);
    ctx.fill();
    ctx.restore();
  }

  drawCourt(ctx) {
    const floorGradient = ctx.createLinearGradient(0, COURT.floorY - 45, 0, VIEWPORT.height);
    floorGradient.addColorStop(0, '#EAD7B7');
    floorGradient.addColorStop(1, '#D9BA8A');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, COURT.floorY, VIEWPORT.width, VIEWPORT.height - COURT.floorY);

    ctx.fillStyle = COLORS.dark;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, COURT.floorY, VIEWPORT.width, 6);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.strokeStyle = 'rgba(23, 63, 53, 0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(568, COURT.floorY + 96, 190, 70, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(760, COURT.floorY);
    ctx.lineTo(760, VIEWPORT.height);
    ctx.stroke();
    ctx.restore();

    // The starting spot doubles as a subtle interaction affordance.
    ctx.save();
    ctx.strokeStyle = 'rgba(79, 198, 165, 0.5)';
    ctx.setLineDash([5, 9]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(BALL.startX, COURT.floorY + 3, 66, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawHoop(ctx, rimFlash = 0) {
    const hoop = COURT.hoop;
    if (this.assets?.hoop?.glb?.loaded) return;
    const generated = this.assets?.hoop?.loaded ? this.assets.hoop.image : null;

    // The Mint artifact is aligned by its authored rim coordinates so the art
    // and collision plane agree. Its source stand ends at the image boundary,
    // so a matching extension is drawn behind it down to the court floor.
    if (generated) {
      ctx.save();
      ctx.fillStyle = COLORS.dark;
      roundedRect(ctx, 1117, 426, 49, 209, 13);
      ctx.fill();
      ctx.fillStyle = COLORS.mintDeep;
      roundedRect(ctx, 1124, 432, 30, 190, 9);
      ctx.fill();
      ctx.fillStyle = COLORS.dark;
      roundedRect(ctx, 1089, 614, 119, 25, 12);
      ctx.fill();

      // Source rim: x 410..724, y 361 in a 1408×768 image.
      // Scale 0.414 maps it to the 130 px gameplay opening.
      ctx.drawImage(generated, 744, 145, 583, 318);

      const glow = Math.max(0, Math.min(1, rimFlash));
      ctx.globalAlpha = 0.82;
      ctx.shadowColor = glow > 0 ? COLORS.orange : 'transparent';
      ctx.shadowBlur = glow * 24;
      ctx.strokeStyle = COLORS.coral;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hoop.rimLeft, hoop.rimY);
      ctx.lineTo(hoop.rimRight, hoop.rimY);
      ctx.stroke();
      ctx.fillStyle = COLORS.orangeDeep;
      ctx.beginPath();
      ctx.arc(hoop.rimLeft, hoop.rimY, hoop.rimRadius * 0.72, 0, Math.PI * 2);
      ctx.arc(hoop.rimRight, hoop.rimY, hoop.rimRadius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Programmatic fallback: a complete hoop remains playable offline even if
    // the imported image is removed or fails to decode.
    ctx.save();
    ctx.fillStyle = COLORS.dark;
    roundedRect(ctx, 1110, 318, 24, 310, 12);
    ctx.fill();
    ctx.fillStyle = COLORS.mintDeep;
    roundedRect(ctx, 1099, 334, 15, 284, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.dark;
    roundedRect(ctx, 1058, 616, 119, 24, 12);
    ctx.fill();

    // Backboard with an inset mint target.
    ctx.shadowColor = 'rgba(23, 63, 53, 0.16)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    roundedRect(ctx, 1007, 132, 88, 226, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 7;
    roundedRect(ctx, 1007, 132, 88, 226, 16);
    ctx.stroke();
    ctx.strokeStyle = COLORS.mintDeep;
    ctx.lineWidth = 6;
    roundedRect(ctx, 1028, 224, 48, 74, 9);
    ctx.stroke();

    // Net sits behind the rim and flexes visually as a clean, readable cone.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const netTopY = hoop.rimY + 6;
    const netBottomY = hoop.rimY + 96;
    const left = hoop.rimLeft + 8;
    const right = hoop.rimRight - 8;
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      const x = left + (right - left) * t;
      const bottomX = 954 + 50 * t;
      ctx.beginPath();
      ctx.moveTo(x, netTopY);
      ctx.quadraticCurveTo(x + (t - 0.5) * 18, hoop.rimY + 54, bottomX, netBottomY);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.75;
    for (let y = hoop.rimY + 27; y <= hoop.rimY + 79; y += 18) {
      const inset = (y - hoop.rimY) * 0.17;
      ctx.beginPath();
      ctx.moveTo(left + inset, y);
      ctx.quadraticCurveTo((left + right) / 2, y + 8, right - inset, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const glow = Math.max(0, Math.min(1, rimFlash));
    ctx.shadowColor = glow > 0 ? COLORS.orange : 'transparent';
    ctx.shadowBlur = glow * 24;
    ctx.strokeStyle = COLORS.coral;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(hoop.rimLeft, hoop.rimY);
    ctx.lineTo(hoop.rimRight, hoop.rimY);
    ctx.stroke();
    ctx.fillStyle = COLORS.orangeDeep;
    ctx.beginPath();
    ctx.arc(hoop.rimLeft, hoop.rimY, hoop.rimRadius, 0, Math.PI * 2);
    ctx.arc(hoop.rimRight, hoop.rimY, hoop.rimRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawAimFeedback(ctx, state) {
    if (state.drag.distance < BALL.minDragDistance) return;
    const max = BALL.maxDragDistance;
    const power = Math.min(1, state.drag.distance / max);

    // Compact power meter, anchored near the ball instead of the HUD.
    ctx.save();
    const meterX = 114;
    const meterY = 675;
    ctx.fillStyle = 'rgba(23, 63, 53, 0.12)';
    roundedRect(ctx, meterX, meterY, 182, 13, 7);
    ctx.fill();
    const meterGradient = ctx.createLinearGradient(meterX, 0, meterX + 182, 0);
    meterGradient.addColorStop(0, COLORS.mintDeep);
    meterGradient.addColorStop(1, COLORS.orange);
    ctx.fillStyle = meterGradient;
    roundedRect(ctx, meterX, meterY, Math.max(10, 182 * power), 13, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.dark;
    ctx.font = '700 14px ui-rounded, system-ui, sans-serif';
    ctx.fillText('POWER', meterX, meterY - 10);
    ctx.restore();
  }

  drawBall(ctx, ball, isDragging, elapsed) {
    const resetProgress = ball.mode === 'resetting' ? Math.min(1, ball.resetTime / BALL.resetSeconds) : 0;
    const alpha = ball.mode === 'resetting' ? 1 - resetProgress : 1;
    const scale = ball.mode === 'resetting' ? 1 - resetProgress * 0.35 : isDragging ? 1.07 + Math.sin(elapsed * 10) * 0.018 : 1;

    const height = Math.max(0, COURT.floorY - (ball.y + ball.radius));
    const shadowScale = Math.max(0.28, 1 - height / 520);
    ctx.save();
    ctx.globalAlpha = 0.16 * alpha;
    ctx.fillStyle = COLORS.dark;
    ctx.beginPath();
    ctx.ellipse(ball.x + 5, COURT.floorY + 2, ball.radius * 1.18 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);
    ctx.scale(scale, scale);
    if (!this.assets?.basketball?.glb?.loaded) {
      const generated = this.assets?.basketball?.loaded ? this.assets.basketball.image : null;
      if (generated) {
        const size = ball.radius * 2.82;
        ctx.drawImage(generated, -size / 2, -size / 2, size, size);
      } else {
        this.drawFallbackBall(ctx, ball.radius);
      }
    }
    ctx.restore();
  }

  drawFallbackBall(ctx, radius) {
    const gradient = ctx.createRadialGradient(-10, -13, 3, 0, 0, radius * 1.18);
    gradient.addColorStop(0, '#FFBE62');
    gradient.addColorStop(0.58, COLORS.orange);
    gradient.addColorStop(1, COLORS.orangeDeep);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.bezierCurveTo(-9, -8, 9, -8, radius, 0);
    ctx.moveTo(-radius, 0);
    ctx.bezierCurveTo(-9, 8, 9, 8, radius, 0);
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(-10, -9, -10, 9, 0, radius);
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(10, -9, 10, 9, 0, radius);
    ctx.stroke();
    ctx.strokeStyle = COLORS.mintLight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-8, -9, radius * 0.54, Math.PI * 1.08, Math.PI * 1.63);
    ctx.stroke();
  }

  drawParticles(ctx, particles) {
    ctx.save();
    for (const particle of particles) {
      const life = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = life;
      ctx.fillStyle = particle.color;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      if (particle.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * life, 0, Math.PI * 2);
        ctx.fill();
      } else {
        roundedRect(ctx, -particle.size, -particle.size * 0.34, particle.size * 2, particle.size * 0.68, particle.size * 0.3);
        ctx.fill();
      }
      ctx.rotate(-particle.rotation);
      ctx.translate(-particle.x, -particle.y);
    }
    ctx.restore();
  }

  drawForeground(ctx) {
    const gradient = ctx.createLinearGradient(0, COURT.floorY - 18, 0, COURT.floorY + 9);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.24)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, COURT.floorY - 18, VIEWPORT.width, 27);
  }

  getGraphicsDiagnostics() {
    return this.modelLayer.getDiagnostics();
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    this.resizeObserver.disconnect();
    this.modelLayer.destroy();
  }
}
