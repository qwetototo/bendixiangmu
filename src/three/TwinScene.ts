import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelConfig, OverlayConfig, SceneConfig } from '@/types/scene';
import { SceneBuilder } from '@/three/builders/SceneBuilder';

const modelModules = import.meta.glob('/src/assets/model/**/*.{glb,gltf}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const overlayModules = import.meta.glob('/src/assets/image/**/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

// Keep downloaded files and parsed model templates for the lifetime of the page.
// Repeated scene instances and repeated furniture entries then share the same assets.
THREE.Cache.enabled = true;
const sharedGltfLoader = new GLTFLoader();
const sharedModelTemplateCache = new Map<string, Promise<THREE.Object3D | null>>();
const DEFAULT_MODEL_SCALE_RATIO = 100;

export interface PickPointResult {
  scene: {
    x: number;
    z: number;
  };
  floor: {
    x: number;
    y: number;
  };
}

export interface LivePose {
  deviceId: string;
  x: number;
  y: number;
  z: number;
  theta: number;
  time?: number;
  receivedAt?: string;
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  time?: number;
}

interface LivePoseSample {
  sortKey: number;
  x: number;
  y: number;
  z: number;
}

export class TwinScene {
  private static readonly LIVE_POSE_MARKER_HEIGHT = 0;
  private static readonly LIVE_POSE_TRAIL_HEIGHT = 1.2;
  private static readonly LIVE_POSE_COLOR = '#3be3ff';
  private static readonly LIVE_POSE_DISC_COLOR = '#0b4b66';
  private static readonly LIVE_POSE_CORE_COLOR = '#e8fbff';
  private static readonly LIVE_POSE_EMISSIVE_COLOR = '#46e6ff';
  private static readonly LIVE_POSE_TRAIL_COLOR = '#ff2d2d';
  private static readonly SELECTED_LIVE_POSE_COLOR = '#ffd84d';
  private static readonly SELECTED_LIVE_POSE_DISC_COLOR = '#665400';
  private static readonly SELECTED_LIVE_POSE_CORE_COLOR = '#fff5c2';
  private static readonly SELECTED_LIVE_POSE_EMISSIVE_COLOR = '#ffd84d';
  private static readonly SELECTED_LIVE_POSE_TRAIL_COLOR = '#ffd84d';
  private readonly container: HTMLDivElement;
  private readonly config: SceneConfig;
  private readonly builder = new SceneBuilder();
  private readonly onPointPick?: (point: PickPointResult) => void;
  private readonly onLivePoseSelect?: (deviceId: string) => void;

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frameId = 0;
  private floorGroup: THREE.Group | null = null;
  private modelGroups: THREE.Object3D[] = [];
  private overlayPlane: THREE.Mesh | null = null;
  private overlayMaterial: THREE.MeshBasicMaterial | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private livePoseGroup: THREE.Group | null = null;
  private readonly livePoseMarkers = new Map<string, THREE.Group>();
  private readonly livePoseTrails = new Map<string, THREE.Line>();
  private readonly livePoseSamples = new Map<string, LivePoseSample[]>();
  private livePoseLabelsVisible = true;
  private visibleLivePoseIds: Set<string> | null = null;
  private selectedLivePoseId: string | null = null;
  private trackedLivePoseId: string | null = null;
  private trailsVisible = true;
  private overlayBaseSize = new THREE.Vector2(1, 1);
  private resizeHandler: () => void;
  private clickHandler: (event: MouseEvent) => void;
  private doubleClickHandler: (event: MouseEvent) => void;
  private contextMenuHandler: (event: MouseEvent) => void;

  constructor(
    container: HTMLDivElement,
    config: SceneConfig,
    onPointPick?: (point: PickPointResult) => void,
    onLivePoseSelect?: (deviceId: string) => void,
  ) {
    this.container = container;
    this.config = config;
    this.onPointPick = onPointPick;
    this.onLivePoseSelect = onLivePoseSelect;
    this.resizeHandler = () => this.handleResize();
    this.clickHandler = (event: MouseEvent) => this.handleSceneClick(event);
    this.doubleClickHandler = (event: MouseEvent) => this.handleSceneDoubleClick(event);
    this.contextMenuHandler = (event: MouseEvent) => this.handleSceneContextMenu(event);
  }

  init(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07111d');
    this.scene.fog = new THREE.Fog('#07111d', 450, 1400);

    this.createCamera();
    this.createRenderer();
    this.addLights();
    this.addHelpers();
    this.addControls();
    this.loadSceneConfig();

    window.addEventListener('resize', this.resizeHandler);
    this.renderer?.domElement.addEventListener('click', this.clickHandler);
    this.renderer?.domElement.addEventListener('dblclick', this.doubleClickHandler);
    this.renderer?.domElement.addEventListener('contextmenu', this.contextMenuHandler);
    this.handleResize();
    this.animate();
  }

  private createCamera(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    this.camera.position.set(220, 240, 360);
    this.camera.lookAt(0, 0, 0);
  }

  private createRenderer(): void {
    if (!this.scene || !this.camera) {
      return;
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
  }

  private addLights(): void {
    if (!this.scene) {
      return;
    }

    const ambientLight = new THREE.AmbientLight('#d6ecff', 1.6);
    ambientLight.name = 'ambientLight';

    const directionalLight = new THREE.DirectionalLight('#ffffff', 1.8);
    directionalLight.name = 'directionalLight';
    directionalLight.position.set(160, 260, 180);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -400;
    directionalLight.shadow.camera.right = 400;
    directionalLight.shadow.camera.top = 400;
    directionalLight.shadow.camera.bottom = -400;

    const fillLight = new THREE.DirectionalLight('#5dade2', 0.6);
    fillLight.position.set(-180, 120, -120);

    this.scene.add(ambientLight, directionalLight, fillLight);
  }

  private addHelpers(): void {
    if (!this.scene) {
      return;
    }

    const gridHelper = new THREE.GridHelper(1000, 40, '#1f6feb', '#12314f');
    gridHelper.position.y = 0.01;
    gridHelper.visible = false;
    this.scene.add(gridHelper);
    this.gridHelper = gridHelper;
  }

  private addControls(): void {
    if (!this.camera || !this.renderer) {
      return;
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 900;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private loadSceneConfig(): void {
    if (!this.scene) {
      return;
    }

    this.addFloorOverlay();
    this.floorGroup = this.builder.build(this.config);
    this.addLivePoseLayer();
    this.scene.add(this.floorGroup);
    void this.loadReferenceModels();
  }

  private addLivePoseLayer(): void {
    if (!this.scene) {
      return;
    }

    const livePoseGroup = new THREE.Group();
    livePoseGroup.name = 'device:live-pose-group';
    this.scene.add(livePoseGroup);
    this.livePoseGroup = livePoseGroup;
  }

  private createLivePoseMarker(deviceId: string): THREE.Group {
    const markerGroup = new THREE.Group();
    markerGroup.name = `device:live-pose:${deviceId}`;

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(7, 10, 48),
      new THREE.MeshBasicMaterial({
        color: TwinScene.LIVE_POSE_COLOR,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    baseRing.name = `device:ring:${deviceId}`;
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.24;
    baseRing.renderOrder = 28;

    const baseDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 40),
      new THREE.MeshBasicMaterial({
        color: TwinScene.LIVE_POSE_DISC_COLOR,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    baseDisc.name = `device:disc:${deviceId}`;
    baseDisc.rotation.x = -Math.PI / 2;
    baseDisc.position.y = 0.18;
    baseDisc.renderOrder = 27;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 28, 28),
      new THREE.MeshStandardMaterial({
        color: TwinScene.LIVE_POSE_CORE_COLOR,
        emissive: new THREE.Color(TwinScene.LIVE_POSE_EMISSIVE_COLOR).multiplyScalar(0.95),
        metalness: 0.08,
        roughness: 0.18,
      }),
    );
    core.name = `device:core:${deviceId}`;
    core.castShadow = true;
    core.position.y = 4.6;

    const pointerShape = new THREE.Shape();
    pointerShape.moveTo(0, 8.5);
    pointerShape.lineTo(5.6, 0.8);
    pointerShape.lineTo(2.2, 0.8);
    pointerShape.lineTo(2.2, -7.8);
    pointerShape.lineTo(-2.2, -7.8);
    pointerShape.lineTo(-2.2, 0.8);
    pointerShape.lineTo(-5.6, 0.8);
    pointerShape.closePath();

    const pointerGlow = new THREE.Mesh(
      new THREE.ShapeGeometry(pointerShape),
      new THREE.MeshBasicMaterial({
        color: TwinScene.LIVE_POSE_COLOR,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    pointerGlow.name = `device:pointer-glow:${deviceId}`;
    pointerGlow.rotation.x = -Math.PI / 2;
    pointerGlow.position.set(0, 0.3, 11.5);
    pointerGlow.scale.set(1.25, 1.25, 1);
    pointerGlow.renderOrder = 29;

    const pointer = new THREE.Mesh(
      new THREE.ShapeGeometry(pointerShape),
      new THREE.MeshBasicMaterial({
        color: TwinScene.LIVE_POSE_CORE_COLOR,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    pointer.name = `device:pointer:${deviceId}`;
    pointer.position.set(0, 0.34, 11.5);
    pointer.rotation.x = -Math.PI / 2;
    pointer.renderOrder = 30;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.createRadialGradientTexture(TwinScene.LIVE_POSE_COLOR),
        transparent: true,
        depthWrite: false,
        opacity: 0.48,
      }),
    );
    halo.name = `device:halo:${deviceId}`;
    halo.scale.set(24, 24, 1);
    halo.position.set(0, 4.8, 0);
    halo.renderOrder = 26;

    const label = this.createDeviceLabel(deviceId);
    label.visible = this.livePoseLabelsVisible;
    label.position.set(0, 26, 0);

    markerGroup.add(baseDisc, baseRing, halo, core, pointerGlow, pointer, label);
    return markerGroup;
  }

  private createLivePoseTrail(deviceId: string): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: TwinScene.LIVE_POSE_TRAIL_COLOR,
      transparent: true,
      opacity: 0.72,
    });

    const trail = new THREE.Line(geometry, material);
    trail.name = `device:trail:${deviceId}`;
    trail.renderOrder = 25;
    return trail;
  }

  private createDeviceLabel(deviceId: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 360;
    canvas.height = 110;

    if (!context) {
      return new THREE.Sprite();
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(5, 18, 30, 0.72)';
    context.strokeStyle = 'rgba(96, 236, 255, 0.95)';
    context.lineWidth = 3;
    this.drawRoundRect(context, 6, 8, canvas.width - 12, canvas.height - 18, 20);
    context.shadowColor = 'rgba(67, 229, 255, 0.28)';
    context.shadowBlur = 18;
    context.fill();
    context.shadowBlur = 0;
    context.stroke();

    context.fillStyle = '#dffbff';
    context.font = '600 30px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(deviceId || 'unknown', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.name = `device:label:${deviceId}`;
    sprite.scale.set(52, 16, 1);
    sprite.renderOrder = 30;
    return sprite;
  }

  private createRadialGradientTexture(color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    const gradient = context.createRadialGradient(64, 64, 10, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(0.5, 'rgba(105,240,255,0.22)');
    gradient.addColorStop(1, 'rgba(105,240,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private drawRoundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }

  private getOrCreateLivePoseMarker(deviceId: string): THREE.Group | null {
    if (!this.livePoseGroup) {
      return null;
    }

    const markerId = deviceId || 'unknown';
    const cachedMarker = this.livePoseMarkers.get(markerId);
    if (cachedMarker) {
      return cachedMarker;
    }

    const marker = this.createLivePoseMarker(markerId);
    marker.visible = this.isLivePoseVisible(markerId);
    this.livePoseGroup.add(marker);
    this.livePoseMarkers.set(markerId, marker);
    this.updateLivePoseLabelVisibility();
    this.updateLivePoseSelectionStyle();
    return marker;
  }

  private getOrCreateLivePoseTrail(deviceId: string): THREE.Line | null {
    if (!this.livePoseGroup) {
      return null;
    }

    const trailId = deviceId || 'unknown';
    const cachedTrail = this.livePoseTrails.get(trailId);
    if (cachedTrail) {
      return cachedTrail;
    }

    const trail = this.createLivePoseTrail(trailId);
    trail.visible = this.trailsVisible && this.isLivePoseVisible(trailId);
    (trail.material as THREE.LineBasicMaterial).color.set(
      trailId === this.selectedLivePoseId ? TwinScene.SELECTED_LIVE_POSE_TRAIL_COLOR : TwinScene.LIVE_POSE_TRAIL_COLOR,
    );
    this.livePoseGroup.add(trail);
    this.livePoseTrails.set(trailId, trail);
    return trail;
  }

  private getLivePoseMarkerId(object: THREE.Object3D | null): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.name.startsWith('device:live-pose:')) {
        return current.name.slice('device:live-pose:'.length) || 'unknown';
      }
      current = current.parent;
    }

    return null;
  }

  private isLivePoseVisible(deviceId: string): boolean {
    return !this.visibleLivePoseIds || this.visibleLivePoseIds.has(deviceId || 'unknown');
  }

  private applyLivePoseVisibility(): void {
    this.livePoseMarkers.forEach((marker, deviceId) => {
      marker.visible = this.isLivePoseVisible(deviceId);
    });

    this.livePoseTrails.forEach((trail, deviceId) => {
      const position = trail.geometry.getAttribute('position');
      trail.visible = this.trailsVisible && this.isLivePoseVisible(deviceId) && Boolean(position && position.count > 1);
    });

    this.updateLivePoseLabelVisibility();
  }

  private updateLivePoseLabelVisibility(): void {
    this.livePoseMarkers.forEach((marker, deviceId) => {
      marker.traverse((object) => {
        if (object.name.startsWith('device:label:')) {
          object.visible = this.isLivePoseVisible(deviceId) && (this.livePoseLabelsVisible || deviceId === this.selectedLivePoseId);
        }
      });
    });
  }

  private updateLivePoseSelectionStyle(): void {
    this.livePoseMarkers.forEach((marker, deviceId) => {
      const selected = deviceId === this.selectedLivePoseId;
      marker.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const sprite = object as THREE.Sprite;

        if (object.name.startsWith('device:ring:') || object.name.startsWith('device:pointer-glow:')) {
          (mesh.material as THREE.MeshBasicMaterial).color.set(
            selected ? TwinScene.SELECTED_LIVE_POSE_COLOR : TwinScene.LIVE_POSE_COLOR,
          );
        } else if (object.name.startsWith('device:disc:')) {
          (mesh.material as THREE.MeshBasicMaterial).color.set(
            selected ? TwinScene.SELECTED_LIVE_POSE_DISC_COLOR : TwinScene.LIVE_POSE_DISC_COLOR,
          );
        } else if (object.name.startsWith('device:core:')) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.color.set(selected ? TwinScene.SELECTED_LIVE_POSE_CORE_COLOR : TwinScene.LIVE_POSE_CORE_COLOR);
          material.emissive.set(selected ? TwinScene.SELECTED_LIVE_POSE_EMISSIVE_COLOR : TwinScene.LIVE_POSE_EMISSIVE_COLOR);
        } else if (object.name.startsWith('device:pointer:')) {
          (mesh.material as THREE.MeshBasicMaterial).color.set(
            selected ? TwinScene.SELECTED_LIVE_POSE_CORE_COLOR : TwinScene.LIVE_POSE_CORE_COLOR,
          );
        } else if (object.name.startsWith('device:halo:')) {
          (sprite.material as THREE.SpriteMaterial).color.set(
            selected ? TwinScene.SELECTED_LIVE_POSE_COLOR : TwinScene.LIVE_POSE_COLOR,
          );
        }
      });
    });

    this.livePoseTrails.forEach((trail, deviceId) => {
      (trail.material as THREE.LineBasicMaterial).color.set(
        deviceId === this.selectedLivePoseId
          ? TwinScene.SELECTED_LIVE_POSE_TRAIL_COLOR
          : TwinScene.LIVE_POSE_TRAIL_COLOR,
      );
    });
  }

  private focusTrackedLivePose(marker: THREE.Object3D): void {
    if (!this.camera || !this.controls) {
      return;
    }

    const nextTarget = marker.position.clone();
    const cameraOffset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    this.controls.target.copy(nextTarget);
    this.camera.position.copy(nextTarget).add(cameraOffset);
    this.camera.lookAt(nextTarget);
    this.controls.update();
  }

  private selectLivePoseMarker(deviceId: string): void {
    const marker = this.livePoseMarkers.get(deviceId);
    if (!marker) {
      return;
    }

    this.onLivePoseSelect?.(deviceId);
    this.selectedLivePoseId = deviceId;
    this.trackedLivePoseId = deviceId;
    this.updateLivePoseLabelVisibility();
    this.updateLivePoseSelectionStyle();
    this.focusTrackedLivePose(marker);
  }

  focusLivePose(deviceId: string): void {
    this.selectLivePoseMarker(deviceId);
  }

  private clearLivePoseSelection(): void {
    this.selectedLivePoseId = null;
    this.trackedLivePoseId = null;
    this.updateLivePoseLabelVisibility();
    this.updateLivePoseSelectionStyle();
  }

  private getPoseSortKey(pose: LivePose): number {
    const receivedAtMs = pose.receivedAt ? Date.parse(pose.receivedAt) : Number.NaN;
    if (Number.isFinite(receivedAtMs)) {
      return receivedAtMs;
    }

    if (typeof pose.time === 'number' && Number.isFinite(pose.time)) {
      return pose.time;
    }

    return Date.now();
  }

  private rebuildTrailGeometry(deviceId: string): void {
    const trail = this.getOrCreateLivePoseTrail(deviceId);
    if (!trail) {
      return;
    }

    const trailId = deviceId || 'unknown';
    const samples = this.livePoseSamples.get(trailId) ?? [];
    const points = samples.map(
      (sample) => new THREE.Vector3(sample.x, Math.max(sample.z, 0) + TwinScene.LIVE_POSE_TRAIL_HEIGHT, sample.y),
    );
    trail.geometry.dispose();
    trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
    trail.visible = this.trailsVisible && this.isLivePoseVisible(trailId) && points.length > 1;
  }

  private disposeObjectResources(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }

      const material = mesh.material;
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      materials.forEach((item) => {
        const textureMap = (item as THREE.Material & { map?: THREE.Texture | null }).map;
        if (textureMap) {
          textureMap.dispose();
        }
        item.dispose();
      });
    });
  }

  private updateLivePoseTrail(deviceId: string, pose: LivePose): void {
    const trailId = deviceId || 'unknown';
    const samples = this.livePoseSamples.get(trailId) ?? [];
    samples.push({
      sortKey: this.getPoseSortKey(pose),
      x: pose.x,
      y: pose.y,
      z: pose.z,
    });

    samples.sort((left, right) => left.sortKey - right.sortKey);

    const limitedSamples = samples.slice(-500);
    this.livePoseSamples.set(trailId, limitedSamples);
    this.rebuildTrailGeometry(deviceId);
  }

  setDevicePath(deviceId: string, points: PathPoint[]): void {
    if (!this.livePoseGroup) {
      return;
    }

    const trailId = deviceId || 'unknown';
    const pathSamples = points
      .filter((point) => [point.x, point.y, point.z].every((value) => Number.isFinite(value)))
      .map((point, index) => ({
        sortKey: index,
        x: point.x,
        y: point.y,
        z: point.z,
      }));

    this.livePoseSamples.set(trailId, pathSamples.slice(-5000));
    this.rebuildTrailGeometry(trailId);
  }

  clearDeviceLivePose(deviceId: string): void {
    const targetId = deviceId || 'unknown';

    const marker = this.livePoseMarkers.get(targetId);
    if (marker) {
      this.livePoseGroup?.remove(marker);
      this.disposeObjectResources(marker);
      this.livePoseMarkers.delete(targetId);
    }

    const trail = this.livePoseTrails.get(targetId);
    if (trail) {
      this.livePoseGroup?.remove(trail);
      this.disposeObjectResources(trail);
      this.livePoseTrails.delete(targetId);
    }

    this.livePoseSamples.delete(targetId);
    if (this.selectedLivePoseId === targetId || this.trackedLivePoseId === targetId) {
      this.clearLivePoseSelection();
    }
  }

  clearAllDevicePoses(): void {
    [...this.livePoseMarkers.keys()].forEach((deviceId) => {
      this.clearDeviceLivePose(deviceId);
    });
    this.clearAllTrails();
    this.clearLivePoseSelection();
  }

  private addFloorOverlay(): void {
    if (!this.scene) {
      return;
    }

    if (!this.config.overlay.path.trim()) {
      return;
    }

    const overlayUrl = this.resolveOverlayUrl(this.config.overlay.path);
    if (!overlayUrl) {
      console.error(`Overlay image not found in src/assets/image: ${this.config.overlay.path}`);
      return;
    }

    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(overlayUrl, (loadedTexture) => {
      const image = loadedTexture.image as { width?: number; height?: number };
      this.updateOverlayAspect(image.width ?? 1, image.height ?? 1);
      this.applyOverlayConfig(this.config.overlay);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: this.config.overlay.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.name = 'floor:overlay';
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.05;
    plane.visible = false;
    plane.renderOrder = 1;

    this.overlayPlane = plane;
    this.overlayMaterial = material;
    this.applyOverlayConfig(this.config.overlay);
    this.scene.add(plane);
  }

  toggleFences(visible: boolean): void {
    if (!this.floorGroup) {
      return;
    }

    this.floorGroup.traverse((object) => {
      if (object.name.startsWith('fence:')) {
        object.visible = visible;
      }
    });
  }

  toggleLivePoseLabels(visible: boolean): void {
    this.livePoseLabelsVisible = visible;
    this.updateLivePoseLabelVisibility();
  }

  setVisibleLivePoses(deviceIds: string[] | null): void {
    this.visibleLivePoseIds = deviceIds === null ? null : new Set(deviceIds.map((id) => id || 'unknown'));
    if (this.selectedLivePoseId && !this.isLivePoseVisible(this.selectedLivePoseId)) {
      this.clearLivePoseSelection();
    }
    this.applyLivePoseVisibility();
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    this.livePoseTrails.forEach((trail) => {
      const position = trail.geometry.getAttribute('position');
      const deviceId = trail.name.slice('device:trail:'.length) || 'unknown';
      trail.visible = visible && this.isLivePoseVisible(deviceId) && Boolean(position && position.count > 1);
    });
  }

  clearAllTrails(): void {
    this.livePoseSamples.clear();
    this.livePoseTrails.forEach((trail) => {
      trail.geometry.dispose();
      trail.geometry = new THREE.BufferGeometry();
      trail.visible = false;
    });
  }

  setCameraView(view: 'overview' | 'top' | 'side'): void {
    if (!this.camera || !this.controls) {
      return;
    }

    const target = new THREE.Vector3(0, 0, 0);
    if (view === 'top') {
      this.camera.position.set(0, 640, 0.01);
    } else if (view === 'side') {
      this.camera.position.set(0, 220, 540);
    } else {
      this.camera.position.set(220, 240, 360);
    }

    this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.controls.update();
  }

  zoom(delta: number): void {
    if (!this.camera || !this.controls) {
      return;
    }

    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const scale = delta < 0 ? 1.16 : 0.86;
    const nextLength = THREE.MathUtils.clamp(direction.length() * scale, this.controls.minDistance, this.controls.maxDistance);
    direction.setLength(nextLength);
    this.camera.position.copy(this.controls.target).add(direction);
    this.controls.update();
  }

  updateLivePose(pose: LivePose | null): void {
    if (!pose || !this.livePoseGroup) {
      return;
    }

    const { x, y, z, theta } = pose;
    if (![x, y, z, theta].every((value) => Number.isFinite(value))) {
      return;
    }

    const marker = this.getOrCreateLivePoseMarker(pose.deviceId);
    if (!marker) {
      return;
    }

    this.updateLivePoseTrail(pose.deviceId, pose);
    marker.visible = this.isLivePoseVisible(pose.deviceId);
    marker.position.set(x, Math.max(z, 0) + TwinScene.LIVE_POSE_MARKER_HEIGHT, y);
    marker.rotation.set(0, theta, 0);

    if (pose.deviceId === this.trackedLivePoseId) {
      this.focusTrackedLivePose(marker);
    }
  }

  updateReplayPose(deviceId: string, point: PathPoint, theta = 0): void {
    if (!this.livePoseGroup || ![point.x, point.y, point.z, theta].every((value) => Number.isFinite(value))) {
      return;
    }

    const marker = this.getOrCreateLivePoseMarker(deviceId);
    if (!marker) {
      return;
    }

    marker.visible = this.isLivePoseVisible(deviceId);
    marker.position.set(point.x, Math.max(point.z, 0) + TwinScene.LIVE_POSE_MARKER_HEIGHT, point.y);
    marker.rotation.set(0, theta, 0);
    if (deviceId === this.trackedLivePoseId) {
      this.focusTrackedLivePose(marker);
    }

    // 同步显示该设备的轨迹，确保定位点和轨迹总是一致
    const trailId = deviceId || 'unknown';
    const trail = this.livePoseTrails.get(trailId);
    if (trail) {
      const position = trail.geometry.getAttribute('position');
      trail.visible = this.trailsVisible && this.isLivePoseVisible(trailId) && Boolean(position && position.count > 1);
    }
  }

  hideReplayPose(deviceId: string): void {
    const markerId = deviceId || 'unknown';
    const marker = this.livePoseMarkers.get(markerId);
    if (marker) {
      marker.visible = false;
    }

    // 同步隐藏轨迹，避免出现"有轨迹无定位点"的割裂问题
    const trail = this.livePoseTrails.get(markerId);
    if (trail) {
      trail.visible = false;
    }
  }

  private resolveOverlayUrl(overlayPath: string): string | null {
    if (/^(data:|blob:|https?:\/\/)/i.test(overlayPath)) {
      return overlayPath;
    }

    const configuredPath = overlayPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const directKey = `/src/assets/image/${configuredPath}`;

    if (overlayModules[directKey]) {
      return overlayModules[directKey];
    }

    const fallbackEntry = Object.entries(overlayModules).find(([key]) => key.endsWith(`/${configuredPath}`));
    return fallbackEntry?.[1] ?? null;
  }

  private updateOverlayAspect(imageWidth: number, imageHeight: number): void {
    if (!this.overlayPlane) {
      return;
    }

    const safeWidth = Math.max(imageWidth, 1);
    const safeHeight = Math.max(imageHeight, 1);
    const imageAspect = safeWidth / safeHeight;
    const floorAspect = this.config.floor.width / this.config.floor.height;

    if (imageAspect >= floorAspect) {
      this.overlayBaseSize.set(this.config.floor.width, this.config.floor.width / imageAspect);
    } else {
      this.overlayBaseSize.set(this.config.floor.height * imageAspect, this.config.floor.height);
    }

    this.overlayPlane.geometry.dispose();
    this.overlayPlane.geometry = new THREE.PlaneGeometry(this.overlayBaseSize.x, this.overlayBaseSize.y);
  }

  private applyOverlayConfig(overlayConfig: OverlayConfig): void {
    if (!this.overlayPlane) {
      return;
    }

    this.overlayPlane.scale.setScalar(overlayConfig.scale);
    this.overlayPlane.position.x = overlayConfig.offset[0];
    this.overlayPlane.position.z = overlayConfig.offset[1];

    if (this.overlayMaterial) {
      this.overlayMaterial.opacity = overlayConfig.opacity;
      this.overlayMaterial.needsUpdate = true;
    }
  }

  private async loadReferenceModels(): Promise<void> {
    const tasks = this.config.models.map((modelConfig, index) => this.loadReferenceModel(modelConfig, index));
    await Promise.all(tasks);
  }

  private async loadReferenceModel(modelConfig: ModelConfig, index: number): Promise<void> {
    if (!this.scene) {
      return;
    }

    const template = await this.loadModelTemplate(modelConfig.path);
    if (!template || !this.scene) {
      return;
    }

    try {
      const model = cloneSkeleton(template);

      model.name = `model:${index}:${modelConfig.path}`;
      this.applyModelConfig(model, modelConfig);

      this.modelGroups.push(model);
      this.scene.add(model);
    } catch (error) {
      console.error(`Failed to load ${modelConfig.path}`, error);
    }
  }

  private async loadModelTemplate(modelPath: string): Promise<THREE.Object3D | null> {
    const modelUrl = this.resolveModelUrl(modelPath);
    if (!modelUrl) {
      console.error(`Model file not found in src/assets/model: ${modelPath}`);
      return null;
    }

    const cachedTemplate = sharedModelTemplateCache.get(modelUrl);
    if (cachedTemplate) {
      return cachedTemplate;
    }

    const templatePromise = this.fetchModelTemplate(modelPath, modelUrl);
    sharedModelTemplateCache.set(modelUrl, templatePromise);

    const template = await templatePromise;
    if (!template) {
      sharedModelTemplateCache.delete(modelUrl);
    }

    return template;
  }

  private async fetchModelTemplate(modelPath: string, modelUrl: string): Promise<THREE.Object3D | null> {
    try {
      const gltf = await sharedGltfLoader.loadAsync(modelUrl);
      const template = gltf.scene;
      this.prepareModelTemplate(template);
      return template;
    } catch (error) {
      console.error(`Failed to load ${modelPath}`, error);
      return null;
    }
  }

  private prepareModelTemplate(model: THREE.Object3D): void {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const material = mesh.material;
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach((item) => {
        if (!item || !('color' in item)) {
          return;
        }

        item.transparent = false;
        item.opacity = 1;

        if ('emissive' in item) {
          (item as THREE.MeshStandardMaterial).emissive.set('#222222');
        }
      });
    });
  }

  private resolveModelUrl(modelPath: string): string | null {
    if (/^(data:|blob:|https?:\/\/)/i.test(modelPath)) {
      return modelPath;
    }

    if (modelPath.startsWith('/') && !modelPath.startsWith('/src/assets/model/')) {
      return modelPath;
    }

    const configuredPath = modelPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const directKey = `/src/assets/model/${configuredPath}`;

    if (modelModules[directKey]) {
      return modelModules[directKey];
    }

    const fallbackEntry = Object.entries(modelModules).find(([key]) => key.endsWith(`/${configuredPath}`));
    if (fallbackEntry) {
      return fallbackEntry[1];
    }

    return import.meta.env.DEV ? directKey : null;
  }

  private applyModelConfig(model: THREE.Object3D, modelConfig: ModelConfig): void {
    const { scale, center, rotation } = modelConfig;
    const modelX = Number.isFinite(Number(center[0])) ? Number(center[0]) : 0;
    const modelY = center.length > 2 ? (Number.isFinite(Number(center[1])) ? Number(center[1]) : 0) : 0;
    const modelZ = center.length > 2 ? (Number.isFinite(Number(center[2])) ? Number(center[2]) : 0) : (Number.isFinite(Number(center[1])) ? Number(center[1]) : 0);
    const floorScaleRatio = Number(this.config.floor.scale);
    const scaleRatioFactor =
      modelConfig.role !== 'base-map' || !Number.isFinite(floorScaleRatio) || floorScaleRatio <= 0
        ? 1
        : DEFAULT_MODEL_SCALE_RATIO / floorScaleRatio;

    const modelScale = Number(scale);
    model.scale.setScalar((Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1) * scaleRatioFactor);
    model.rotation.set(
      THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[0])) ? Number(rotation[0]) : 0),
      THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[1])) ? Number(rotation[1]) : 0),
      THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[2])) ? Number(rotation[2]) : 0),
    );

    // Compute bounding box at origin to get true local center without position offset,
    // preventing position drift on repeated updates.
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const localCenter = box.getCenter(new THREE.Vector3());
    const minY = box.min.y;

    model.position.set(modelX - localCenter.x, modelY - minY, modelZ - localCenter.z);
  }

  private handleSceneClick(event: MouseEvent): void {
    if (!this.camera || !this.renderer) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    if (!hit) {
      return;
    }

    const offsetX = this.config.floor.origin[0] + this.config.floor.width / 2;
    const offsetY = this.config.floor.origin[1] + this.config.floor.height / 2;
    const result: PickPointResult = {
      scene: {
        x: Number(intersection.x.toFixed(2)),
        z: Number(intersection.z.toFixed(2)),
      },
      floor: {
        x: Number((intersection.x + offsetX).toFixed(2)),
        y: Number((intersection.z + offsetY).toFixed(2)),
      },
    };

    this.onPointPick?.(result);
  }

  private handleSceneDoubleClick(event: MouseEvent): void {
    if (!this.camera || !this.renderer || !this.livePoseGroup) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const deviceHit = this.raycaster
      .intersectObjects(
        [...this.livePoseMarkers.entries()]
          .filter(([deviceId]) => this.isLivePoseVisible(deviceId))
          .map(([, marker]) => marker),
        true,
      )
      .find((item) => this.getLivePoseMarkerId(item.object));
    const deviceId = this.getLivePoseMarkerId(deviceHit?.object ?? null);
    if (deviceId) {
      this.selectLivePoseMarker(deviceId);
    }
  }

  private handleSceneContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.clearLivePoseSelection();
  }

  private handleResize(): void {
    if (!this.camera || !this.renderer) {
      return;
    }

    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);
    this.controls?.update();
    this.renderer?.render(this.scene as THREE.Scene, this.camera as THREE.Camera);
  };

  destroy(): void {
    window.cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resizeHandler);
    this.renderer?.domElement.removeEventListener('click', this.clickHandler);
    this.renderer?.domElement.removeEventListener('dblclick', this.doubleClickHandler);
    this.renderer?.domElement.removeEventListener('contextmenu', this.contextMenuHandler);
    this.controls?.dispose();

    if (this.scene) {
      // Cached model templates own these shared GPU resources. Remove model
      // instances before disposing scene-local geometry and materials.
      this.modelGroups.forEach((model) => model.removeFromParent());

      this.scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else if (material) {
          material.dispose();
        }
      });
    }

    this.renderer?.dispose();
    this.renderer?.domElement.remove();

    this.floorGroup = null;
    this.modelGroups = [];
    this.overlayPlane = null;
    this.overlayMaterial = null;
    this.livePoseGroup = null;
    this.livePoseMarkers.clear();
    this.livePoseTrails.clear();
    this.livePoseSamples.clear();
    this.controls = null;
    this.renderer = null;
    this.camera = null;
    this.scene = null;
  }
}
