export const APP_TIMEZONE = 'America/Los_Angeles' as const

export type ProviderId = 'rec' | 'courtreserve'

export type FacilityGeometry = {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

export type CoordinateAccuracyLevel =
  | 'official-court-geometry'
  | 'official-facility-page-point'

export type FacilityCoordinateProvenance = {
  sourceUrl: string
  sourceKind: 'datasf-recreation-parks-facilities' | 'official-facility-page'
  verifiedAt: string
  accuracyLevel: CoordinateAccuracyLevel
  horizontalAccuracyMeters: number | null
  matchMethod: 'canonical-name' | 'reviewed-alias' | 'official-page-fallback'
  dataAsOf: string | null
  dataSfObjectId: string | null
  dataSfFacilityId: string | null
  dataSfPropertyId: string | null
}

export type CourtChild = {
  id: string
  label: string
  number: string | null
  provider: ProviderId
  sourceUrl: string
  verifiedAt: string
}

export type Facility = {
  id: string
  name: string
  zipCode: string
  neighborhood: string
  latitude: number
  longitude: number
  geometry: FacilityGeometry | null
  coordinate: FacilityCoordinateProvenance
  lights: boolean
  restrooms: boolean
  totalCourts: number
  reservableCourts: number
  walkUpCourts: number
  facilityPageUrl: string
  provider: ProviderId | null
  providerLocationId: string | null
  bookingUrl: string | null
  childCourts: CourtChild[]
  childRecordStatus:
    | 'verified-provider'
    | 'provider-verification-required'
    | 'not-individually-published'
}

export type NeighborhoodGeometry = {
  name: string
  polygons: number[][][][]
}

export type DirectoryManifest = {
  generatedAt: string
  timezone: typeof APP_TIMEZONE
  sourceUrl: string
  coordinateSourceUrl: string
  neighborhoodSourceUrl: string
  facilities: Facility[]
  neighborhoods: NeighborhoodGeometry[]
  totals: {
    facilities: number
    courts: number
    reservableCourts: number
    walkUpCourts: number
    facilitiesWithOfficialCourtGeometry: number
    facilitiesWithOfficialPagePoint: number
  }
}

export type AtlasFacility = Facility & {
  accessStatus: 'reservable' | 'walk-up-only'
}
