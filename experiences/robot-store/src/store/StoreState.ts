import { catalog, getRobotById, robotMatches } from '../catalog'
import type { CatalogRobot, StoreFilter } from '../types'

export type StoreSnapshot = {
  selectedRobot: CatalogRobot
  filter: StoreFilter
  query: string
  cartIds: string[]
  cartOpen: boolean
  visibleRobots: CatalogRobot[]
}

type Listener = (snapshot: StoreSnapshot) => void

export class StoreState {
  private selectedId = catalog.robots[0].id
  private activeFilter: StoreFilter = 'all'
  private searchQuery = ''
  private cart = new Set<string>()
  private isCartOpen = false
  private readonly listeners = new Set<Listener>()

  snapshot(): StoreSnapshot {
    return {
      selectedRobot: getRobotById(this.selectedId),
      filter: this.activeFilter,
      query: this.searchQuery,
      cartIds: [...this.cart],
      cartOpen: this.isCartOpen,
      visibleRobots: catalog.robots.filter((robot) =>
        robotMatches(robot, this.activeFilter, this.searchQuery),
      ),
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  select(robotId: string): void {
    if (robotId === this.selectedId) return
    this.selectedId = getRobotById(robotId).id
    this.emit()
  }

  next(): void {
    this.selectByOffset(1)
  }

  previous(): void {
    this.selectByOffset(-1)
  }

  setFilter(filter: StoreFilter): void {
    if (filter === this.activeFilter) return
    this.activeFilter = filter
    const visible = catalog.robots.filter((robot) =>
      robotMatches(robot, this.activeFilter, this.searchQuery),
    )
    if (visible.length && !visible.some((robot) => robot.id === this.selectedId)) {
      this.selectedId = visible[0].id
    }
    this.emit()
  }

  setQuery(query: string): void {
    this.searchQuery = query
    const visible = catalog.robots.filter((robot) =>
      robotMatches(robot, this.activeFilter, this.searchQuery),
    )
    if (visible.length && !visible.some((robot) => robot.id === this.selectedId)) {
      this.selectedId = visible[0].id
    }
    this.emit()
  }

  toggleCartItem(robotId: string): void {
    if (this.cart.has(robotId)) this.cart.delete(robotId)
    else this.cart.add(getRobotById(robotId).id)
    this.emit()
  }

  setCartOpen(open: boolean): void {
    if (open === this.isCartOpen) return
    this.isCartOpen = open
    this.emit()
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private selectByOffset(offset: number): void {
    const currentIndex = catalog.robots.findIndex((robot) => robot.id === this.selectedId)
    const nextIndex = (currentIndex + offset + catalog.robots.length) % catalog.robots.length
    this.selectedId = catalog.robots[nextIndex].id
    this.emit()
  }
}
