import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const MODEL_URL = '/models/brew-cup-cafe.glb';
const PATH_URL = '/camera_path.json';
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.24;
const WALK_SPEED = 2.2;
const RUN_SPEED = 4.0;
const FLY_SPEED = 5.0;
const MAX_STEP_HEIGHT = 0.4;
const ACCELERATION = 9;
const DAMPING = 7;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const SHADOW_CASTER_NAME = /^(?:Roof_|Wall_|Facade|Floor$|Mezz_|Step_|Door_|Column|Beam|Counter|Pillar|Window)/;

const styleText = `
  .cafe-walkthrough { position:relative; width:100%; height:100%; min-height:100svh; overflow:hidden; color:#f7f0e7; background:#17120f; font-family:"Avenir Next", "Segoe UI", sans-serif; }
  .cafe-walkthrough * { box-sizing:border-box; }
  .cafe-walkthrough canvas { display:block; width:100%; height:100%; touch-action:none; }
  .cafe-walkthrough__chrome { position:absolute; inset:0; pointer-events:none; }
  .cafe-walkthrough__top { position:absolute; top:22px; left:24px; right:24px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .cafe-walkthrough__brand { padding:12px 15px; border:1px solid #ffffff24; border-radius:14px; background:#17120fd9; box-shadow:0 10px 30px #0004; }
  .cafe-walkthrough__brand strong { display:block; font-family:Georgia,serif; font-size:17px; font-weight:500; letter-spacing:.01em; }
  .cafe-walkthrough__brand span { display:block; margin-top:4px; color:#d6c2ad; font-size:11px; letter-spacing:.12em; text-transform:uppercase; }
  .cafe-walkthrough__actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; pointer-events:auto; }
  .cafe-walkthrough button, .cafe-walkthrough select { min-height:42px; padding:0 14px; border:1px solid #ffffff35; border-radius:11px; color:#fff8f0; background:#211a16e8; font:inherit; font-size:13px; box-shadow:0 8px 22px #0003; }
  .cafe-walkthrough button { cursor:pointer; transition:background .18s ease, border-color .18s ease, transform .18s ease; }
  .cafe-walkthrough button:hover { background:#3a2b22; border-color:#d4a775; transform:translateY(-1px); }
  .cafe-walkthrough button:focus-visible, .cafe-walkthrough select:focus-visible { outline:2px solid #e8bd8e; outline-offset:3px; }
  .cafe-walkthrough__hint { position:absolute; left:50%; bottom:30px; transform:translateX(-50%); padding:12px 17px; border:1px solid #ffffff2b; border-radius:999px; color:#f3e7da; background:#17120fd9; font-size:13px; text-align:center; white-space:nowrap; transition:opacity .65s ease, transform .65s ease; }
  .cafe-walkthrough__hint.is-hidden { opacity:0; transform:translate(-50%, 8px); pointer-events:none; }
  .cafe-walkthrough__loading { position:absolute; inset:0; display:grid; place-items:center; background:#17120f; transition:opacity .4s ease; }
  .cafe-walkthrough__loading.is-hidden { opacity:0; pointer-events:none; }
  .cafe-walkthrough__loading-inner { width:min(330px, calc(100% - 48px)); text-align:center; }
  .cafe-walkthrough__loading-label { margin-bottom:12px; color:#e7d7c8; font:17px Georgia,serif; }
  .cafe-walkthrough__track { height:3px; overflow:hidden; border-radius:3px; background:#ffffff24; }
  .cafe-walkthrough__bar { width:100%; height:100%; background:#d0a171; transform:scaleX(0); transform-origin:left; transition:transform .15s ease; }
  .cafe-walkthrough__loading-note { margin-top:9px; color:#ae9b89; font-size:11px; }
  .cafe-walkthrough__error { position:absolute; inset:auto 20px 20px; padding:14px 16px; border-radius:12px; color:#ffddd2; background:#601f17ed; font-size:13px; }
  .cafe-walkthrough__joystick { position:absolute; left:24px; bottom:24px; width:116px; height:116px; border:1px solid #ffffff46; border-radius:50%; background:#211a1685; touch-action:none; pointer-events:auto; display:none; }
  .cafe-walkthrough__stick { position:absolute; left:50%; top:50%; width:48px; height:48px; border-radius:50%; background:#d4a775dd; transform:translate(-50%,-50%); box-shadow:0 4px 16px #0006; }
  .cafe-walkthrough__flight-controls { position:absolute; right:20px; bottom:24px; display:flex; gap:8px; pointer-events:auto; }
  .cafe-walkthrough__flight-controls[hidden] { display:none; }
  @media (pointer:coarse) { .cafe-walkthrough__joystick { display:block; } .cafe-walkthrough__hint { bottom:154px; white-space:normal; width:max-content; max-width:calc(100% - 36px); } }
  @media (max-width:760px) { .cafe-walkthrough__top { top:12px; left:12px; right:12px; align-items:flex-start; } .cafe-walkthrough__brand { padding:9px 11px; } .cafe-walkthrough__brand strong { font-size:15px; } .cafe-walkthrough__actions { max-width:72%; gap:6px; } .cafe-walkthrough button, .cafe-walkthrough select { min-height:38px; padding:0 10px; font-size:12px; } .cafe-walkthrough__joystick { left:15px; bottom:17px; width:104px; height:104px; } .cafe-walkthrough__flight-controls { right:15px; bottom:18px; flex-direction:column; } }
  @media (prefers-reduced-motion: reduce) { .cafe-walkthrough *, .cafe-walkthrough *::before, .cafe-walkthrough *::after { transition-duration:.01ms !important; scroll-behavior:auto !important; } }
`;

