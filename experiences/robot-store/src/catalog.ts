import catalogJson from '../robot-catalog.json'
import type { CatalogRobot, RobotCatalog, StoreFilter } from './types'

const catalogSource = catalogJson as unknown as RobotCatalog
const robots = [...catalogSource.robots]
const neoIndex = robots.findIndex((robot) => robot.id === '1x-neo')
const memoIndex = robots.findIndex((robot) => robot.id === 'sunday-memo')

if (neoIndex >= 0 && memoIndex >= 0) {
  const neo = robots[neoIndex]
  robots[neoIndex] = robots[memoIndex]
  robots[memoIndex] = neo
}

export const catalog: RobotCatalog = {
  ...catalogSource,
  robots,
}

const segmentMap: Record<string, StoreFilter> = {
  consumer_home: 'home',
  developer_research: 'developer',
  commercial_service: 'industrial',
  rugged_continuous_industrial: 'industrial',
}

const colorMap: Record<string, string> = {
  'warm ivory': '#e9e2d1',
  'warm beige': '#b8a48c',
  'warm white': '#e7e8e3',
  'gloss white': '#f1f5f4',
  'sage green': '#84927d',
  'electric blue': '#2f8dff',
  'clean white': '#f0f2ee',
  'dark graphite': '#424a54',
  'off white': '#e7e2d6',
  'matte black': '#252a31',
  white: '#f0f2ee',
}

export const storeFilters: Array<{ id: StoreFilter; label: string }> = [
  { id: 'all', label: 'All systems' },
  { id: 'home', label: 'Home' },
  { id: 'developer', label: 'Developer' },
  { id: 'industrial', label: 'Industrial' },
]

export function segmentForRobot(robot: CatalogRobot): StoreFilter {
  return segmentMap[robot.market.segment] ?? 'industrial'
}

export function robotMatches(
  robot: CatalogRobot,
  filter: StoreFilter,
  query: string,
): boolean {
  const inFilter = filter === 'all' || segmentForRobot(robot) === filter
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return inFilter

  const searchText = [
    robot.brand,
    robot.model,
    robot.market.category,
    robot.market.segment,
    ...robot.capabilities,
  ]
    .join(' ')
    .toLocaleLowerCase()

  return inFilter && searchText.includes(normalizedQuery)
}

export function accentForRobot(robot: CatalogRobot): string {
  const primary = robot.visual_identity.palette[0]?.toLocaleLowerCase()
  if (primary && colorMap[primary]) return colorMap[primary]

  let hash = 0
  for (const character of robot.id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 78% 63%)`
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: catalog.currency,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatHeight(robot: CatalogRobot): string {
  const height = robot.specs.dimensions.height_m
  if (typeof height === 'number') return `${height.toFixed(2)} m`
  if (height && typeof height === 'object') return `${height.min.toFixed(2)}–${height.max.toFixed(2)} m`
  return 'Not published'
}

export function formatRuntime(robot: CatalogRobot): string {
  const runtime = robot.specs.runtime_h
  if (typeof runtime === 'number') return `${runtime} hr`
  if (runtime && typeof runtime === 'object') {
    const values = Object.values(runtime)
    if (values.length === 2 && 'min' in runtime && 'max' in runtime) {
      return `${runtime.min}–${runtime.max} hr`
    }
    return Object.entries(runtime)
      .map(([key, value]) => `${key} ${value} hr`)
      .join(' / ')
  }
  return 'Not published'
}

export function formatPayload(robot: CatalogRobot): string {
  const priority = ['system', 'carry', 'full_work_envelope', 'sustained', 'arm_each', 'arm_each_standard']
  for (const key of priority) {
    const value = robot.specs.payload_kg[key]
    if (typeof value === 'number') return `${value} kg`
  }

  const range = robot.specs.payload_kg.family_published_range
  if (range && typeof range === 'object' && 'min' in range && 'max' in range) {
    return `${range.min}–${range.max} kg family`
  }
  return 'Not published'
}

export function isFictionalPrice(robot: CatalogRobot): boolean {
  return robot.pricing.store_price.kind === 'fictional_showcase_msrp'
}

export function getRobotById(id: string): CatalogRobot {
  return catalog.robots.find((robot) => robot.id === id) ?? catalog.robots[0]
}
