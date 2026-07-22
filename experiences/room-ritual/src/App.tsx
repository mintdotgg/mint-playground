/* eslint-disable @next/next/no-img-element -- this portable Vite app renders runtime CDN and canvas-capture URLs */

import { useEffect, useMemo, useRef, useState } from 'react'
import { mintCampaignImages } from './assets/mintAssets'
import { AudioSystem } from './audio/AudioSystem'
import { decorById, decorProducts, deliveryWindow, formatDimensions, formatPrice, productById, products } from './data/catalog'
import { RoomScene } from './scene/RoomScene'
import { useAppStore, type DrawerName } from './state/store'
import type { CartLine, MoodEntry, Product, RoomDocument, SavedConfiguration } from './types'

declare global {
  interface Window {
    __ROOM_RITUAL__?: {
      diagnostics: () => ReturnType<RoomScene['diagnostics']> | null
      capture: () => string | undefined
    }
  }
}

type InspectorTab = 'story' | 'finishes' | 'details' | 'care'

const productVisualClass: Record<string, string> = {
  'morrow-sofa': 'visual-sofa',
  'fold-lounge': 'visual-chair',
  'cairn-table': 'visual-cairn',
  'span-table': 'visual-span',
  'pilaster-credenza': 'visual-pilaster',
  'loop-daybed': 'visual-loop',
}

function CampaignVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = mintCampaignImages[product.id]
  return (
    <div className={`campaign-visual ${productVisualClass[product.id]}${compact ? ' is-compact' : ''}`}>
      {!failed && src ? <img src={src} alt={`${product.name} campaign`} onError={() => setFailed(true)} /> : null}
      <span className="campaign-silhouette" aria-hidden="true" />
      <span className="campaign-index" aria-hidden="true">{String(products.findIndex((item) => item.id === product.id) + 1).padStart(2, '0')}</span>
    </div>
  )
}

function SceneViewport({ sceneRef }: { sceneRef: React.MutableRefObject<RoomScene | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    let scene: RoomScene | null = null
    let stateTimer: number | undefined
    try {
      scene = new RoomScene(containerRef.current)
      sceneRef.current = scene
      window.__ROOM_RITUAL__ = {
        diagnostics: () => sceneRef.current?.diagnostics() ?? null,
        capture: () => sceneRef.current?.captureThumbnail(),
      }
      stateTimer = window.setTimeout(() => setReady(true), 0)
    } catch (sceneError) {
      const message = sceneError instanceof Error ? sceneError.message : 'The 3D room could not be created.'
      stateTimer = window.setTimeout(() => setError(message), 0)
    }
    return () => {
      if (stateTimer !== undefined) window.clearTimeout(stateTimer)
      scene?.dispose()
      if (sceneRef.current === scene) sceneRef.current = null
      delete window.__ROOM_RITUAL__
    }
  }, [sceneRef])

  return (
    <main className="viewport" aria-label="Room editor viewport">
      <div ref={containerRef} className="scene-host" data-testid="scene-host" />
      {!ready && !error ? <div className="scene-state"><span className="loader-dot" /> Preparing the room</div> : null}
      {error ? (
        <div className="scene-error" role="alert">
          <strong>3D view unavailable</strong>
          <span>{error}</span>
          <button onClick={() => window.location.reload()}>Reload room</button>
        </div>
      ) : null}
    </main>
  )
}

