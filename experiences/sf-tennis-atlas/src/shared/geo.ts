export type Wgs84Position = {
  latitude: number
  longitude: number
  elevation: number
}

export type Cartesian3 = {
  x: number
  y: number
  z: number
}

export type EnuPosition = {
  east: number
  north: number
  up: number
}

export const SF_ATLAS_ANCHOR: Wgs84Position = {
  latitude: 37.7552,
  longitude: -122.4527,
  elevation: 0,
}

const WGS84_A = 6_378_137
const WGS84_F = 1 / 298.257_223_563
const WGS84_E2 = WGS84_F * (2 - WGS84_F)

function radians(degrees: number) {
  return (degrees * Math.PI) / 180
}

function degrees(radiansValue: number) {
  return (radiansValue * 180) / Math.PI
}

export function wgs84ToEcef(position: Wgs84Position): Cartesian3 {
  const latitude = radians(position.latitude)
  const longitude = radians(position.longitude)
  const sinLatitude = Math.sin(latitude)
  const cosLatitude = Math.cos(latitude)
  const radius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude * sinLatitude)

  return {
    x: (radius + position.elevation) * cosLatitude * Math.cos(longitude),
    y: (radius + position.elevation) * cosLatitude * Math.sin(longitude),
    z: (radius * (1 - WGS84_E2) + position.elevation) * sinLatitude,
  }
}

export function ecefToWgs84(position: Cartesian3): Wgs84Position {
  const longitude = Math.atan2(position.y, position.x)
  const horizontal = Math.hypot(position.x, position.y)
  let latitude = Math.atan2(position.z, horizontal * (1 - WGS84_E2))
  let elevation = 0

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sinLatitude = Math.sin(latitude)
    const radius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude * sinLatitude)
    elevation = horizontal / Math.max(Math.cos(latitude), Number.EPSILON) - radius
    const nextLatitude = Math.atan2(
      position.z,
      horizontal * (1 - (WGS84_E2 * radius) / (radius + elevation)),
    )
    if (Math.abs(nextLatitude - latitude) < 1e-13) {
      latitude = nextLatitude
      break
    }
    latitude = nextLatitude
  }

  return {
    latitude: degrees(latitude),
    longitude: degrees(longitude),
    elevation,
  }
}

export function ecefToEnu(
  position: Cartesian3,
  anchor: Wgs84Position = SF_ATLAS_ANCHOR,
): EnuPosition {
  const origin = wgs84ToEcef(anchor)
  const delta = {
    x: position.x - origin.x,
    y: position.y - origin.y,
    z: position.z - origin.z,
  }
  const latitude = radians(anchor.latitude)
  const longitude = radians(anchor.longitude)
  const sinLatitude = Math.sin(latitude)
  const cosLatitude = Math.cos(latitude)
  const sinLongitude = Math.sin(longitude)
  const cosLongitude = Math.cos(longitude)

  return {
    east: -sinLongitude * delta.x + cosLongitude * delta.y,
    north:
      -sinLatitude * cosLongitude * delta.x -
      sinLatitude * sinLongitude * delta.y +
      cosLatitude * delta.z,
    up:
      cosLatitude * cosLongitude * delta.x +
      cosLatitude * sinLongitude * delta.y +
      sinLatitude * delta.z,
  }
}

export function enuToEcef(
  position: EnuPosition,
  anchor: Wgs84Position = SF_ATLAS_ANCHOR,
): Cartesian3 {
  const origin = wgs84ToEcef(anchor)
  const latitude = radians(anchor.latitude)
  const longitude = radians(anchor.longitude)
  const sinLatitude = Math.sin(latitude)
  const cosLatitude = Math.cos(latitude)
  const sinLongitude = Math.sin(longitude)
  const cosLongitude = Math.cos(longitude)

  return {
    x:
      origin.x -
      sinLongitude * position.east -
      sinLatitude * cosLongitude * position.north +
      cosLatitude * cosLongitude * position.up,
    y:
      origin.y +
      cosLongitude * position.east -
      sinLatitude * sinLongitude * position.north +
      cosLatitude * sinLongitude * position.up,
    z:
      origin.z + cosLatitude * position.north + sinLatitude * position.up,
  }
}

export function wgs84ToEnu(
  position: Wgs84Position,
  anchor: Wgs84Position = SF_ATLAS_ANCHOR,
) {
  return ecefToEnu(wgs84ToEcef(position), anchor)
}

export function enuToWgs84(
  position: EnuPosition,
  anchor: Wgs84Position = SF_ATLAS_ANCHOR,
) {
  return ecefToWgs84(enuToEcef(position, anchor))
}

/** Three.js uses +X east, +Y up, and -Z north. Values remain in meters. */
export function enuToScene(position: EnuPosition): Cartesian3 {
  return { x: position.east, y: position.up, z: -position.north }
}
