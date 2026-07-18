export interface TrackDef {
  id: string
  title: string
  artist: string
  genre: string
  bpm: number
  file: string
  art: string
  accent: number
}

export const TRACKS: TrackDef[] = [
  {
    id: 'orbital-decay',
    title: 'ORBITAL DECAY',
    artist: 'ATLAS SIGNAL',
    genre: 'NEUROFUNK DNB',
    bpm: 174,
    file: MINT_ASSET_URLS.tracks.orbitalDecay,
    art: MINT_ASSET_URLS.covers.orbitalDecay,
    accent: 0xffb35c,
  },
  {
    id: 'zero-g-breaker',
    title: 'ZERO-G BREAKER',
    artist: 'VECTOR NULL',
    genre: 'TECHSTEP DNB',
    bpm: 176,
    file: MINT_ASSET_URLS.tracks.zeroGBreaker,
    art: MINT_ASSET_URLS.covers.chromeCasket,
    accent: 0x79e7ff,
  },
  {
    id: 'plasma-wake',
    title: 'PLASMA WAKE',
    artist: 'LUMEN//ARC',
    genre: 'LIQUID DNB',
    bpm: 172,
    file: MINT_ASSET_URLS.tracks.plasmaWake,
    art: MINT_ASSET_URLS.covers.spliceRunner,
    accent: 0x59f2d0,
  },
  {
    id: 'hull-breach',
    title: 'HULL BREACH',
    artist: 'BREACH UNIT',
    genre: 'SPACE JUNGLE',
    bpm: 178,
    file: MINT_ASSET_URLS.tracks.hullBreach,
    art: MINT_ASSET_URLS.covers.adrenalCircuit,
    accent: 0xff3b30,
  },
  {
    id: 'event-horizon',
    title: 'EVENT HORIZON',
    artist: 'PERIAPSIS',
    genre: 'DANCEFLOOR DNB',
    bpm: 174,
    file: MINT_ASSET_URLS.tracks.eventHorizon,
    art: MINT_ASSET_URLS.covers.neonBodega,
    accent: 0xff5ecf,
  },
]

export const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '--:--'
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
import { MINT_ASSET_URLS } from '../assets/runtime'