function ProductCatalog() {
  const selectedProductId = useAppStore((state) => state.selectedProductId)
  const selectProduct = useAppStore((state) => state.selectProduct)
  const addProduct = useAppStore((state) => state.addProduct)

  return (
    <aside className="catalog" aria-label="Statement furniture catalog">
      <div className="catalog-heading">
        <span>Collection 01</span>
        <strong>Six statements</strong>
      </div>
      <div className="catalog-list">
        {products.map((product) => (
          <article
            className={`product-card${selectedProductId === product.id ? ' is-active' : ''}`}
            key={product.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-room-ritual-product', product.id)
              event.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <button className="product-card-main" onClick={() => selectProduct(product.id)} aria-pressed={selectedProductId === product.id}>
              <CampaignVisual product={product} compact />
              <span className="product-card-copy">
                <strong>{product.name}</strong>
                <span>{product.category} · {formatPrice(product.price)}</span>
              </span>
            </button>
            <button className="card-add" onClick={() => addProduct(product.id)} aria-label={`Add ${product.name} to room`}>+</button>
          </article>
        ))}
      </div>
      <p className="catalog-hint">Drag a piece onto the floor</p>
    </aside>
  )
}

function ProductInspector() {
  const state = useAppStore()
  const [tab, setTab] = useState<InspectorTab>('story')
  const product = productById(state.selectedProductId) ?? products[0]
  const placed = state.room.items.find((item) => item.id === state.selectedItemId && item.productId === product.id)
  const selectedFinish = product.finishes.find((finish) => finish.id === placed?.finishId) ?? product.finishes[0]
  const price = product.price + (selectedFinish.priceDelta ?? 0)
  const isMoodProduct = state.mood.some((entry) => entry.type === 'product' && entry.productId === product.id)
  const isMoodImage = state.mood.some((entry) => entry.type === 'image' && entry.productId === product.id)

  return (
    <aside className="inspector" aria-label="Selected product details">
      <CampaignVisual product={product} />
      <div className="inspector-title">
        <div>
          <span>{product.category}</span>
          <h1>{product.name}</h1>
        </div>
        <button
          className={`icon-button ${isMoodProduct ? 'is-active' : ''}`}
          onClick={() => state.toggleMood({ type: 'product', productId: product.id })}
          aria-label={`${isMoodProduct ? 'Remove' : 'Add'} ${product.name} ${isMoodProduct ? 'from' : 'to'} mood board`}
        >◇</button>
      </div>
      <p className="tagline">{product.tagline}</p>
      <div className="spec-strip">
        <span><small>Dimensions</small>{formatDimensions(product, placed?.planningScale ?? 1)}</span>
        <span><small>Lead time</small>{product.leadTimeWeeks[0]}–{product.leadTimeWeeks[1]} weeks</span>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Product information">
        {(['story', 'finishes', 'details', 'care'] as InspectorTab[]).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      <div className="inspector-body">
        {tab === 'story' ? (
          <>
            <p>{product.story}</p>
            <div className="designer-note">
              <span>Designer</span>
              <strong>{product.designer.name}</strong>
              <small>{product.designer.location}</small>
              <p>{product.designer.profile}</p>
            </div>
            <button className="text-action" onClick={() => state.toggleMood({ type: 'image', productId: product.id })}>
              {isMoodImage ? 'Remove campaign reference' : 'Collect campaign reference'}
            </button>
          </>
        ) : null}
        {tab === 'finishes' ? (
          <div className="finish-list">
            {product.finishes.map((finish) => {
              const active = finish.id === selectedFinish.id
              const saved = state.mood.some((entry) => entry.type === 'finish' && entry.productId === product.id && entry.finishId === finish.id)
              return (
                <div className={`finish-option${active ? ' is-active' : ''}`} key={finish.id}>
                  <button
                    className="finish-select"
                    onClick={() => {
                      if (placed) state.setSelectedFinish(finish.id)
                      window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'material' }))
                    }}
                    disabled={!placed}
                  >
                    <span className="swatch-cluster">
                      <i style={{ background: finish.primary }} />
                      <i style={{ background: finish.secondary }} />
                      <i style={{ background: finish.accent }} />
                    </span>
                    <span><strong>{finish.name}</strong><small>{finish.description}</small></span>
                    <em>{finish.priceDelta ? `+${formatPrice(finish.priceDelta)}` : 'Included'}</em>
                  </button>
                  <button className={`finish-save${saved ? ' is-active' : ''}`} onClick={() => state.toggleMood({ type: 'finish', productId: product.id, finishId: finish.id })} aria-label={`${saved ? 'Remove' : 'Save'} ${finish.name} finish`}>◇</button>
                </div>
              )
            })}
            {!placed ? <p className="inline-note">Add or select this piece in the room to preview finishes.</p> : null}
          </div>
        ) : null}
        {tab === 'details' ? (
          <div className="detail-list">
            {product.construction.map((detail, index) => (
              <article key={detail.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{detail.title}</strong><p>{detail.description}</p></div>
              </article>
            ))}
            <div className="material-list"><span>Materials</span>{selectedFinish.materialNames.join(' · ')}</div>
            <div className="material-list"><span>Weight</span>{product.weightKg} kg</div>
          </div>
        ) : null}
        {tab === 'care' ? (
          <ul className="care-list">{product.care.map((care) => <li key={care}>{care}</li>)}</ul>
        ) : null}
      </div>
      <div className="inspector-actions">
        <div><strong>{formatPrice(price)}</strong><span>Est. {deliveryWindow(product.leadTimeWeeks)}</span></div>
        <button className="primary-button" onClick={() => {
          state.addCartProduct(product.id, selectedFinish.id)
          window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'cart' }))
        }}>Add to cart</button>
      </div>
    </aside>
  )
}

