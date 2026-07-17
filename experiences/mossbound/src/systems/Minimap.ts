export type MinimapEnemy = {
  x: number;
  z: number;
  boss: boolean;
};

export type MinimapSnapshot = {
  player: { x: number; z: number; yaw: number };
  enemies: readonly MinimapEnemy[];
  bounds: { halfWidth: number; halfDepth: number };
  wave: number;
  maxWaves: number;
};

export class Minimap {
  private readonly context: CanvasRenderingContext2D;
  private lastWaveLabel = '';
  private lastEnemyLabel = '';
  private lastAriaLabel = '';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly waveLabel: HTMLElement,
    private readonly enemyLabel: HTMLElement,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The tactical map requires a 2D canvas context');
    this.context = context;
  }

  update(snapshot: MinimapSnapshot): void {
    this.updateLabels(snapshot);

    const size = Math.max(96, Math.round(this.canvas.clientWidth || 192));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bufferSize = Math.round(size * pixelRatio);
    if (this.canvas.width !== bufferSize || this.canvas.height !== bufferSize) {
      this.canvas.width = bufferSize;
      this.canvas.height = bufferSize;
    }

    const context = this.context;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);
    this.drawBackground(context, size, snapshot.bounds);

    const padding = 13;
    const mapSpan = Math.max(snapshot.bounds.halfWidth * 2, snapshot.bounds.halfDepth * 2);
    const scale = (size - padding * 2) / mapSpan;
    const center = size / 2;
    const toMap = (x: number, z: number): [number, number] => [center + x * scale, center + z * scale];

    for (const enemy of snapshot.enemies) {
      const [x, y] = toMap(enemy.x, enemy.z);
      this.drawEnemy(context, x, y, enemy.boss);
    }

    const [playerX, playerY] = toMap(snapshot.player.x, snapshot.player.z);
    this.drawPlayer(context, playerX, playerY, snapshot.player.yaw);
  }

  private updateLabels(snapshot: MinimapSnapshot): void {
    const wave = `GROVE I · WAVE ${snapshot.wave}/${snapshot.maxWaves}`;
    const hostiles = `${snapshot.enemies.length} ${snapshot.enemies.length === 1 ? 'HOSTILE' : 'HOSTILES'}`;
    const aria = `${wave}. Player and ${hostiles.toLowerCase()} shown on the tactical map.`;
    if (wave !== this.lastWaveLabel) {
      this.waveLabel.textContent = wave;
      this.lastWaveLabel = wave;
    }
    if (hostiles !== this.lastEnemyLabel) {
      this.enemyLabel.textContent = hostiles;
      this.lastEnemyLabel = hostiles;
    }
    if (aria !== this.lastAriaLabel) {
      this.canvas.setAttribute('aria-label', aria);
      this.lastAriaLabel = aria;
    }
  }

  private drawBackground(
    context: CanvasRenderingContext2D,
    size: number,
    bounds: MinimapSnapshot['bounds'],
  ): void {
    const gradient = context.createRadialGradient(size * .5, size * .5, 4, size * .5, size * .5, size * .72);
    gradient.addColorStop(0, '#244628');
    gradient.addColorStop(1, '#0a1710');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const padding = 13;
    const worldSpan = Math.max(bounds.halfWidth * 2, bounds.halfDepth * 2);
    const scale = (size - padding * 2) / worldSpan;
    const arenaWidth = bounds.halfWidth * 2 * scale;
    const arenaHeight = bounds.halfDepth * 2 * scale;
    const left = (size - arenaWidth) / 2;
    const top = (size - arenaHeight) / 2;

    context.save();
    context.beginPath();
    context.rect(left, top, arenaWidth, arenaHeight);
    context.clip();
    context.strokeStyle = 'rgba(183, 216, 62, .12)';
    context.lineWidth = 1;
    const gridStep = Math.max(16, 8 * scale);
    for (let x = size / 2; x <= left + arenaWidth; x += gridStep) this.drawGridLine(context, x, top, x, top + arenaHeight);
    for (let x = size / 2 - gridStep; x >= left; x -= gridStep) this.drawGridLine(context, x, top, x, top + arenaHeight);
    for (let y = size / 2; y <= top + arenaHeight; y += gridStep) this.drawGridLine(context, left, y, left + arenaWidth, y);
    for (let y = size / 2 - gridStep; y >= top; y -= gridStep) this.drawGridLine(context, left, y, left + arenaWidth, y);
    context.restore();

    context.strokeStyle = 'rgba(248, 241, 215, .52)';
    context.lineWidth = 1;
    context.strokeRect(left + .5, top + .5, arenaWidth - 1, arenaHeight - 1);
    context.fillStyle = 'rgba(76, 236, 255, .8)';
    context.font = '700 8px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText('N', size / 2, Math.max(9, top - 4));
  }

  private drawGridLine(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  private drawEnemy(context: CanvasRenderingContext2D, x: number, y: number, boss: boolean): void {
    context.save();
    context.translate(x, y);
    context.shadowColor = boss ? '#ffc94f' : '#ff563f';
    context.shadowBlur = boss ? 8 : 5;
    context.fillStyle = boss ? '#ffc94f' : '#ff563f';
    context.strokeStyle = '#101812';
    context.lineWidth = 2;
    context.beginPath();
    if (boss) {
      context.moveTo(0, -6);
      context.lineTo(6, 0);
      context.lineTo(0, 6);
      context.lineTo(-6, 0);
      context.closePath();
    } else {
      context.arc(0, 0, 3.5, 0, Math.PI * 2);
    }
    context.fill();
    context.shadowBlur = 0;
    context.stroke();
    context.restore();
  }

  private drawPlayer(context: CanvasRenderingContext2D, x: number, y: number, yaw: number): void {
    context.save();
    context.translate(x, y);
    context.rotate(-yaw);
    context.shadowColor = '#4cecff';
    context.shadowBlur = 8;
    context.fillStyle = '#4cecff';
    context.strokeStyle = '#f8f1d7';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(5.5, 6);
    context.lineTo(0, 3.5);
    context.lineTo(-5.5, 6);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.stroke();
    context.restore();
  }
}
