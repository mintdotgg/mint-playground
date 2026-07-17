import * as THREE from 'three';
import type { CardProfile, CardSide } from '../types';

const artworkCache = new Map<string, Promise<HTMLImageElement | null>>();

function seededRandom(seed: string): () => number {
  let value = Array.from(seed).reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function loadArtwork(path: string): Promise<HTMLImageElement | null> {
  const cached = artworkCache.get(path);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });

  artworkCache.set(path, request);
  return request;
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > canvasRatio) {
    sourceWidth = image.height * canvasRatio;
    sourceX = (image.width - sourceWidth) * 0.5;
  } else {
    sourceHeight = image.width / canvasRatio;
    sourceY = (image.height - sourceHeight) * 0.5;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function drawGrain(context: CanvasRenderingContext2D, width: number, height: number, seed: string, opacity = 0.035): void {
  const random = seededRandom(seed);
  context.save();
  context.globalAlpha = opacity;
  for (let index = 0; index < 5200; index += 1) {
    const value = Math.floor(90 + random() * 160);
    context.fillStyle = `rgb(${value} ${value} ${value})`;
    const size = random() > 0.93 ? 2 : 1;
    context.fillRect(random() * width, random() * height, size, size);
  }
  context.restore();
}

function drawFallbackArtwork(context: CanvasRenderingContext2D, card: CardProfile, width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, card.background);
  gradient.addColorStop(0.58, card.accentSecondary);
  gradient.addColorStop(1, card.accent);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(width * 0.58, height * 0.46);
  context.rotate(-0.14);
  context.fillStyle = 'rgba(255,255,255,.2)';
  context.beginPath();
  context.ellipse(0, 0, width * 0.19, height * 0.31, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(5,8,12,.46)';
  context.beginPath();
  context.arc(0, -height * 0.23, width * 0.075, 0, Math.PI * 2);
  context.fill();
  context.fillRect(-width * 0.12, -height * 0.17, width * 0.24, height * 0.32);
  context.restore();
}

function setTrackingText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cursor = x;
  for (const character of text) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + tracking;
  }
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(' ');
  let line = '';
  let lineIndex = 0;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
      if (lineIndex >= maxLines) return y + lineIndex * lineHeight;
    } else {
      line = test;
    }
  }

  if (lineIndex < maxLines && line) {
    context.fillText(line, x, y + lineIndex * lineHeight);
    lineIndex += 1;
  }
  return y + lineIndex * lineHeight;
}

function drawFront(context: CanvasRenderingContext2D, card: CardProfile, artwork: HTMLImageElement | null): void {
  const { width, height } = context.canvas;
  context.fillStyle = card.background;
  context.fillRect(0, 0, width, height);

  if (artwork) drawCover(context, artwork, width, height);
  else drawFallbackArtwork(context, card, width, height);

  const topShade = context.createLinearGradient(0, 0, 0, height * 0.38);
  topShade.addColorStop(0, 'rgba(6,8,12,.72)');
  topShade.addColorStop(1, 'rgba(6,8,12,0)');
  context.fillStyle = topShade;
  context.fillRect(0, 0, width, height * 0.44);

  const lowerShade = context.createLinearGradient(0, height * 0.48, 0, height);
  lowerShade.addColorStop(0, 'rgba(6,8,12,0)');
  lowerShade.addColorStop(0.68, 'rgba(6,8,12,.65)');
  lowerShade.addColorStop(1, 'rgba(6,8,12,.94)');
  context.fillStyle = lowerShade;
  context.fillRect(0, height * 0.4, width, height * 0.6);

  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = card.treatment === 'archival' ? 0.11 : 0.22;
  context.fillStyle = card.accent;
  context.beginPath();
  context.moveTo(width * 0.7, 0);
  context.lineTo(width, 0);
  context.lineTo(width * 0.54, height);
  context.lineTo(width * 0.3, height);
  context.closePath();
  context.fill();
  context.restore();

  context.strokeStyle = `${card.accent}bb`;
  context.lineWidth = 4;
  context.strokeRect(34, 34, width - 68, height - 68);
  context.strokeStyle = 'rgba(255,255,255,.32)';
  context.lineWidth = 1;
  context.strokeRect(48, 48, width - 96, height - 96);

  context.fillStyle = '#f5f1e8';
  context.font = '600 26px Arial, sans-serif';
  setTrackingText(context, 'DYNASTY / INDEX', 68, 92, 5.2);
  context.fillStyle = card.accent;
  context.font = '700 68px Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText(card.index, width - 70, 112);
  context.textAlign = 'left';

  context.fillStyle = '#f8f3e9';
  context.font = '700 78px Arial, sans-serif';
  context.fillText(card.player.toUpperCase(), 68, height - 188);
  context.fillStyle = card.accent;
  context.font = '600 27px Arial, sans-serif';
  setTrackingText(context, card.sport.toUpperCase(), 70, height - 126, 5);
  context.fillStyle = 'rgba(248,243,233,.78)';
  context.font = '500 22px Arial, sans-serif';
  setTrackingText(context, card.title.toUpperCase(), 70, height - 76, 2.6);

  context.save();
  context.translate(width - 57, height * 0.63);
  context.rotate(-Math.PI / 2);
  context.fillStyle = 'rgba(248,243,233,.58)';
  context.font = '500 18px Arial, sans-serif';
  setTrackingText(context, `${card.era.toUpperCase()} — ${card.edition}`, 0, 0, 2.2);
  context.restore();

  if (card.treatment === 'archival') {
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = 'rgba(111,72,37,.14)';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }

  drawGrain(context, width, height, card.id, card.treatment === 'archival' ? 0.11 : 0.035);
}