function SelectionToolbar() {
  const state = useAppStore()
  const item = state.room.items.find((candidate) => candidate.id === state.selectedItemId)
  if (!item) return null
  const product = productById(item.productId)
  if (!product) return null
  const rotationDegrees = ((Math.round(item.rotation * 180 / Math.PI) % 360) + 360) % 360
  return (
    <div className="selection-toolbar" aria-label="Selected furniture placement controls">
      <span className="rotation-control">
        <button onClick={() => state.rotateSelected(-Math.PI / 12)} aria-label="Rotate left 15 degrees" title="Rotate left (Q or [)">↶</button>
        <output aria-label={`Rotation ${rotationDegrees} degrees`} aria-live="polite">{rotationDegrees}°</output>
        <button onClick={() => state.rotateSelected(Math.PI / 12)} aria-label="Rotate right 15 degrees" title="Rotate right (E or ])">↷</button>
      </span>
      <span className="scale-control">
        <button onClick={() => state.setSelectedScale(item.planningScale - 0.05)} aria-label="Reduce planning scale">−</button>
        <output>{Math.round(item.planningScale * 100)}%</output>
        <button onClick={() => state.setSelectedScale(item.planningScale + 0.05)} aria-label="Increase planning scale">+</button>
      </span>
      <button className={state.inspectMode ? 'is-active' : ''} onClick={() => state.setInspectMode(!state.inspectMode)}>Inspect</button>
      <button onClick={state.duplicateSelected}>Duplicate</button>
      <button onClick={state.removeSelected} aria-label={`Remove ${product.name} from room`}>Remove</button>
    </div>
  )
}

function ViewportStatus() {
  const collisions = useAppStore((state) => state.collisionIds)
  const selected = useAppStore((state) => state.selectedItemId)
  return (
    <div className={`viewport-status${collisions.length ? ' is-warning' : ''}`} role="status" aria-live="polite">
      {collisions.length ? `${collisions.length} overlap${collisions.length > 1 ? 's' : ''} — move or rotate until the footprint clears` : selected ? '5 cm snap · drag to move · Q / E rotate · arrows nudge' : 'Select a piece or drag one in from the collection'}
    </div>
  )
}

function TopBar({ onReset }: { onReset: () => void }) {
  const state = useAppStore()
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0)
  const open = (drawer: Exclude<DrawerName, null>) => state.openDrawer(drawer)
  return (
    <header className="topbar">
      <div className="brand"><span>Room</span><strong>Ritual</strong></div>
      <nav aria-label="Room actions">
        <button onClick={state.undo} disabled={!state.past.length} aria-label="Undo">↶ <span>Undo</span></button>
        <button onClick={state.redo} disabled={!state.future.length} aria-label="Redo">↷ <span>Redo</span></button>
        <button aria-label="Toggle measurements" onClick={() => state.toggleMeasurements()} className={state.measurementsVisible ? 'is-active' : ''}><span>Measure</span></button>
        <button aria-label="Open room palette" onClick={() => open('room')} className={state.drawer === 'room' ? 'is-active' : ''}><span>Room</span></button>
      </nav>
      <nav className="topbar-secondary" aria-label="Collection actions">
        <button onClick={() => open('mood')}>Mood <i>{state.mood.length}</i></button>
        <button onClick={() => open('saves')}>Save <i>{state.savedConfigurations.length}</i></button>
        <button onClick={() => open('compare')}>Compare</button>
        <button onClick={() => open('cart')}>Cart <i>{count}</i></button>
        <button className="reset-button" onClick={onReset}>Reset</button>
      </nav>
    </header>
  )
}

const roomSubtotal = (room: RoomDocument) => {
  const furniture = room.items.reduce((sum, item) => {
    const product = productById(item.productId)
    const finish = product?.finishes.find((candidate) => candidate.id === item.finishId)
    return sum + (product?.price ?? 0) + (finish?.priceDelta ?? 0)
  }, 0)
  const decor = room.decor.reduce((sum, item) => sum + (decorById(item.decorId)?.price ?? 0), 0)
  const rug = room.rugId === 'none' ? 0 : decorById(room.rugId)?.price ?? 0
  return furniture + decor + rug
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state"><span>◇</span><p>{children}</p></div>
}