function readTourPath(data) {
  if (!Array.isArray(data?.keys) || data.keys.length < 5) return { stops: [], outsideStart: null, entranceOutside: null, entranceInside: null };
  const keys = data.keys.map((key, pathIndex) => ({ ...key, pathIndex })).filter((key) => Array.isArray(key.position) && key.position.length === 3 && key.position.every(Number.isFinite)
    && Array.isArray(key.target) && key.target.length === 3 && key.target.every(Number.isFinite));
  if (keys.length < 5) return { stops: [], outsideStart: null, entranceOutside: null, entranceInside: null };
  const selections = [
    ['Entrance', 2], ['Counter', 3], ['Mezzanine', 4], ['Mural seating', 5], ['Pool', data.keys.length - 1],
  ];
  if (selections.some(([, pathIndex]) => !keys.some((key) => key.pathIndex === pathIndex))) {
    return { stops: [], outsideStart: null, entranceOutside: null, entranceInside: null };
  }
  return {
    stops: selections.map(([label, pathIndex]) => ({ label, ...keys.find((key) => key.pathIndex === pathIndex) })),
    outsideStart: keys.find((key) => key.pathIndex === 0) ?? null,
    entranceOutside: keys.find((key) => key.pathIndex === 2) ?? null,
    entranceInside: keys.find((key) => key.pathIndex === 3) ?? null,
  };
}

async function fetchTourPath() {
  try {
    const response = await fetch(PATH_URL);
    if (!response.ok) return { stops: [], outsideStart: null, entranceOutside: null, entranceInside: null };
    return readTourPath(await response.json());
  } catch {
    return { stops: [], outsideStart: null, entranceOutside: null, entranceInside: null };
  }
}

