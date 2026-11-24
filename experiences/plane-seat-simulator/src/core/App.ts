import * as THREE from "three";
import { AssetLibrary } from "../assets/AssetLibrary";
import { syncedKeys } from "../assets/asset-manifest";
import { disposeMintGltfRuntime } from "../assets/gltf-runtime";
import { CameraRig } from "../camera/CameraRig";
import { SEATS } from "../data/cabin-layout";
import { getInitialPlaneSeat } from "../data/seat-links";
import { LookControls } from "../input/LookControls";
import { OrbitControls } from "../input/OrbitControls";
import { WalkControls } from "../input/WalkControls";
import { AppState } from "../state/AppState";
import { ModeMachine } from "../state/ModeMachine";
import { Hud } from "../ui/Hud";
import { SeatMapOverlay } from "../ui/SeatMapOverlay";
import { StartMenu } from "../ui/StartMenu";
import { CabinFurnishings } from "../world/CabinFurnishings";
import { CabinShell } from "../world/CabinShell";
import { CockpitCorridor } from "../world/CockpitCorridor";
import { Colliders } from "../world/Colliders";
import { InspectProxies } from "../world/InspectProxies";
import { Lavatory } from "../world/Lavatory";
import { LightingRig } from "../world/LightingRig";
import { OverheadBins } from "../world/OverheadBins";
import { SkyEnvironment } from "../world/SkyEnvironment";
import { Wings } from "../world/Wings";
import { Loop } from "./Loop";
import { Renderer } from "./Renderer";