function drawBack(context: CanvasRenderingContext2D, card: CardProfile): void {
  const { width, height } = context.canvas;
  const archival = card.treatment === 'archival';
  context.fillStyle = archival ? '#d8c9aa' : card.background;
  context.fillRect(0, 0, width, height);

  const wash = context.createRadialGradient(width * 0.76, height * 0.18, 20, width * 0.76, height * 0.18, width * 0.8);
  wash.addColorStop(0, `${card.accent}88`);
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  const ink = archival ? '#211d19' : '#f1ede4';
  const subdued = archival ? 'rgba(33,29,25,.62)' : 'rgba(241,237,228,.62)';
  context.strokeStyle = `${card.accent}aa`;
  context.lineWidth = 4;
  context.strokeRect(34, 34, width - 68, height - 68);
  context.strokeStyle = archival ? 'rgba(33,29,25,.24)' : 'rgba(255,255,255,.22)';
  context.lineWidth = 1;
  context.strokeRect(48, 48, width - 96, height - 96);

  context.fillStyle = card.accent;
  context.font = '700 172px Arial, sans-serif';
  context.fillText(card.monogram, 58, 218);
  context.fillStyle = ink;
  context.font = '600 22px Arial, sans-serif';
  setTrackingText(context, 'DYNASTY INDEX / ARCHIVE RECORD', 62, 270, 3.4);

  context.fillStyle = ink;
  context.font = '700 62px Arial, sans-serif';
  context.fillText(card.title.toUpperCase(), 62, 372);
  context.fillStyle = subdued;
  context.font = '500 26px Arial, sans-serif';
  context.fillText(`${card.player.toUpperCase()} — ${card.sport.toUpperCase()}`, 64, 418);

  const statTop = 494;
  const statWidth = (width - 144) / 2;
  const statHeight = 118;
  card.stats.forEach((stat, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 62 + column * (statWidth + 20);
    const y = statTop + row * (statHeight + 20);
    context.fillStyle = archival ? 'rgba(33,29,25,.045)' : 'rgba(255,255,255,.055)';
    context.fillRect(x, y, statWidth, statHeight);
    context.strokeStyle = archival ? 'rgba(33,29,25,.18)' : 'rgba(255,255,255,.18)';
    context.strokeRect(x, y, statWidth, statHeight);
    context.fillStyle = card.accent;
    context.font = '600 20px Arial, sans-serif';
    setTrackingText(context, stat.label, x + 22, y + 34, 3.2);
    context.fillStyle = ink;
    context.font = '700 42px Arial, sans-serif';
    context.fillText(stat.value, x + 22, y + 88);
  });

  context.fillStyle = card.accent;
  context.font = '600 20px Arial, sans-serif';
  setTrackingText(context, 'PROVENANCE', 62, 810, 3.6);
  context.fillStyle = ink;
  context.font = '500 25px Arial, sans-serif';
  wrapText(context, card.provenance, 62, 858, width - 124, 37, 5);

  context.fillStyle = card.accent;
  context.font = '600 20px Arial, sans-serif';
  setTrackingText(context, 'MATERIAL CONSTRUCTION', 62, 1090, 3.3);
  context.fillStyle = ink;
  context.font = '500 25px Arial, sans-serif';
  wrapText(context, card.material, 62, 1138, width - 124, 35, 3);

  context.strokeStyle = archival ? 'rgba(33,29,25,.24)' : 'rgba(255,255,255,.24)';
  context.beginPath();
  context.moveTo(62, height - 146);
  context.lineTo(width - 62, height - 146);
  context.stroke();
  context.fillStyle = ink;
  context.font = '700 31px Arial, sans-serif';
  context.fillText(card.rarity.toUpperCase(), 62, height - 91);
  context.textAlign = 'right';
  context.fillText(card.edition, width - 62, height - 91);
  context.textAlign = 'left';
  context.fillStyle = subdued;
  context.font = '500 18px Arial, sans-serif';
  setTrackingText(context, `SPECIMEN ${card.index} / CONDITION ${card.grade}`, 62, height - 55, 2.5);

  drawGrain(context, width, height, `${card.id}-back`, archival ? 0.13 : 0.04);
}

export async function createCardTexture(card: CardProfile, side: CardSide): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1424;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');

  if (side === 'front') {
    const artwork = await loadArtwork(card.artworkPath);
    drawFront(context, card, artwork);
  } else {
    drawBack(context, card);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createSlabLabelTexture(card: CardProfile): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 224;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');

  context.fillStyle = '#e9e6dc';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = card.accent;
  context.fillRect(0, 0, 18, canvas.height);
  context.fillStyle = '#141618';
  context.font = '700 38px Arial, sans-serif';
  context.fillText(`${card.index} / ${card.player.toUpperCase()}`, 54, 72);
  context.fillStyle = '#585a5b';
  context.font = '600 22px Arial, sans-serif';
  setTrackingText(context, `${card.sport.toUpperCase()} — ${card.rarity.toUpperCase()}`, 55, 115, 2.4);
  context.font = '500 19px Arial, sans-serif';
  setTrackingText(context, `EDITION ${card.edition} / ${card.gradeLabel.toUpperCase()}`, 55, 163, 1.8);
  context.strokeStyle = '#b8b6ad';
  context.strokeRect(35, 22, 748, 180);

  context.fillStyle = '#141618';
  context.fillRect(820, 22, 182, 180);
  context.fillStyle = card.accent;
  context.font = '700 82px Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(card.grade, 911, 119);
  context.fillStyle = '#e9e6dc';
  context.font = '600 16px Arial, sans-serif';
  setTrackingText(context, 'CONDITION', 852, 166, 2.2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
