import './styles.css';
import { loadGameAssets } from './game/Assets.js';
import { Game } from './game/Game.js';

const canvas = document.querySelector('#game-canvas');
const modelCanvas = document.querySelector('#model-canvas');
const ui = {
  timer: document.querySelector('#timer'),
  timerReadout: document.querySelector('#timer-readout'),
  gameStage: document.querySelector('#game-stage'),
  score: document.querySelector('#score'),
  streak: document.querySelector('#streak'),
  instruction: document.querySelector('#instruction'),
  shotPanel: document.querySelector('#shot-panel'),
  shotStatus: document.querySelector('#shot-status'),
  powerValue: document.querySelector('#power-value'),
  powerFill: document.querySelector('#power-fill'),
  mobileDeck: document.querySelector('#mobile-deck'),
  mobileShotStatus: document.querySelector('#mobile-shot-status'),
  mobilePowerValue: document.querySelector('#mobile-power-value'),
  mobilePowerFill: document.querySelector('#mobile-power-fill'),
  mobileStreak: document.querySelector('#mobile-streak'),
  pauseButton: document.querySelector('#pause-button'),
  muteButton: document.querySelector('#mute-button'),
  startScreen: document.querySelector('#start-screen'),
  pauseScreen: document.querySelector('#pause-screen'),
  gameOverScreen: document.querySelector('#game-over-screen'),
  startButton: document.querySelector('#start-button'),
  resumeButton: document.querySelector('#resume-button'),
  restartButton: document.querySelector('#restart-button'),
  playAgainButton: document.querySelector('#play-again-button'),
  finalScore: document.querySelector('#final-score'),
  finalAccuracy: document.querySelector('#final-accuracy'),
  finalStreak: document.querySelector('#final-streak'),
  resultMessage: document.querySelector('#result-message'),
  swishBanner: document.querySelector('#swish-banner'),
  liveStatus: document.querySelector('#live-status'),
};

const game = new Game(canvas, modelCanvas, ui);
loadGameAssets({ loadFallbackImages: game.requiresFallbackImages() })
  .then((assets) => game.setAssets(assets));

window.addEventListener('beforeunload', () => game.destroy(), { once: true });