/** Composition root; owns scene lifecycle and disposal. */
export class App {
  private scene = new THREE.Scene();
  private rig = new CameraRig();
  private renderer: Renderer;
  private loop: Loop;
  private sky = new SkyEnvironment();
  private lavatory = new Lavatory();
  private furnishings = new CabinFurnishings();
  private lighting: LightingRig;
  private colliders = new Colliders();
  private state = new AppState();
  private look: LookControls;
  private walk: WalkControls;
  private orbit: OrbitControls;
  private proxies = new InspectProxies();
  private machine: ModeMachine;
  private overlay: SeatMapOverlay;
  private hud: Hud;
  private menu?: StartMenu;
  private library = new AssetLibrary();
  private raycaster = new THREE.Raycaster();

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container, this.rig.camera);
    const shell = new CabinShell();
    this.scene.add(this.sky.group);
    this.scene.add(shell.group);
    this.scene.add(new OverheadBins().group);
    this.scene.add(new Wings().group);
    const corridor = new CockpitCorridor();
    this.scene.add(corridor.group);
    this.scene.add(this.lavatory.group);
    this.scene.add(this.furnishings.group);
    this.scene.add(this.furnishings.lavatoryGroup);
    this.scene.add(this.proxies.group);
    this.lighting = new LightingRig(this.sky, this.renderer.gl);
    this.scene.add(this.lighting.group);
    // Everything a mirror in the sealed lavatory can actually see: the room,
    // its fixtures, and the fuselage and sky behind the window aperture.
    this.lavatory.reflectOnly([
      this.lavatory.group,
      this.furnishings.lavatoryGroup,
      shell.group,
      this.sky.group,
      this.lighting.group,
    ]);

    this.look = new LookControls(this.renderer.canvas, this.rig);
    this.walk = new WalkControls(this.renderer.canvas, this.rig, this.colliders);
    this.orbit = new OrbitControls(this.renderer.canvas, this.rig);
    this.machine = new ModeMachine(
      this.state,
      this.rig,
      this.look,
      this.walk,
      this.orbit,
    );
    this.machine.onPresetChange = (preset) => this.lighting.apply(preset);

    // The same map serves the landing page, so a pick there has to take the
    // title card down on its way to the seat.
    this.overlay = new SeatMapOverlay(container, this.state, (id) => {
      this.menu?.close();
      this.machine.goToLocation(id);
    });
    this.hud = new Hud(container, this.state, {
      toggleMap: () => this.machine.toggleMap(),
      setLighting: (preset) => this.machine.setLighting(preset),
      standUp: () => this.machine.standUp(),
      resumeWalk: () => this.machine.resumeWalk(),
      frameCabin: () => this.machine.frameCabin(),
      returnToOverview: () => this.machine.returnToOverview(),
    });
    this.state.onChange(() => {
      this.overlay.update();
      this.hud.update();
    });

    this.machine.startOverview();
    const initialSeat = getInitialPlaneSeat(window);
    if (initialSeat) {
      this.state.patch({ menuOpen: false });
      this.machine.goToLocation(initialSeat);
    } else {
      // The cabin loads behind the title card; Start hands over to the seat map.
      this.menu = new StartMenu(
        container,
        () => this.machine.openMap(),
        () => this.state.patch({ menuOpen: false }),
      );
    }
    this.wireOverviewInteractions();
    this.wireWalkInteractions();
    this.loop = new Loop((dt) => this.update(dt));
    void this.loadAssets();
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__app = this;
    }
  }

  /**
   * Click-to-frame in the overview. Specific targets win over the section
   * blankets that cover them, so a click only falls through to "Mid cabin"
   * when it missed every seat, room and exit along the ray.
   */
  private wireOverviewInteractions() {
    this.orbit.onPick = (clientX, clientY) => {
      const rect = this.renderer.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(ndc, this.rig.camera);
      this.raycaster.far = 40;
      const idFrom = (targets: THREE.Object3D[]) => {
        const hit = this.raycaster.intersectObjects(targets, false)[0];
        const data = hit?.object.userData;
        return (data?.targetId ?? data?.locationId) as string | undefined;
      };
      const id =
        idFrom([...this.furnishings.pickProxies, ...this.proxies.specific]) ??
        idFrom(this.proxies.sections);
      if (id) this.machine.frame(id);
    };

    window.addEventListener("keydown", this.onShortcut);
  }

  /**
   * The shortcuts the HUD advertises on its key badges. Ignored while typing
   * and while the title card is up, so the landing page keeps its own keys.
   */
  private onShortcut = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || this.state.menuOpen) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

    switch (e.code) {
      case "Escape":
        if (this.state.mapOpen) this.machine.toggleMap();
        else if (this.state.mode === "inspect") this.machine.frameCabin();
        else this.machine.returnToOverview();
        break;
      case "KeyM":
        this.machine.toggleMap();
        break;
      case "KeyE":
        // Walk mode binds E to sitting down, handled with the seat raycast.
        if (this.state.mode === "seated") this.machine.standUp();
        break;
      case "Digit1":
        this.machine.setLighting("day");
        break;
      case "Digit2":
        this.machine.setLighting("sunset");
        break;
      case "Digit3":
        this.machine.setLighting("night");
        break;
      default:
        return;
    }
  };

  private wireWalkInteractions() {
    // Click a seat while walking (pointer locked → center-of-view raycast).
    this.renderer.canvas.addEventListener("click", () => {
      if (this.state.mode !== "walk" || !this.walk.isLocked) return;
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.rig.camera);
      this.raycaster.far = 3;
      const hits = this.raycaster.intersectObjects(this.furnishings.pickProxies, false);
      const id = hits[0]?.object.userData.locationId as string | undefined;
      if (id) this.machine.sitAt(id);
    });
    // E: sit in the nearest seat.
    window.addEventListener("keydown", (e) => {
      if (e.code !== "KeyE" || this.state.mode !== "walk") return;
      const p = this.rig.position;
      let best: { id: string; d: number } | null = null;
      for (const seat of SEATS) {
        const d = Math.hypot(seat.pos[0] - p.x, seat.pos[2] - p.z);
        if (d < 1.4 && (!best || d < best.d)) best = { id: seat.id, d };
      }
      if (best) this.machine.sitAt(best.id);
    });
  }

  private async loadAssets() {
    if (syncedKeys().length === 0) {
      this.state.patch({
        status: "Cabin models not synced yet — showing the bare cabin",
      });
      return;
    }
    this.state.patch({ status: "Loading cabin furnishings…" });
    const report = await this.library.loadAll(() =>
      this.furnishings.populate(this.library),
    );
    if (report.fatalError) {
      this.state.patch({ status: report.fatalError });
    } else if (report.missing.length > 0) {
      this.state.patch({
        status: `Ready (missing models: ${report.missing.join(", ")})`,
      });
    } else {
      // Everything arrived, so the loading notice has nothing left to say.
      this.state.patch({ status: "" });
    }
  }

  start() {
    this.loop.start();
  }

  private update(dt: number) {
    this.walk.update(dt);
    if (this.orbit.enabled) this.orbit.apply();
    this.rig.update(dt);
    this.sky.update(dt);
    this.lavatory.update();
    this.renderer.render(this.scene);
  }

  dispose() {
    this.loop.stop();
    this.look.dispose();
    this.walk.dispose();
    this.orbit.dispose();
    this.menu?.dispose();
    window.removeEventListener("keydown", this.onShortcut);
    this.renderer.dispose();
    disposeMintGltfRuntime();
  }
}