function RoomDrawer() {
  const state = useAppStore()
  const wallOptions: Array<[RoomDocument['wallColor'], string, string]> = [
    ['bone', 'Bone', '#d8cfbe'], ['clay', 'Clay', '#aa7d6d'], ['chalk', 'Chalk', '#ece8de'], ['ultramarine', 'Ultramarine', '#1737b8'],
  ]
  return (
    <div className="drawer-content room-controls">
      <section>
        <h3>Light</h3>
        <div className="segmented-grid">
          {(['day', 'evening', 'gallery', 'warm-home'] as const).map((preset) => <button key={preset} className={state.room.lighting === preset ? 'is-active' : ''} onClick={() => state.setLighting(preset)}>{preset.replace('-', ' ')}</button>)}
        </div>
      </section>
      <section>
        <h3>Walls</h3>
        <div className="color-options">
          {wallOptions.map(([id, label, color]) => <button key={id} aria-label={label} className={state.room.wallColor === id ? 'is-active' : ''} style={{ '--swatch': color } as React.CSSProperties} onClick={() => state.setWallColor(id)}><i />{label}</button>)}
        </div>
      </section>
      <section>
        <h3>Floor</h3>
        <div className="segmented-grid three">
          {(['travertine', 'smoked-oak', 'pale-ash'] as const).map((floor) => <button key={floor} className={state.room.floorFinish === floor ? 'is-active' : ''} onClick={() => state.setFloorFinish(floor)}>{floor.replace('-', ' ')}</button>)}
        </div>
      </section>
      <section>
        <h3>Rug</h3>
        <div className="segmented-grid three">
          {(['ultramarine-grid', 'travertine-tone', 'none'] as const).map((rug) => <button key={rug} className={state.room.rugId === rug ? 'is-active' : ''} onClick={() => state.setRug(rug)}>{rug.replace('-', ' ')}</button>)}
        </div>
      </section>
      <section>
        <h3>Supporting decor</h3>
        <div className="decor-grid">
          {decorProducts.filter((decor) => decor.category !== 'rug').map((decor) => {
            const placed = state.room.decor.some((item) => item.decorId === decor.id)
            return <article key={decor.id}><i style={{ background: decor.color }} /><div><strong>{decor.name}</strong><span>{formatPrice(decor.price)}</span></div><button className={placed ? 'is-active' : ''} onClick={() => state.toggleDecor(decor.id)}>{placed ? 'Remove' : 'Place'}</button><button onClick={() => state.addCartDecor(decor.id)} aria-label={`Add ${decor.name} to cart`}>+</button></article>
          })}
        </div>
      </section>
      <section className="sound-controls">
        <h3>Sound</h3>
        <label><input type="checkbox" checked={state.audioEnabled} onChange={(event) => state.setAudioEnabled(event.target.checked)} /> Interface sounds</label>
        <label><input type="checkbox" checked={state.ambienceEnabled} disabled={!state.audioEnabled} onChange={(event) => state.setAmbienceEnabled(event.target.checked)} /> Quiet loft ambience</label>
      </section>
    </div>
  )
}

function MoodDrawer() {
  const state = useAppStore()
  if (!state.mood.length) return <EmptyState>Collect products, finishes, and campaign references from the product inspector.</EmptyState>
  return (
    <div className="mood-grid">
      {state.mood.map((entry) => <MoodCard key={entry.id} entry={entry} onRemove={() => state.toggleMood(entry)} />)}
    </div>
  )
}

function MoodCard({ entry, onRemove }: { entry: MoodEntry; onRemove: () => void }) {
  const product = productById(entry.productId)
  if (!product) return null
  const finish = product.finishes.find((candidate) => candidate.id === entry.finishId)
  return (
    <article className={`mood-card type-${entry.type}`}>
      {entry.type === 'image' ? <CampaignVisual product={product} /> : null}
      {entry.type === 'finish' && finish ? <span className="mood-swatch" style={{ background: `linear-gradient(135deg, ${finish.primary} 0 50%, ${finish.secondary} 50%)` }} /> : null}
      {entry.type === 'product' ? <CampaignVisual product={product} compact /> : null}
      <div><small>{entry.type}</small><strong>{finish?.name ?? product.name}</strong><span>{product.name}</span></div>
      <button onClick={onRemove} aria-label={`Remove ${finish?.name ?? product.name} from mood board`}>×</button>
    </article>
  )
}

