import type { CatalogRobot } from './types'

export type RobotTheme = {
  accent: string
  paper: string
  paperShadow: string
  ink: string
  inkMuted: string
  proxyBody: string
}

const baseThemes: Record<string, RobotTheme> = {
  '1x-neo': theme('#ff4f12', '#b8bab3', '#9ea19a'),
  'fourier-gr3': theme('#2857ff', '#c7c8c2', '#aaaca7'),
  'fauna-sprout': theme('#e4b400', '#b9bab0', '#9d9f97'),
  'sunday-memo': theme('#ff641e', '#c8c7bf', '#aaa9a3'),
  'weave-isaac-1': theme('#738b22', '#b7b8ae', '#999b92'),
  'boston-dynamics-atlas': theme('#087cff', '#afb3b1', '#929896'),
  'figure-03': theme('#ef3d34', '#c4c4be', '#a7a7a1'),
  'unitree-g1': theme('#b6df19', '#adafa9', '#92958f'),
  'agility-digit': theme('#225cff', '#c2c3bd', '#a5a6a1'),
  'apptronik-apollo-2': theme('#f2a000', '#babbb5', '#9d9e99'),
  'sanctuary-phoenix-gen8': theme('#e7348f', '#b7b7b3', '#9a9a96'),
  'ubtech-walker-s2': theme('#00a7bd', '#c3c4be', '#a5a6a1'),
  'neura-4ne1-gen3': theme('#ed3326', '#b5b6b0', '#989a94'),
  'tesla-optimus': theme('#e32922', '#aeb0ad', '#929491'),
  'switchbot-onero-h1': theme('#2474ff', '#c4c5bf', '#a6a7a2'),
}

function theme(accent: string, paper: string, paperShadow: string): RobotTheme {
  return {
    accent,
    paper,
    paperShadow,
    ink: '#151616',
    inkMuted: '#4c4e4b',
    proxyBody: '#292b2a',
  }
}

export function themeForRobot(robot: CatalogRobot): RobotTheme {
  return baseThemes[robot.id] ?? theme('#1e64ff', '#bdbeb8', '#a0a19c')
}