export function mountCafeWalkthrough(containerElement) {
  if (!(containerElement instanceof HTMLElement)) throw new TypeError('A container element is required.');
  const root = document.createElement('section');
  root.className = 'cafe-walkthrough';
  root.innerHTML = `
    <div class="cafe-walkthrough__chrome">
      <div class="cafe-walkthrough__top">
        <div class="cafe-walkthrough__brand"><strong>Brew Cup Café</strong><span>Walk in · Look around</span></div>
        <div class="cafe-walkthrough__actions">
          <select class="cafe-walkthrough__spots" aria-label="Choose a tour stop"><option value="">Explore the café</option></select>
          <button class="cafe-walkthrough__tour" type="button">Take the tour</button>
          <button class="cafe-walkthrough__stop" type="button" hidden>Stop / Explore</button>
          <button class="cafe-walkthrough__inside" type="button">Go inside</button>
          <button class="cafe-walkthrough__outside" type="button">Go outside</button>
          <button class="cafe-walkthrough__fly" type="button" aria-pressed="false">Fly mode</button>
          <button class="cafe-walkthrough__reset" type="button">Reset view</button>
        </div>
      </div>
      <div class="cafe-walkthrough__hint">W A S D or arrows to walk · drag to look · Shift to run · F fly (Space / Ctrl rise or lower)</div>
      <div class="cafe-walkthrough__joystick" aria-label="Walk joystick"><div class="cafe-walkthrough__stick"></div></div>
      <div class="cafe-walkthrough__flight-controls" hidden>
        <button class="cafe-walkthrough__rise" type="button">Rise</button>
        <button class="cafe-walkthrough__lower" type="button">Lower</button>
      </div>
    </div>
    <div class="cafe-walkthrough__loading" role="status" aria-live="polite"><div class="cafe-walkthrough__loading-inner"><div class="cafe-walkthrough__loading-label">Opening the café…</div><div class="cafe-walkthrough__track"><div class="cafe-walkthrough__bar"></div></div><div class="cafe-walkthrough__loading-note">Preparing the interior</div></div></div>
  `;
  const inlineStyle = document.createElement('style');
  inlineStyle.textContent = styleText;
  containerElement.append(inlineStyle, root);

  const canvasHost = document.createElement('div');
  canvasHost.style.position = 'absolute';
  canvasHost.style.inset = '0';
  root.prepend(canvasHost);
  const loading = root.querySelector('.cafe-walkthrough__loading');
  const loadingBar = root.querySelector('.cafe-walkthrough__bar');
  const loadingNote = root.querySelector('.cafe-walkthrough__loading-note');
  const hint = root.querySelector('.cafe-walkthrough__hint');
  const spots = root.querySelector('.cafe-walkthrough__spots');
  const tourButton = root.querySelector('.cafe-walkthrough__tour');
  const stopButton = root.querySelector('.cafe-walkthrough__stop');
  const insideButton = root.querySelector('.cafe-walkthrough__inside');
  const outsideButton = root.querySelector('.cafe-walkthrough__outside');
  const flyButton = root.querySelector('.cafe-walkthrough__fly');
  const resetButton = root.querySelector('.cafe-walkthrough__reset');
  const joystick = root.querySelector('.cafe-walkthrough__joystick');
  const stick = root.querySelector('.cafe-walkthrough__stick');
  const flightControls = root.querySelector('.cafe-walkthrough__flight-controls');
  const riseButton = root.querySelector('.cafe-walkthrough__rise');
  const lowerButton = root.querySelector('.cafe-walkthrough__lower');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd3dd);
  scene.fog = new THREE.Fog(0xbfd3dd, 100, 320);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 160);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.65;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  canvasHost.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffead5, 0x38291e, 0.5));
  const sky = new Sky();
  sky.scale.setScalar(600);
  sky.frustumCulled = false;
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 5.5;
  skyUniforms.rayleigh.value = 2.1;
  skyUniforms.mieCoefficient.value = 0.004;
  skyUniforms.mieDirectionalG.value = 0.82;
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(0));
  skyUniforms.sunPosition.value.copy(sunPosition);
  scene.add(sky);

  const environmentSky = sky.clone();
  environmentSky.material = sky.material.clone();
  environmentSky.scale.setScalar(1);
  const environmentScene = new THREE.Scene();
  environmentScene.add(environmentSky);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = pmremGenerator.fromScene(environmentScene).texture;
  scene.environment = environmentTexture;
  scene.environmentIntensity = 0.18;
  pmremGenerator.dispose();
  environmentSky.material.dispose();

  const sun = new THREE.DirectionalLight(0xfff0d5, 0.8);
  sun.position.copy(sunPosition).multiplyScalar(70);
  sun.target.position.set(0, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.00025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const loader = new GLTFLoader();
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const down = new THREE.Vector3(0, -1, 0);
  const meshes = [];
  const velocity = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const player = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const safetyBounds = new THREE.Box3();
  const keys = new Set();
  const lookTarget = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const tourPoints = [];
  const mergedVisuals = [];
  const runtimeVisuals = [];
  const runtimeMaterials = [];
  let loaded = false;
  let disposed = false;
  let isTouring = false;
  let tourStart = null;
  let tourElapsed = 0;
  let tourIndex = 0;
  let yaw = 0;
  let pitch = 0;
  let dragPointer = null;
  let joystickPointer = null;
  let joystickValue = { x: 0, y: 0 };
  let floorY = 0;
  let initialPosition = null;
  let entranceInside = null;
  let entranceOutside = null;
  let groundPlane = null;
  let flyMode = false;
  let frameId = 0;
  let previousFrame = performance.now();

  function floorAt(x, z, fromY = bounds.max.y + 1) {
    raycaster.set(new THREE.Vector3(x, fromY, z), down);
    raycaster.far = Math.max(1, fromY - bounds.min.y + 1);
    const hits = raycaster.intersectObjects(meshes, false);
    const hit = hits.find((entry) => {
      if (entry.object.userData.walkable === false) return false;
      const normal = entry.face?.normal?.clone();
      if (!normal) return false;
      normal.transformDirection(entry.object.matrixWorld);
      return normal.y > 0.52;
    });
    return hit?.point.y ?? null;
  }

  function wallAhead(origin, direction, distance, heightOffset) {
    rayDirection.copy(direction).setY(0).normalize();
    const side = new THREE.Vector3(-rayDirection.z, 0, rayDirection.x).multiplyScalar(PLAYER_RADIUS * 0.82);
    return [0, -1, 1].some((offset) => {
      const rayOrigin = origin.clone();
      rayOrigin.y += heightOffset;
      rayOrigin.addScaledVector(side, offset);
      raycaster.set(rayOrigin, rayDirection);
      raycaster.far = distance;
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return Boolean(hit && hit.distance < distance);
    });
  }

  function hasCeilingClearance(x, z, baseY) {
    raycaster.set(new THREE.Vector3(x, baseY + EYE_HEIGHT * 0.82, z), new THREE.Vector3(0, 1, 0));
    raycaster.far = EYE_HEIGHT * 0.34;
    return raycaster.intersectObjects(meshes, false).length === 0;
  }

  function blockedAbove(position, distance) {
    const direction = new THREE.Vector3(0, 1, 0);
    return [0.08, 0.95, 1.55].some((height) => {
      raycaster.set(new THREE.Vector3(position.x, position.y + height, position.z), direction);
      raycaster.far = distance + PLAYER_RADIUS;
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return Boolean(hit && hit.distance < distance + PLAYER_RADIUS);
    });
  }

  function addMercedes(roadY) {
    const car = new THREE.Group();
    car.name = 'Walkthrough_Mercedes_Sedan';
    car.position.set(7.1, roadY, 7.2);

    const paint = new THREE.MeshStandardMaterial({ color: 0x87949b, metalness: 0.82, roughness: 0.24 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x17252c, metalness: 0.35, roughness: 0.16 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.88 });
    const alloy = new THREE.MeshStandardMaterial({ color: 0xb9c0c2, metalness: 0.9, roughness: 0.2 });
    const grille = new THREE.MeshStandardMaterial({ color: 0x101416, metalness: 0.45, roughness: 0.3 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0x57452b, roughness: 0.2 });
    const tailLamp = new THREE.MeshStandardMaterial({ color: 0x8c1715, emissive: 0x390706, roughness: 0.3 });
    runtimeMaterials.push(paint, glass, rubber, alloy, grille, lamp, tailLamp);

    const addPart = (geometry, material, position, castShadow = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      car.add(mesh);
      return mesh;
    };
    const extrudedProfile = (points, depth, material, zOffset) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035 });
      geometry.translate(0, 0, zOffset);
      addPart(geometry, material, [0, 0, 0]);
    };

    extrudedProfile([[-2.18, 0.38], [-2.1, 0.79], [-1.76, 0.93], [1.55, 0.93], [2.1, 0.75], [2.17, 0.4]], 1.72, paint, -0.86);
    extrudedProfile([[-1.28, 0.9], [-0.79, 1.52], [0.71, 1.52], [1.34, 0.9]], 1.36, paint, -0.68);
    extrudedProfile([[-1.12, 0.99], [-0.68, 1.42], [-0.04, 1.42], [-0.04, 1.0]], 1.385, glass, -0.6925);
    extrudedProfile([[0.05, 1.0], [0.05, 1.42], [0.62, 1.42], [1.12, 0.99]], 1.385, glass, -0.6925);

    for (const x of [-1.35, 1.35]) {
      const tire = addPart(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 24), rubber, [x, 0.35, -0.89]);
      tire.rotation.x = Math.PI / 2;
      const farTire = tire.clone();
      farTire.position.z = 0.89;
      car.add(farTire);
      for (const z of [-1, 1]) {
        const hub = addPart(new THREE.CylinderGeometry(0.2, 0.2, 0.235, 16), alloy, [x, 0.35, z * 0.89], false);
        hub.rotation.x = Math.PI / 2;
      }
    }

    addPart(new THREE.BoxGeometry(0.1, 0.34, 0.9), grille, [2.12, 0.68, 0]);
    for (const z of [-0.59, 0.59]) {
      addPart(new THREE.BoxGeometry(0.09, 0.2, 0.38), lamp, [2.13, 0.78, z]);
      addPart(new THREE.BoxGeometry(0.08, 0.17, 0.32), tailLamp, [-2.12, 0.76, z]);
    }
    const emblemRing = addPart(new THREE.TorusGeometry(0.13, 0.014, 8, 24), alloy, [2.19, 0.76, 0]);
    emblemRing.rotation.y = Math.PI / 2;
    const starCenter = new THREE.Vector3(2.205, 0.76, 0);
    const starPoints = [
      new THREE.Vector3(0, 0.105, 0), new THREE.Vector3(0, -0.052, 0.091),
      new THREE.Vector3(0, -0.052, -0.091),
    ];
    for (const end of starPoints) {
      const from = starCenter;
      const to = new THREE.Vector3(starCenter.x, starCenter.y + end.y, end.z);
      const direction = to.clone().sub(from);
      const spoke = addPart(new THREE.CylinderGeometry(0.009, 0.009, direction.length(), 6), alloy,
        from.clone().add(to).multiplyScalar(0.5).toArray(), false);
      spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }

    const collider = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 1.58, 1.95),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    collider.name = 'Walkthrough_Mercedes_Collider';
    collider.position.set(0, 0.79, 0);
    collider.userData.walkable = false;
    collider.frustumCulled = true;
    collider.geometry.computeBoundsTree({ targetLeafSize: 8 });
    car.add(collider);
    runtimeMaterials.push(collider.material);
    car.children.filter((part) => part !== collider).forEach((part) => runtimeVisuals.push(part));
    scene.add(car);
    meshes.push(collider);
  }

  function mergeStaticMeshes(model) {
    const batches = new Map();
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.frustumCulled = true;
      object.castShadow = SHADOW_CASTER_NAME.test(object.name);
      object.receiveShadow = true;

      const material = object.material;
      const geometry = object.geometry;
      if (object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(material) || material.transparent
        || material.opacity < 1 || geometry.groups.length || Object.keys(geometry.morphAttributes).length) {
        if (!geometry.boundsTree) geometry.computeBoundsTree({ targetLeafSize: 12 });
        meshes.push(object);
        return;
      }
      const attributes = Object.entries(geometry.attributes)
        .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`)
        .sort().join('|');
      const key = `${material.uuid}:${Boolean(geometry.index)}:${attributes}`;
      const worldGeometry = geometry.clone();
      worldGeometry.applyMatrix4(object.matrixWorld);
      const batch = batches.get(key) ?? { material, objects: [], geometries: [] };
      batch.objects.push(object);
      batch.geometries.push(worldGeometry);
      batches.set(key, batch);
    });

    for (const batch of batches.values()) {
      let geometry;
      try {
        geometry = mergeGeometries(batch.geometries, false);
      } catch (error) {
        console.warn('Could not merge a café mesh batch; keeping its source meshes.', error);
      }
      if (!geometry) {
        batch.geometries.forEach((item) => item.dispose());
        for (const object of batch.objects) {
          if (!object.geometry.boundsTree) object.geometry.computeBoundsTree({ targetLeafSize: 12 });
          meshes.push(object);
        }
        continue;
      }
      geometry.computeBoundingSphere();
      const visual = new THREE.Mesh(geometry, batch.material);
      geometry.computeBoundsTree({ targetLeafSize: 12 });
      visual.frustumCulled = true;
      visual.castShadow = batch.objects.some((object) => object.castShadow);
      visual.receiveShadow = true;
      scene.add(visual);
      mergedVisuals.push(visual);
      meshes.push(visual);
      for (const object of batch.objects) {
        const worldMatrix = object.matrixWorld.clone();
        const colliderIndex = meshes.indexOf(object);
        if (colliderIndex !== -1) meshes.splice(colliderIndex, 1);
        object.removeFromParent();
        object.matrix.copy(worldMatrix);
        object.matrixAutoUpdate = false;
        object.updateMatrixWorld(true);
        if (object.geometry.boundsTree) object.geometry.disposeBoundsTree();
        object.geometry.dispose();
      }
      batch.geometries.forEach((item) => item.dispose());
    }
  }

  function addExtendedGround(groundY) {
    const center = safetyBounds.getCenter(new THREE.Vector3());
    const size = safetyBounds.getSize(new THREE.Vector3());
    const geometry = new THREE.PlaneGeometry(size.x, size.z);
    geometry.computeBoundsTree({ targetLeafSize: 12 });
    const material = new THREE.MeshStandardMaterial({ color: 0x72806d, roughness: 0.96 });
    groundPlane = new THREE.Mesh(geometry, material);
    groundPlane.name = 'Walkthrough_Extended_Ground';
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(center.x, groundY, center.z);
    groundPlane.receiveShadow = true;
    groundPlane.frustumCulled = true;
    scene.add(groundPlane);
    meshes.push(groundPlane);
  }

  function setCameraLook() {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function placePlayer(position, target = null) {
    const y = floorAt(position.x, position.z, Math.min(bounds.max.y + 1, position.y + 2));
    player.set(position.x, y ?? position.y - EYE_HEIGHT, position.z);
    floorY = player.y;
    camera.position.set(player.x, floorY + EYE_HEIGHT, player.z);
    if (target) {
      lookTarget.copy(target).sub(camera.position);
      yaw = Math.atan2(-lookTarget.x, -lookTarget.z);
      pitch = Math.atan2(lookTarget.y, Math.hypot(lookTarget.x, lookTarget.z));
    }
    setCameraLook();
  }

  function showHintOnce() {
    hint.classList.add('is-hidden');
  }

  function stopTour() {
    isTouring = false;
    tourStart = null;
    stopButton.hidden = true;
    tourButton.hidden = false;
  }

  function setFlyMode(enabled) {
    if (flyMode === enabled) return;
    flyMode = enabled;
    flyButton.setAttribute('aria-pressed', String(flyMode));
    flyButton.textContent = flyMode ? 'Fly mode: on' : 'Fly mode';
    flightControls.hidden = !flyMode;
    velocity.set(0, 0, 0);
    if (!flyMode) {
      const surface = floorAt(player.x, player.z, player.y + MAX_STEP_HEIGHT + 0.5);
      if (surface !== null) {
        player.y = surface;
        floorY = surface;
        camera.position.y = surface + EYE_HEIGHT;
      }
    }
  }

  function cameraPointOnSurface(point) {
    const position = [...point.position];
    const surface = floorAt(position[0], position[2], position[1] + 2);
    if (surface !== null) position[1] = surface + EYE_HEIGHT;
    return { ...point, position };
  }

  function travelToEntrance(point) {
    if (!point) return;
    stopTour();
    if (flyMode) setFlyMode(false);
    velocity.set(0, 0, 0);
    glideTo(cameraPointOnSurface(point), 1.5);
  }

  function glideTo(point, duration = 1.5) {
    if (REDUCED_MOTION.matches) {
      placePlayer(new THREE.Vector3(...point.position), new THREE.Vector3(...point.target));
      stopTour();
      return;
    }
    tourStart = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      targetQuaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(
        new THREE.Vector3(...point.position), new THREE.Vector3(...point.target), new THREE.Vector3(0, 1, 0),
      )),
      destination: new THREE.Vector3(...point.position),
      target: new THREE.Vector3(...point.target),
      duration,
      elapsed: 0,
    };
    isTouring = true;
    tourElapsed = 0;
  }

  function advanceTour(delta) {
    if (!isTouring || !tourStart) return;
    tourStart.elapsed += delta;
    const progress = Math.min(1, tourStart.elapsed / tourStart.duration);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(tourStart.position, tourStart.destination, eased);
    camera.quaternion.slerpQuaternions(tourStart.quaternion, tourStart.targetQuaternion, eased);
    if (progress === 1) {
      player.set(camera.position.x, camera.position.y - EYE_HEIGHT, camera.position.z);
      floorY = player.y;
      yaw = camera.rotation.y;
      pitch = camera.rotation.x;
      tourStart = null;
      if (tourPoints.length > 1 && tourElapsed >= 0) {
        tourIndex += 1;
        if (tourIndex < tourPoints.length) {
          tourElapsed = -1.4;
        } else stopTour();
      } else stopTour();
    }
  }

  function stepTour(delta) {
    if (!isTouring || !tourStart) {
      if (isTouring && tourElapsed < 0) {
        tourElapsed += delta;
        if (tourElapsed >= 0) glideTo(tourPoints[tourIndex], 1.5);
      }
      return;
    }
    tourElapsed += delta;
    advanceTour(delta);
  }

  function movePlayer(delta) {
    if (!loaded || isTouring) return;
    const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
      - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joystickValue.y;
    const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
      - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystickValue.x;
    const turn = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
    yaw += turn * delta * 1.7;
    setCameraLook();
    const vertical = (keys.has('Space') ? 1 : 0) - (keys.has('ControlLeft') || keys.has('ControlRight') ? 1 : 0);
    desired.set(Math.sin(yaw) * forward + Math.cos(yaw) * strafe, flyMode ? vertical : 0,
      -Math.cos(yaw) * forward + Math.sin(yaw) * strafe);
    if (desired.lengthSq() > 1) desired.normalize();
    const speed = flyMode ? FLY_SPEED : (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED);
    desired.multiplyScalar(speed);
    const factor = 1 - Math.exp(-(desired.lengthSq() > 0 ? ACCELERATION : DAMPING) * delta);
    velocity.lerp(desired, factor);
    const displacement = velocity.clone().multiplyScalar(delta);
    if (displacement.lengthSq() < 1e-7) {
      return;
    }

    const candidate = player.clone();
    const axes = [new THREE.Vector3(displacement.x, 0, 0), new THREE.Vector3(0, 0, displacement.z)];
    for (const axis of axes) {
      const length = axis.length();
      if (!length) continue;
      const direction = axis.clone().normalize();
      const next = candidate.clone().add(axis);
      let nextFloor = candidate.y;
      if (!flyMode) {
        nextFloor = floorAt(next.x, next.z, candidate.y + MAX_STEP_HEIGHT + 0.5);
        if (nextFloor === null || nextFloor < candidate.y - MAX_STEP_HEIGHT || nextFloor > candidate.y + MAX_STEP_HEIGHT) {
          continue;
        }
      }
      const steppingUp = !flyMode && nextFloor > candidate.y + 0.05;
      const stepProbeDistance = length + PLAYER_RADIUS + MAX_STEP_HEIGHT + 0.05;
      const stepAheadFloor = flyMode ? null : floorAt(
        candidate.x + direction.x * stepProbeDistance,
        candidate.z + direction.z * stepProbeDistance,
        candidate.y + MAX_STEP_HEIGHT + 0.5,
      );
      const smallStepAhead = stepAheadFloor !== null
        && stepAheadFloor > candidate.y + 0.05
        && stepAheadFloor <= candidate.y + MAX_STEP_HEIGHT;
      const lowerBlocked = !steppingUp && !smallStepAhead && wallAhead(candidate, direction, length + PLAYER_RADIUS, 0.08);
      const bodyBlocked = wallAhead(candidate, direction, length + PLAYER_RADIUS, 0.95);
      const headBlocked = wallAhead(candidate, direction, length + PLAYER_RADIUS, 1.55);
      if (lowerBlocked || bodyBlocked || headBlocked) {
        continue;
      }
      if (!flyMode && !hasCeilingClearance(next.x, next.z, nextFloor)) {
        continue;
      }
      if (next.x < safetyBounds.min.x + PLAYER_RADIUS || next.x > safetyBounds.max.x - PLAYER_RADIUS
        || next.z < safetyBounds.min.z + PLAYER_RADIUS || next.z > safetyBounds.max.z - PLAYER_RADIUS) {
        continue;
      }
      candidate.x = next.x;
      candidate.z = next.z;
      candidate.y = nextFloor;
    }
    if (flyMode && displacement.y !== 0) {
      const verticalStep = Math.abs(displacement.y);
      if (displacement.y > 0 && !blockedAbove(candidate, verticalStep)) {
        candidate.y = Math.min(candidate.y + displacement.y, safetyBounds.max.y - EYE_HEIGHT);
      } else if (displacement.y < 0) {
        const proposedY = Math.max(candidate.y + displacement.y, safetyBounds.min.y);
        const floor = floorAt(candidate.x, candidate.z, proposedY + MAX_STEP_HEIGHT);
        candidate.y = floor !== null && floor > proposedY ? floor : proposedY;
      }
    }
    player.copy(candidate);
    floorY = candidate.y;
    camera.position.set(player.x, floorY + EYE_HEIGHT, player.z);
  }

  function resize() {
    const width = Math.max(1, canvasHost.clientWidth);
    const height = Math.max(1, canvasHost.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function render() {
    if (disposed) return;
    frameId = window.requestAnimationFrame(render);
    const now = performance.now();
    const delta = Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;
    if (loaded) {
      stepTour(delta);
      movePlayer(delta);
    }
    renderer.render(scene, camera);
  }

  function onKeyDown(event) {
    if (event.target instanceof HTMLElement && event.target.closest('button, select, input, textarea')) return;
    if (event.code === 'KeyF') {
      event.preventDefault();
      if (!event.repeat) setFlyMode(!flyMode);
      showHintOnce();
      return;
    }
    const handled = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft', 'ControlRight'];
    if (!handled.includes(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    if (isTouring) stopTour();
    if (!event.code.startsWith('Shift')) showHintOnce();
  }

  function onKeyUp(event) { keys.delete(event.code); }
  function onPointerDown(event) {
    if (event.target.closest('button, select, .cafe-walkthrough__joystick')) return;
    dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    root.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    if (!dragPointer || dragPointer.id !== event.pointerId || isTouring) return;
    const dx = event.clientX - dragPointer.x;
    const dy = event.clientY - dragPointer.y;
    dragPointer.x = event.clientX;
    dragPointer.y = event.clientY;
    yaw -= dx * 0.003;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0025, -1.35, 1.35);
    setCameraLook();
    showHintOnce();
  }
  function onPointerUp(event) {
    if (dragPointer?.id === event.pointerId) dragPointer = null;
  }
  function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const magnitude = Math.min(1, Math.hypot(dx, dy) / radius);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * magnitude;
    const y = Math.sin(angle) * magnitude;
    joystickValue = { x, y };
    stick.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
  }
  function onJoystickDown(event) {
    event.preventDefault();
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
    showHintOnce();
  }
  function onJoystickMove(event) {
    if (joystickPointer === event.pointerId) updateJoystick(event);
  }
  function onJoystickUp(event) {
    if (joystickPointer !== event.pointerId) return;
    joystickPointer = null;
    joystickValue = { x: 0, y: 0 };
    stick.style.transform = 'translate(-50%,-50%)';
  }
  function onReset() {
    stopTour();
    setFlyMode(false);
    if (initialPosition) placePlayer(initialPosition, initialLookTarget);
    velocity.set(0, 0, 0);
  }

  function onWindowBlur() {
    keys.clear();
    joystickValue = { x: 0, y: 0 };
    velocity.set(0, 0, 0);
    stick.style.transform = 'translate(-50%,-50%)';
  }

  function holdFlightKey(event, code) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!flyMode) setFlyMode(true);
    keys.add(code);
  }

  function releaseFlightKey(code) { keys.delete(code); }

  let initialLookTarget = new THREE.Vector3();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  joystick.addEventListener('pointerdown', onJoystickDown);
  joystick.addEventListener('pointermove', onJoystickMove);
  joystick.addEventListener('pointerup', onJoystickUp);
  joystick.addEventListener('pointercancel', onJoystickUp);
  window.addEventListener('resize', resize);
  resetButton.addEventListener('click', onReset);
  flyButton.addEventListener('click', () => setFlyMode(!flyMode));
  insideButton.addEventListener('click', () => travelToEntrance(entranceInside));
  outsideButton.addEventListener('click', () => travelToEntrance(entranceOutside));
  stopButton.addEventListener('click', stopTour);
  riseButton.addEventListener('pointerdown', (event) => holdFlightKey(event, 'Space'));
  riseButton.addEventListener('pointerup', () => releaseFlightKey('Space'));
  riseButton.addEventListener('pointercancel', () => releaseFlightKey('Space'));
  lowerButton.addEventListener('pointerdown', (event) => holdFlightKey(event, 'ControlLeft'));
  lowerButton.addEventListener('pointerup', () => releaseFlightKey('ControlLeft'));
  lowerButton.addEventListener('pointercancel', () => releaseFlightKey('ControlLeft'));
  spots.addEventListener('change', () => {
    const point = tourPoints[Number(spots.value)];
    if (!point) return;
    stopTour();
    glideTo(point, 1.5);
  });
  tourButton.addEventListener('click', () => {
    if (!tourPoints.length) return;
    tourIndex = 0;
    tourElapsed = 0;
    tourButton.hidden = true;
    stopButton.hidden = false;
    glideTo(tourPoints[0], 1.5);
  });

  const tourPromise = fetchTourPath();
  loader.load(MODEL_URL, async (gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    scene.add(model);
    model.updateMatrixWorld(true);
    bounds.setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const safetyHalfSize = size.clone().multiplyScalar(1.5);
    safetyBounds.set(center.clone().sub(safetyHalfSize), center.clone().add(safetyHalfSize));
    const door = model.getObjectByName('Front_DoorHead');
    const doorBounds = door ? new THREE.Box3().setFromObject(door) : null;
    const terrain = model.getObjectByName('Ground_Grass');
    const terrainBounds = terrain ? new THREE.Box3().setFromObject(terrain) : bounds;
    const groundY = terrain ? terrainBounds.min.y - 0.015 : bounds.min.y - 0.05;
    const road = model.getObjectByName('Road');
    const roadBounds = road ? new THREE.Box3().setFromObject(road) : bounds;
    model.traverse((object) => {
      if (object.isLight) object.intensity *= 0.003;
    });
    mergeStaticMeshes(model);
    addExtendedGround(groundY);
    addMercedes(roadBounds.max.y);
    const safetySize = safetyBounds.getSize(new THREE.Vector3());
    loadingNote.textContent = `Free roam ${safetySize.x.toFixed(0)} × ${safetySize.z.toFixed(0)} m · café scene ${size.x.toFixed(0)} × ${size.y.toFixed(1)} × ${size.z.toFixed(0)} m`;
    camera.far = Math.max(1000, size.length() * 3);
    camera.updateProjectionMatrix();
    const route = await tourPromise;
    route.stops.forEach((point, index) => {
      tourPoints.push(point);
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = point.label;
      spots.append(option);
    });
    const doorX = doorBounds?.getCenter(new THREE.Vector3()).x ?? 0;
    const thresholdZ = doorBounds?.max.z ?? 0;
    const fallbackOutside = {
      position: [doorX, 1.8, thresholdZ + 14],
      target: [doorX, 2.6, thresholdZ],
    };
    entranceOutside = route.entranceOutside ?? {
      position: [doorX, 1.55, thresholdZ + 1.5],
      target: [doorX, 1.6, thresholdZ - 3],
    };
    entranceInside = route.entranceInside ?? {
      position: [doorX, 1.5, thresholdZ - 0.8],
      target: [doorX, 1.4, thresholdZ - 4.2],
    };
    const startKey = route.outsideStart ?? fallbackOutside;
    insideButton.disabled = false;
    outsideButton.disabled = false;
    spots.disabled = tourPoints.length === 0;
    tourButton.disabled = tourPoints.length === 0 || REDUCED_MOTION.matches;
    if (REDUCED_MOTION.matches) tourButton.title = 'Automatic tours are off because reduced motion is enabled.';
    if (tourPoints.length === 0) {
      tourButton.title = 'No usable camera path was found.';
      tourButton.hidden = true;
      spots.hidden = true;
    }
    const start = new THREE.Vector3(...startKey.position);
    initialPosition = start.clone();
    initialLookTarget = startKey ? new THREE.Vector3(...startKey.target) : new THREE.Vector3(start.x, start.y, bounds.min.z);
    placePlayer(start, initialLookTarget);
    camera.near = 0.05;
    camera.fov = 70;
    camera.updateProjectionMatrix();
    loaded = true;
    loading.classList.add('is-hidden');
    resize();
  }, (progress) => {
    if (progress.total > 0) loadingBar.style.transform = `scaleX(${progress.loaded / progress.total})`;
  }, (error) => {
    loadingNote.textContent = 'The café interior could not be loaded.';
    const message = document.createElement('div');
    message.className = 'cafe-walkthrough__error';
    message.setAttribute('role', 'alert');
    message.textContent = `Could not load ${MODEL_URL}. Check that the model is in frontend/public/models/.`;
    root.append(message);
    console.error('Cafe walkthrough model failed to load', error);
  });
  resize();
  render();

  return () => {
    disposed = true;
    window.cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onWindowBlur);
    resetButton.removeEventListener('click', onReset);
    renderer.setAnimationLoop(null);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', onPointerUp);
    joystick.removeEventListener('pointerdown', onJoystickDown);
    joystick.removeEventListener('pointermove', onJoystickMove);
    joystick.removeEventListener('pointerup', onJoystickUp);
    joystick.removeEventListener('pointercancel', onJoystickUp);
    for (const object of meshes) {
      if (object.geometry.boundsTree) object.geometry.disposeBoundsTree();
      object.geometry.dispose();
    }
    runtimeVisuals.forEach((object) => object.geometry.dispose());
    runtimeMaterials.forEach((material) => material.dispose());
    environmentTexture.dispose();
    sky.material.dispose();
    renderer.dispose();
    root.remove();
    inlineStyle.remove();
  };
}