function SavesDrawer({ sceneRef }: { sceneRef: React.MutableRefObject<RoomScene | null> }) {
  const state = useAppStore()
  const [name, setName] = useState('')
  return (
    <div className="drawer-content">
      <form className="save-form" onSubmit={(event) => {
        event.preventDefault()
        state.saveConfiguration(name, sceneRef.current?.captureThumbnail())
        setName('')
      }}>
        <label htmlFor="save-name">Configuration name</label>
        <div><input id="save-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={`Room ${state.savedConfigurations.length + 1}`} /><button className="primary-button" type="submit">Save current room</button></div>
      </form>
      {!state.savedConfigurations.length ? <EmptyState>Your named room configurations will appear here.</EmptyState> : (
        <div className="saved-list">
          {state.savedConfigurations.map((config) => <SavedCard key={config.id} config={config} onLoad={() => state.loadConfiguration(config.id)} onDelete={() => state.deleteConfiguration(config.id)} />)}
        </div>
      )}
    </div>
  )
}

function SavedCard({ config, onLoad, onDelete }: { config: SavedConfiguration; onLoad: () => void; onDelete: () => void }) {
  return (
    <article className="saved-card">
      {config.thumbnail ? <img src={config.thumbnail} alt={`${config.name} room view`} /> : <div className="saved-placeholder" />}
      <div><small>{new Date(config.createdAt).toLocaleDateString()}</small><strong>{config.name}</strong><span>{config.room.items.length} furniture · {formatPrice(roomSubtotal(config.room))}</span></div>
      <button onClick={onLoad}>Open</button>
      <button className="quiet-button" onClick={onDelete} aria-label={`Delete ${config.name}`}>×</button>
    </article>
  )
}

function CompareDrawer() {
  const state = useAppStore()
  const [aId, bId] = state.compareIds
  const a = state.savedConfigurations.find((config) => config.id === aId)
  const b = state.savedConfigurations.find((config) => config.id === bId)
  if (state.savedConfigurations.length < 2) return <EmptyState>Save at least two room configurations to compare them.</EmptyState>
  return (
    <div className="drawer-content compare-content">
      <div className="compare-selectors">
        {[aId, bId].map((id, index) => <label key={index}>Room {index ? 'B' : 'A'}<select value={id ?? ''} onChange={(event) => state.setCompareId(index as 0 | 1, event.target.value || null)}><option value="">Choose a room</option>{state.savedConfigurations.map((config) => <option key={config.id} value={config.id}>{config.name}</option>)}</select></label>)}
      </div>
      <div className="compare-views">
        {[a, b].map((config, index) => <article key={config?.id ?? index}>{config?.thumbnail ? <img src={config.thumbnail} alt={`${config.name} comparison view`} /> : <div className="compare-placeholder">{config ? 'No capture' : `Select room ${index ? 'B' : 'A'}`}</div>}{config ? <div><strong>{config.name}</strong><span>{config.room.items.length} pieces · {formatPrice(roomSubtotal(config.room))}</span><button onClick={() => state.loadConfiguration(config.id)}>Open this room</button></div> : null}</article>)}
      </div>
      {a && b ? <CompareDelta a={a} b={b} /> : null}
    </div>
  )
}

function CompareDelta({ a, b }: { a: SavedConfiguration; b: SavedConfiguration }) {
  const aFinish = new Map(a.room.items.map((item) => [item.productId, item.finishId]))
  const changedFinishes = b.room.items.filter((item) => aFinish.has(item.productId) && aFinish.get(item.productId) !== item.finishId).length
  const delta = roomSubtotal(b.room) - roomSubtotal(a.room)
  return <div className="compare-delta"><span><small>Furniture</small>{b.room.items.length - a.room.items.length >= 0 ? '+' : ''}{b.room.items.length - a.room.items.length}</span><span><small>Finish changes</small>{changedFinishes}</span><span><small>Subtotal delta</small>{delta >= 0 ? '+' : ''}{formatPrice(delta)}</span></div>
}

