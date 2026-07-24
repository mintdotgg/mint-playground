export type StoreFilter = 'all' | 'home' | 'developer' | 'industrial'

export type CatalogRobot = {
  id: string
  brand: string
  model: string
  revision: string
  display_name: string
  inclusion: 'pictured' | 'peer_addition'
  summary: string
  watch_video: {
    provider: 'youtube'
    video_id: string
    title: string
    channel: string
    duration_seconds: number
    watch_url: string
    embed_url: string
    source_type: 'official_manufacturer'
    embed_verified_on: string
  }
  selection_reason?: string
  market: {
    segment: string
    category: string
    form_factor: string
    locomotion: string
    target_environments: string[]
    target_customers: string[]
    status: string
    availability: string
  }
  specs: {
    dimensions: {
      height_m: number | { min: number; max: number } | null
      width_m: number | null
      depth_m: number | null
      footprint_width_m: number | null
      footprint_depth_m: number | null
      vertical_reach_m: number | null
      horizontal_reach_m: number | null
    }
    mass_kg: number | null
    dof: Record<string, number | null>
    payload_kg: Record<string, number | Record<string, number> | null>
    speed_m_s: Record<string, number | null>
    runtime_h: number | Record<string, number> | null
    charge_h: number | null
    battery_kwh: number | null
    ingress_protection: string | Record<string, string> | null
    compute: string | null
    sensing: string[]
    connectivity: string[] | null
    notes: string[]
  }
  capabilities: string[]
  pricing: {
    public_price: {
      status: string
      ownership_usd: number | null
      subscription_usd_month: number | null
      deposit_usd: number | null
      notes: string
    }
    store_price: {
      usd: number
      kind: string
      confidence: string
      basis: string
    }
  }
  visual_identity: {
    palette: string[]
    materials: string[]
    head: string
    torso: string
    arms_hands: string
    lower_body: string
    distinguishing_features: string[]
  }
  reference_images: Array<{
    id: string
    view: string
    role: string
    page_url: string
    direct_url: string
    source_type: string
    revision_alignment: string
    modeling_value: string
  }>
  reference_coverage: {
    score_out_of_5: number
    blockers: string[]
    ready_for_3d: false
  } & Record<string, unknown>
  quality: {
    spec_confidence: string
    price_confidence: string
    revision_confidence: string
    open_issues: string[]
  }
}

export type RobotCatalog = {
  title: string
  research_cutoff: string
  currency: string
  robots: CatalogRobot[]
}

export type MintArtifact = {
  artifactId: string
  role: string
  format: string
  contentType: string
  filename?: string
  runtimeUrl: string
  loaderHint?: string
  byteSize?: number
}

export type MintAssetRecord = {
  transform?: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  mode: 'remote_url'
  artifacts: Record<string, MintArtifact>
}

export type MintRegistry = {
  registryVersion: number
  assetRoot: 'public'
  delivery: 'mint_cdn'
  assets: Record<string, MintAssetRecord>
}

export type AssetDisplayStatus = {
  kind: 'loading' | 'mint-model' | 'temporary-silhouette' | 'error'
  message: string
}