const cartLinePrice = (line: CartLine) => {
  if (line.kind === 'decor') return decorById(line.catalogId)?.price ?? 0
  const product = productById(line.catalogId)
  const finish = product?.finishes.find((candidate) => candidate.id === line.finishId)
  return (product?.price ?? 0) + (finish?.priceDelta ?? 0)
}

function CartDrawer() {
  const state = useAppStore()
  const total = state.cart.reduce((sum, line) => sum + cartLinePrice(line) * line.quantity, 0)
  const addRoom = () => {
    state.room.items.forEach((item) => state.addCartProduct(item.productId, item.finishId))
    state.room.decor.forEach((item) => state.addCartDecor(item.decorId))
    if (state.room.rugId !== 'none') state.addCartDecor(state.room.rugId)
    window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'cart' }))
  }
  return (
    <div className="drawer-content cart-content">
      <button className="wide-secondary" onClick={addRoom}>Add every item in this room</button>
      {!state.cart.length ? <EmptyState>Your selected furniture and decor will appear here.</EmptyState> : (
        <>
          <div className="cart-lines">{state.cart.map((line) => <CartLineItem key={line.id} line={line} />)}</div>
          <div className="cart-summary"><span>Subtotal</span><strong>{formatPrice(total)}</strong><small>Mock checkout · delivery and tax not charged</small></div>
          <button className="primary-button checkout-button" onClick={() => state.openDrawer('checkout')}>Continue to mock checkout</button>
        </>
      )}
    </div>
  )
}

function CartLineItem({ line }: { line: CartLine }) {
  const state = useAppStore()
  const product = line.kind === 'product' ? productById(line.catalogId) : undefined
  const decor = line.kind === 'decor' ? decorById(line.catalogId) : undefined
  const name = product?.name ?? decor?.name ?? 'Unknown item'
  const lead = product?.leadTimeWeeks ?? decor?.leadTimeWeeks ?? [0, 0]
  return (
    <article className="cart-line">
      <div className="cart-thumb" style={{ '--cart-color': product?.finishes.find((finish) => finish.id === line.finishId)?.primary ?? decor?.color ?? '#bbb' } as React.CSSProperties} />
      <div className="cart-copy"><strong>{name}</strong><span>Estimated {deliveryWindow(lead as [number, number])}</span>{product ? <select aria-label={`${name} finish`} value={line.finishId} onChange={(event) => state.setCartFinish(line.id, event.target.value)}>{product.finishes.map((finish) => <option key={finish.id} value={finish.id}>{finish.name}</option>)}</select> : null}</div>
      <div className="quantity"><button onClick={() => state.updateCartQuantity(line.id, line.quantity - 1)}>−</button><output>{line.quantity}</output><button onClick={() => state.updateCartQuantity(line.id, line.quantity + 1)}>+</button></div>
      <strong className="line-price">{formatPrice(cartLinePrice(line) * line.quantity)}</strong>
      <button className="remove-line" onClick={() => state.removeCartLine(line.id)} aria-label={`Remove ${name}`}>×</button>
    </article>
  )
}

function CheckoutDrawer() {
  const state = useAppStore()
  const [complete, setComplete] = useState(false)
  const total = state.cart.reduce((sum, line) => sum + cartLinePrice(line) * line.quantity, 0)
  if (complete) return <div className="checkout-complete"><span>✓</span><small>Mock order RR–{new Date().getFullYear()}–041</small><h3>Your room is reserved.</h3><p>No charge was made. This fictional order confirmation demonstrates the Room Ritual checkout flow.</p><button className="primary-button" onClick={() => { state.clearCart(); state.openDrawer(null) }}>Return to room</button></div>
  return (
    <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); setComplete(true) }}>
      <div className="mock-notice">Demonstration checkout — no payment or order will be submitted.</div>
      <label>Full name<input required autoComplete="name" placeholder="Avery Stone" /></label>
      <label>Email<input required type="email" autoComplete="email" placeholder="avery@example.com" /></label>
      <label>Delivery address<input required autoComplete="street-address" placeholder="123 Example Street" /></label>
      <div className="checkout-row"><label>City<input required placeholder="Los Angeles" /></label><label>Postal code<input required placeholder="90012" /></label></div>
      <label>Delivery note<textarea placeholder="Elevator, doorway, or scheduling notes" /></label>
      <div className="checkout-total"><span>Mock subtotal</span><strong>{formatPrice(total)}</strong></div>
      <button className="primary-button" type="submit">Place mock order</button>
    </form>
  )
}

function Drawer({ sceneRef }: { sceneRef: React.MutableRefObject<RoomScene | null> }) {
  const drawer = useAppStore((state) => state.drawer)
  const openDrawer = useAppStore((state) => state.openDrawer)
  if (!drawer) return null
  const titles: Record<Exclude<DrawerName, null>, string> = { mood: 'Mood board', saves: 'Saved rooms', compare: 'Compare rooms', cart: 'Shopping cart', checkout: 'Mock checkout', room: 'Room palette' }
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) openDrawer(null) }}>
      <aside className={`drawer drawer-${drawer}`} aria-label={titles[drawer]}>
        <header><span>Room Ritual</span><h2>{titles[drawer]}</h2><button onClick={() => openDrawer(null)} aria-label={`Close ${titles[drawer]}`}>×</button></header>
        {drawer === 'room' ? <RoomDrawer /> : null}
        {drawer === 'mood' ? <MoodDrawer /> : null}
        {drawer === 'saves' ? <SavesDrawer sceneRef={sceneRef} /> : null}
        {drawer === 'compare' ? <CompareDrawer /> : null}
        {drawer === 'cart' ? <CartDrawer /> : null}
        {drawer === 'checkout' ? <CheckoutDrawer /> : null}
      </aside>
    </div>
  )
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const resetRoom = useAppStore((state) => state.resetRoom)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <span>Reset current room</span>
        <h2 id="reset-title">Return to the opening ritual?</h2>
        <p>Furniture, finishes, lighting, surfaces, and the camera will return to the original layout. Saved rooms, mood board, and cart stay untouched. Reset can be undone.</p>
        <div><button onClick={onClose}>Cancel</button><button className="danger-button" onClick={() => { resetRoom(); onClose() }}>Reset room</button></div>
      </div>
    </div>
  )
}

export function App() {
  const sceneRef = useRef<RoomScene | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const state = useAppStore()

  useEffect(() => {
    const audio = new AudioSystem()
    return () => audio.dispose()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return
      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo(); else state.undo()
        return
      }
      const step = event.shiftKey ? 0.25 : 0.05
      const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '[', ']', 'q', 'Q', 'e', 'E', 'Delete', 'Backspace', 'Escape', 'm', 'M', 'd', 'D', '0', '-', '=', '+'].includes(event.key)
      if (!handled) return
      if (event.key === 'ArrowLeft') state.nudgeSelected(-step, 0)
      if (event.key === 'ArrowRight') state.nudgeSelected(step, 0)
      if (event.key === 'ArrowUp') state.nudgeSelected(0, -step)
      if (event.key === 'ArrowDown') state.nudgeSelected(0, step)
      if (event.key === '[' || event.key.toLowerCase() === 'q') state.rotateSelected(-Math.PI / 12)
      if (event.key === ']' || event.key.toLowerCase() === 'e') state.rotateSelected(Math.PI / 12)
      if (event.key === 'Delete' || event.key === 'Backspace') state.removeSelected()
      if (event.key.toLowerCase() === 'm') state.toggleMeasurements()
      if (event.key.toLowerCase() === 'd') state.duplicateSelected()
      if (event.key === '0') state.requestCameraReset()
      if (event.key === 'Escape') {
        if (state.interactionBase) state.cancelInteraction()
        else if (state.drawer) state.openDrawer(null)
        else state.setInspectMode(false)
      }
      const selected = state.room.items.find((item) => item.id === state.selectedItemId)
      if (selected && (event.key === '-' || event.key === '=' || event.key === '+')) state.setSelectedScale(selected.planningScale + (event.key === '-' ? -0.05 : 0.05))
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state])

  const appClass = useMemo(() => `app-shell${state.inspectMode ? ' is-inspecting' : ''}`, [state.inspectMode])
  return (
    <div className={appClass}>
      <TopBar onReset={() => setResetOpen(true)} />
      <ProductCatalog />
      <SceneViewport sceneRef={sceneRef} />
      <ProductInspector key={state.selectedProductId} />
      <SelectionToolbar />
      <ViewportStatus />
      <Drawer sceneRef={sceneRef} />
      {resetOpen ? <ResetDialog onClose={() => setResetOpen(false)} /> : null}
    </div>
  )
}
