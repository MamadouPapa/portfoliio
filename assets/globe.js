/**
 * Hero globe: dotted WebGL sphere tracing Kénitra · Rabat -> Nice -> Paris.
 *
 * Contract: <div class="globe" id="globe" aria-hidden="true"></div>
 *  - Three.js is imported lazily (dynamic import), so the page never waits for it.
 *  - Adds "globe-off" (+ data-globe="<reason>") when disabled: no WebGL, viewport < 900px,
 *    prefers-reduced-motion, load error or context loss. Nothing is rendered in that case.
 *  - Adds "globe-ready" after the first frame (globe.css fades the canvas in).
 *  - Dispatch `new Event('globe:dispose')` on the mount to tear everything down.
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const MOUNT_ID = 'globe';
const MIN_VIEWPORT_PX = 900;
const MAX_DPR = 2;
const MAX_FRAME_DT = 0.05;
const DEG = Math.PI / 180;

const PALETTE = {
  body: '#0A1122',
  dotDim: '#4A5571',
  dot: '#8994AB',
  accent: '#89A2FF',
  violet: '#B48CFF',
  warm: '#F2B33D',
  ink: '#E9EEF7',
};

const GLOBE_RADIUS = 1;
const CAMERA = { fov: 30, near: 0.1, far: 40 };
const GLOBE_FILL = 0.94; // globe diameter as a share of the mount's shorter side
const VIEW = { lat: 21, lon: 0.6 }; // rest orientation: route in the upper half, arcs seen rising
const FOCUS = { lat: 42, lon: 1 }; // centre of the highlighted dot region
const LIGHT_DIR = [-0.55, 0.62, 0.56];
const INTRO = { duration: 2.8, yaw: 1.9, pitch: -0.18, reveal: 1.4 };
const SWAY = { yaw: 0.16, pitch: 0.035, speed: 0.12 };
const PARALLAX = { x: 0.32, y: 0.2, ease: 0.045 };
const DRAG = { sensitivity: 0.0055, damping: 0.9, spring: 0.018, maxPitch: 0.55 };

const DOTS = { count: 6400, size: 0.0105, sizeJitter: 0.005, brightShare: 0.3, focusInner: 4, focusOuter: 30 };
const GRATICULE = { step: 15, segments: 120 };
const ATMOSPHERE = { radius: 1.3, strength: 0.5 };
const ARC = { start: 2.3, stagger: 1.45, draw: 1.5, controlPoints: 48, segments: 160, samples: 256,
  liftBase: 0.03, liftFactor: 0.55, core: 0.0055, glow: 0.022, radial: 8 };
const PACKET = { perLeg: 2, duration: 2.4, trail: 14, trailSpan: 0.16, size: 0.065 };
const MARKER = { core: 0.026, halo: 0.11, ringInner: 0.011, ringOuter: 0.0135, ringScale: 2.6,
  ringPeriod: 2.8, ringsPerCity: 2, arrivalDecay: 3.2 };
const ORBIT = { radius: 1.3, tiltX: 1.18, tiltZ: -0.42, segments: 320, speed: 0.09, dashes: 90 };
const LABEL = { fade: 0.7, hideBelow: 0.08, showAbove: 0.3 };

const PLACES = [
  { id: 'kenitra', lat: 34.26, lon: -6.58, anchor: 'left',
    name: { fr: 'Kénitra · Rabat', en: 'Kénitra · Rabat' } },
  { id: 'nice', lat: 43.70, lon: 7.26, anchor: 'right', name: { fr: 'Nice', en: 'Nice' } },
  { id: 'paris', lat: 48.86, lon: 2.35, anchor: 'left', name: { fr: 'Paris', en: 'Paris' } },
];
const ROUTE = [
  { from: 0, to: 1, colors: ['accent', 'violet'] },
  { from: 1, to: 2, colors: ['violet', 'accent'] },
];

/* ---------- small pure helpers ---------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
const easeInOutCubic = (t) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mixRgb(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

// Deterministic PRNG so every load looks the same.
function createRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function latLonToVec3(THREE, lat, lon, radius = GLOBE_RADIUS) {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(lambda) * radius,
    Math.sin(phi) * radius,
    Math.cos(phi) * Math.cos(lambda) * radius,
  );
}

function slerpUnit(THREE, a, b, t) {
  const omega = a.angleTo(b);
  const s = Math.sin(omega);
  if (s < 1e-6) return a.clone();
  return new THREE.Vector3()
    .addScaledVector(a, Math.sin((1 - t) * omega) / s)
    .addScaledVector(b, Math.sin(t * omega) / s);
}

function readLang() {
  return (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

function formatCoords(place, lang) {
  const sep = lang === 'fr' ? ',' : '.';
  const fmt = (v) => Math.abs(v).toFixed(2).replace('.', sep);
  const ns = place.lat >= 0 ? 'N' : 'S';
  const west = lang === 'fr' ? 'O' : 'W';
  const ew = place.lon >= 0 ? 'E' : west;
  return `${fmt(place.lat)}°${ns} ${fmt(place.lon)}°${ew}`;
}

/* ---------- capability checks ---------- */

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function getDisabledReason() {
  if (window.innerWidth < MIN_VIEWPORT_PX) return 'small-screen';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced-motion';
  if (!hasWebGL()) return 'no-webgl';
  return null;
}

function markOff(mount, reason) {
  mount.classList.remove('globe-ready');
  mount.classList.add('globe-off');
  mount.dataset.globe = reason;
}

/* ---------- shaders ---------- */

const GLSL_FACING = /* glsl */ `
float facingOf(vec3 worldPos) {
  return dot(normalize(worldPos), normalize(cameraPosition - worldPos));
}`;

// 1 when visible, ~0.1 when the point sits behind the globe's silhouette.
const GLSL_OCCLUSION = /* glsl */ `
uniform float uSilhouette;
float occlusionOf(vec4 mv) {
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float behind = 1.0 - smoothstep(c.z - 0.06, c.z + 0.06, mv.z);
  float r = length(mv.xy / -mv.z - c.xy / -c.z);
  float inside = 1.0 - smoothstep(uSilhouette * 0.96, uSilhouette * 1.02, r);
  return 1.0 - behind * inside * 0.9;
}`;

const DOTS_VERTEX = /* glsl */ `
uniform float uScale;
uniform float uTime;
uniform float uReveal;
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
varying vec3 vColor;
varying float vAlpha;
${GLSL_FACING}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float f = facingOf(world.xyz);
  float front = smoothstep(-0.12, 0.3, f);
  float twinkle = 0.82 + 0.18 * sin(uTime * 1.1 + aPhase);
  vAlpha = mix(0.07, 0.95, front) * twinkle * uReveal;
  vColor = aColor;
  vec4 mv = viewMatrix * world;
  gl_PointSize = aSize * uScale / -mv.z * mix(0.7, 1.0, front);
  gl_Position = projectionMatrix * mv;
}`;

const DOTS_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.18, d) * vAlpha);
}`;

const WORLD_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const GRATICULE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uReveal;
varying vec3 vWorld;
${GLSL_FACING}
void main() {
  float f = facingOf(vWorld);
  float a = mix(0.03, 0.26, smoothstep(-0.1, 0.35, f)) * uReveal;
  gl_FragColor = vec4(uColor, a);
}`;

const BODY_FRAGMENT = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uAccent;
uniform vec3 uLight;
uniform float uReveal;
varying vec3 vWorld;
${GLSL_FACING}
void main() {
  float f = facingOf(vWorld);
  float rim = pow(1.0 - clamp(f, 0.0, 1.0), 3.0);
  float lit = pow(max(dot(normalize(vWorld), uLight), 0.0), 2.0);
  vec3 col = uBody + uAccent * (rim * 0.16 + lit * 0.05);
  gl_FragColor = vec4(col, mix(0.6, 0.9, rim) * uReveal);
}`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uViolet;
uniform vec3 uLight;
uniform float uRadius;
uniform float uStrength;
uniform float uReveal;
varying vec3 vWorld;
${GLSL_FACING}
void main() {
  float f = facingOf(vWorld);
  float d = uRadius * sqrt(max(0.0, 1.0 - f * f)); // ray distance to the globe centre
  float inner = pow(clamp(d, 0.0, 1.0), 18.0) * 0.75;
  float outer = 0.75 * pow(clamp(1.0 - (d - 1.0) / (uRadius - 1.0), 0.0, 1.0), 2.6);
  float glow = d < 1.0 ? inner : outer;
  float lit = dot(normalize(vWorld), uLight);
  vec3 col = mix(uViolet, uAccent, smoothstep(-0.7, 0.6, lit));
  float a = glow * uStrength * (0.45 + 0.55 * smoothstep(-0.8, 0.8, lit)) * uReveal;
  gl_FragColor = vec4(col, a);
}`;

const ARC_VERTEX = /* glsl */ `
varying float vU;
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vOcc;
${GLSL_OCCLUSION}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vU = uv.x;
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vOcc = occlusionOf(mv);
  gl_Position = projectionMatrix * mv;
}`;

const ARC_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uDraw;
uniform float uTime;
uniform float uIntensity;
uniform float uEdgePower;
varying float vU;
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vOcc;
void main() {
  float drawn = 1.0 - smoothstep(uDraw - 0.004, uDraw, vU);
  if (drawn <= 0.0) discard;
  float drawing = 1.0 - step(0.999, uDraw);
  float head = smoothstep(uDraw - 0.14, uDraw, vU) * drawing;
  float edge = pow(abs(dot(vNormalV, vViewDir)), uEdgePower);
  float ends = smoothstep(0.0, 0.025, vU) * smoothstep(1.0, 0.975, vU);
  float shimmer = 0.8 + 0.2 * sin(vU * 46.0 - uTime * 2.6);
  vec3 col = mix(uColorA, uColorB, vU) + head * 0.45;
  float a = drawn * edge * ends * vOcc * uIntensity * (shimmer + head * 0.8);
  gl_FragColor = vec4(col, a);
}`;

const GLOW_POINTS_VERTEX = /* glsl */ `
uniform float uScale;
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
${GLSL_OCCLUSION}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vColor = aColor;
  vAlpha = aAlpha * occlusionOf(mv);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_POINTS_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vAlpha <= 0.001) discard;
  float halo = exp(-d * d * 5.0) * (1.0 - d);
  float core = smoothstep(0.32, 0.0, d);
  gl_FragColor = vec4(vColor + core * 0.35, (halo + core * 0.6) * vAlpha);
}`;

const ORBIT_VERTEX = /* glsl */ `
attribute float aU;
varying float vU;
varying float vOcc;
${GLSL_OCCLUSION}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vU = aU;
  vOcc = occlusionOf(mv);
  gl_Position = projectionMatrix * mv;
}`;

const ORBIT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uDashes;
uniform float uReveal;
uniform float uTime;
varying float vU;
varying float vOcc;
void main() {
  float dash = step(0.55, fract(vU * uDashes - uTime * 0.6));
  float sweep = 0.35 + 0.65 * pow(fract(vU - uTime * 0.05), 3.0);
  gl_FragColor = vec4(uColor, dash * sweep * vOcc * 0.32 * uReveal);
}`;

/* ---------- scene builders ---------- */

function additiveBlend(THREE) {
  // Additive colour, but alpha stays a valid premultiplied value on the transparent canvas.
  return {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  };
}

function shaderMaterial(THREE, { uniforms, vertexShader, fragmentShader, additive = false, side }) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: side ?? THREE.FrontSide,
    ...(additive ? additiveBlend(THREE) : {}),
  });
}

const vec3Uniform = (THREE, hex) => ({ value: new THREE.Vector3(...hexToRgb(hex)) });

function createSharedUniforms(THREE) {
  return {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uReveal: { value: 0 },
    uSilhouette: { value: 0.24 },
    uLight: { value: new THREE.Vector3(...LIGHT_DIR).normalize() },
  };
}

function createBody(THREE, shared) {
  const material = shaderMaterial(THREE, {
    uniforms: { uReveal: shared.uReveal, uLight: shared.uLight,
      uBody: vec3Uniform(THREE, PALETTE.body), uAccent: vec3Uniform(THREE, PALETTE.accent) },
    vertexShader: WORLD_VERTEX,
    fragmentShader: BODY_FRAGMENT,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 0.996, 72, 48), material);
  mesh.renderOrder = 0;
  return mesh;
}

function createAtmosphere(THREE, shared) {
  const material = shaderMaterial(THREE, {
    uniforms: { uReveal: shared.uReveal, uLight: shared.uLight,
      uAccent: vec3Uniform(THREE, PALETTE.accent), uViolet: vec3Uniform(THREE, PALETTE.violet),
      uRadius: { value: ATMOSPHERE.radius }, uStrength: { value: ATMOSPHERE.strength } },
    vertexShader: WORLD_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    additive: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * ATMOSPHERE.radius, 72, 48), material);
  mesh.renderOrder = 1;
  return mesh;
}

function graticulePositions() {
  const out = [];
  const push = (lat, lon) => {
    const phi = lat * DEG;
    const lambda = lon * DEG;
    out.push(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda));
  };
  const n = GRATICULE.segments;
  for (let lat = -90 + GRATICULE.step; lat < 90; lat += GRATICULE.step) {
    for (let i = 0; i < n; i += 1) { push(lat, (i / n) * 360); push(lat, ((i + 1) / n) * 360); }
  }
  for (let lon = 0; lon < 360; lon += GRATICULE.step) {
    for (let i = 0; i < n / 2; i += 1) { push(-90 + (i / (n / 2)) * 180, lon); push(-90 + ((i + 1) / (n / 2)) * 180, lon); }
  }
  return new Float32Array(out.map((v) => v * GLOBE_RADIUS * 1.001));
}

function createGraticule(THREE, shared) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(graticulePositions(), 3));
  const material = shaderMaterial(THREE, {
    uniforms: { uReveal: shared.uReveal, uColor: vec3Uniform(THREE, PALETTE.dotDim) },
    vertexShader: WORLD_VERTEX,
    fragmentShader: GRATICULE_FRAGMENT,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 2;
  return lines;
}

function createDots(THREE, shared, focus) {
  const random = createRandom(7);
  const { count } = DOTS;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const dim = hexToRgb(PALETTE.dotDim);
  const bright = hexToRgb(PALETTE.dot);
  const accent = hexToRgb(PALETTE.accent);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const focusIn = Math.cos(DOTS.focusInner * DEG);
  const focusOut = Math.cos(DOTS.focusOuter * DEG);
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const p = [Math.cos(theta) * r, y, Math.sin(theta) * r];
    const near = smoothstep(focusOut, focusIn, p[0] * focus.x + p[1] * focus.y + p[2] * focus.z);
    const base = random() < DOTS.brightShare ? bright : dim;
    const color = mixRgb(base, accent, near * 0.45);
    positions.set(p.map((v) => v * GLOBE_RADIUS * 1.003), i * 3);
    colors.set(color, i * 3);
    sizes[i] = (DOTS.size + random() * DOTS.sizeJitter) * (1 + near * 0.12);
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = shaderMaterial(THREE, {
    uniforms: { uScale: shared.uScale, uTime: shared.uTime, uReveal: shared.uReveal },
    vertexShader: DOTS_VERTEX,
    fragmentShader: DOTS_FRAGMENT,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 3;
  return points;
}

function arcMaterial(THREE, shared, colors, intensity, edgePower) {
  return shaderMaterial(THREE, {
    uniforms: { uTime: shared.uTime, uSilhouette: shared.uSilhouette,
      uColorA: vec3Uniform(THREE, PALETTE[colors[0]]), uColorB: vec3Uniform(THREE, PALETTE[colors[1]]),
      uDraw: { value: 0 }, uIntensity: { value: intensity }, uEdgePower: { value: edgePower } },
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    additive: true,
  });
}

function createLeg(THREE, shared, leg, index) {
  const a = latLonToVec3(THREE, PLACES[leg.from].lat, PLACES[leg.from].lon);
  const b = latLonToVec3(THREE, PLACES[leg.to].lat, PLACES[leg.to].lon);
  const lift = ARC.liftBase + a.angleTo(b) * ARC.liftFactor;
  const points = Array.from({ length: ARC.controlPoints + 1 }, (_, i) => {
    const t = i / ARC.controlPoints;
    return slerpUnit(THREE, a, b, t).multiplyScalar(GLOBE_RADIUS + lift * Math.sin(Math.PI * t));
  });
  const curve = new THREE.CatmullRomCurve3(points);
  const group = new THREE.Group();
  const glowMat = arcMaterial(THREE, shared, leg.colors, 0.42, 2.2);
  const coreMat = arcMaterial(THREE, shared, leg.colors, 1.0, 0.6);
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, ARC.segments, ARC.glow, ARC.radial, false), glowMat);
  const core = new THREE.Mesh(new THREE.TubeGeometry(curve, ARC.segments, ARC.core, ARC.radial, false), coreMat);
  glow.renderOrder = 4;
  core.renderOrder = 5;
  group.add(glow, core);
  const start = ARC.start + index * ARC.stagger;
  return { group, materials: [glowMat, coreMat], samples: curve.getSpacedPoints(ARC.samples), start, to: leg.to };
}

function createGlowPoints(THREE, shared, count) {
  const geometry = new THREE.BufferGeometry();
  const attr = (size) => new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attr(3));
  geometry.setAttribute('aColor', attr(3));
  geometry.setAttribute('aSize', attr(1));
  geometry.setAttribute('aAlpha', attr(1));
  const material = shaderMaterial(THREE, {
    uniforms: { uScale: shared.uScale, uSilhouette: shared.uSilhouette },
    vertexShader: GLOW_POINTS_VERTEX,
    fragmentShader: GLOW_POINTS_FRAGMENT,
    additive: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function createMarkers(THREE, shared) {
  const group = new THREE.Group();
  const cores = createGlowPoints(THREE, shared, PLACES.length * 2);
  cores.renderOrder = 7;
  const normals = PLACES.map((p) => latLonToVec3(THREE, p.lat, p.lon));
  normals.forEach((n, i) => {
    const pos = n.clone().multiplyScalar(1.004);
    cores.geometry.attributes.position.setXYZ(i * 2, pos.x, pos.y, pos.z);
    cores.geometry.attributes.position.setXYZ(i * 2 + 1, pos.x, pos.y, pos.z);
    cores.geometry.attributes.aColor.setXYZ(i * 2, ...hexToRgb(PALETTE.accent));
    cores.geometry.attributes.aColor.setXYZ(i * 2 + 1, ...hexToRgb(PALETTE.ink));
  });
  const ringGeometry = new THREE.RingGeometry(MARKER.ringInner, MARKER.ringOuter, 48);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const rings = normals.flatMap((n) => Array.from({ length: MARKER.ringsPerCity }, () => {
    const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: PALETTE.accent, transparent: true, depthWrite: false, depthTest: false, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    mesh.position.copy(n).multiplyScalar(1.003);
    mesh.quaternion.setFromUnitVectors(zAxis, n);
    mesh.renderOrder = 6;
    group.add(mesh);
    return mesh;
  }));
  group.add(cores);
  return { group, cores, rings, normals };
}

function createPackets(THREE, shared, legs) {
  const count = legs.length * PACKET.perLeg * PACKET.trail;
  const points = createGlowPoints(THREE, shared, count);
  points.renderOrder = 8;
  const warm = hexToRgb(PALETTE.warm);
  for (let i = 0; i < count; i += 1) points.geometry.attributes.aColor.setXYZ(i, ...warm);
  return { points, cycles: new Array(legs.length * PACKET.perLeg).fill(-1) };
}

function createOrbit(THREE, shared) {
  const n = ORBIT.segments;
  const positions = new Float32Array((n + 1) * 3);
  const us = new Float32Array(n + 1);
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    positions.set([Math.cos(t) * ORBIT.radius, 0, Math.sin(t) * ORBIT.radius], i * 3);
    us[i] = i / n;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aU', new THREE.BufferAttribute(us, 1));
  const material = shaderMaterial(THREE, {
    uniforms: { uReveal: shared.uReveal, uTime: shared.uTime, uSilhouette: shared.uSilhouette,
      uColor: vec3Uniform(THREE, PALETTE.accent), uDashes: { value: ORBIT.dashes } },
    vertexShader: ORBIT_VERTEX,
    fragmentShader: ORBIT_FRAGMENT,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 2;
  const satellite = createGlowPoints(THREE, shared, 1);
  satellite.geometry.attributes.aColor.setXYZ(0, ...hexToRgb(PALETTE.violet));
  satellite.geometry.attributes.aSize.setX(0, 0.07);
  satellite.renderOrder = 9;
  const group = new THREE.Group();
  group.rotation.set(ORBIT.tiltX, 0, ORBIT.tiltZ);
  group.add(line, satellite);
  return { group, satellite };
}

function createLabels(mount, lang) {
  const layer = document.createElement('div');
  layer.className = 'globe__labels';
  const items = PLACES.map((place) => {
    const el = document.createElement('div');
    el.className = `globe__label globe__label--${place.anchor}`;
    const inner = document.createElement('span');
    inner.className = 'globe__label-inner';
    const name = document.createElement('span');
    name.className = 'globe__label-name';
    name.textContent = place.name[lang];
    const coords = document.createElement('span');
    coords.className = 'globe__label-coords';
    coords.textContent = formatCoords(place, lang);
    inner.append(name, coords);
    el.append(inner);
    layer.append(el);
    return el;
  });
  mount.append(layer);
  return { layer, items };
}

/* ---------- input (pointer parallax + drag with inertia) ---------- */

function createInput(mount) {
  // Mutable by design: updated every frame in the render loop.
  const s = { tx: 0, ty: 0, px: 0, py: 0, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, lastX: 0, lastY: 0, id: null };
  const onMove = (e) => {
    s.tx = (e.clientX / window.innerWidth) * 2 - 1;
    s.ty = (e.clientY / window.innerHeight) * 2 - 1;
    if (!s.dragging || e.pointerId !== s.id) return;
    s.vYaw = (e.clientX - s.lastX) * DRAG.sensitivity;
    s.vPitch = (e.clientY - s.lastY) * DRAG.sensitivity;
    s.yaw += s.vYaw;
    s.pitch = Math.max(-DRAG.maxPitch, Math.min(DRAG.maxPitch, s.pitch + s.vPitch));
    s.lastX = e.clientX;
    s.lastY = e.clientY;
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    Object.assign(s, { dragging: true, lastX: e.clientX, lastY: e.clientY, id: e.pointerId, vYaw: 0, vPitch: 0 });
    mount.setPointerCapture?.(e.pointerId);
    mount.classList.add('is-dragging');
  };
  const onUp = (e) => {
    if (e.pointerId !== s.id) return;
    s.dragging = false;
    mount.releasePointerCapture?.(e.pointerId);
    mount.classList.remove('is-dragging');
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  mount.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  const update = () => {
    s.px += (s.tx - s.px) * PARALLAX.ease;
    s.py += (s.ty - s.py) * PARALLAX.ease;
    if (s.dragging) return;
    s.yaw += s.vYaw;
    s.pitch += s.vPitch;
    s.vYaw *= DRAG.damping;
    s.vPitch *= DRAG.damping;
    s.yaw -= s.yaw * DRAG.spring; // drift back to the rest view
    s.pitch -= s.pitch * DRAG.spring;
  };
  const dispose = () => {
    window.removeEventListener('pointermove', onMove);
    mount.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  return { state: s, update, dispose };
}

/* ---------- per-frame updates ---------- */

function legProgress(leg, t) {
  return easeInOutCubic((t - leg.start) / ARC.draw);
}

function cityRevealTime(index, legs) {
  if (index === ROUTE[0].from) return legs[0].start;
  const leg = legs.find((l) => l.to === index);
  return leg ? leg.start + ARC.draw * 0.92 : 0;
}

function sampleCurve(samples, p, out) {
  const f = clamp01(p) * (samples.length - 1);
  const i = Math.min(samples.length - 2, Math.floor(f));
  return out.copy(samples[i]).lerp(samples[i + 1], f - i);
}

function updatePackets(packets, legs, t, arrivals, scratch) {
  const { position, aSize, aAlpha } = packets.points.geometry.attributes;
  legs.forEach((leg, li) => {
    const ready = leg.start + ARC.draw;
    for (let k = 0; k < PACKET.perLeg; k += 1) {
      const slot = li * PACKET.perLeg + k;
      const local = t - ready - (k * PACKET.duration) / PACKET.perLeg;
      const cycle = Math.floor(local / PACKET.duration);
      if (local >= 0 && cycle !== packets.cycles[slot] && packets.cycles[slot] >= 0) arrivals[leg.to] = t;
      if (local >= 0) packets.cycles[slot] = cycle;
      const p = local >= 0 ? (local / PACKET.duration) % 1 : -1;
      for (let j = 0; j < PACKET.trail; j += 1) {
        const idx = slot * PACKET.trail + j;
        const pj = p - (j / PACKET.trail) * PACKET.trailSpan;
        const visible = p >= 0 && pj >= 0;
        const fade = (1 - j / PACKET.trail) ** 1.6 * smoothstep(1, 0.9, p);
        sampleCurve(leg.samples, easeInOutSine(Math.max(pj, 0)), scratch);
        position.setXYZ(idx, scratch.x, scratch.y, scratch.z);
        aSize.setX(idx, PACKET.size * (j === 0 ? 1 : 0.55 * (1 - j / PACKET.trail) + 0.12));
        aAlpha.setX(idx, visible ? fade : 0);
      }
    }
  });
  position.needsUpdate = true;
  aSize.needsUpdate = true;
  aAlpha.needsUpdate = true;
}

function updateMarkers(markers, legs, t, arrivals) {
  const { aSize, aAlpha } = markers.cores.geometry.attributes;
  PLACES.forEach((_, i) => {
    const reveal = easeOutCubic((t - cityRevealTime(i, legs)) / 0.5);
    const flash = arrivals[i] > 0 ? Math.exp(-(t - arrivals[i]) * MARKER.arrivalDecay) : 0;
    aSize.setX(i * 2, MARKER.halo * (1 + flash * 0.9) * reveal);
    aAlpha.setX(i * 2, (0.55 + flash * 0.45) * reveal);
    aSize.setX(i * 2 + 1, MARKER.core * (1 + flash * 0.5) * reveal);
    aAlpha.setX(i * 2 + 1, reveal);
    for (let r = 0; r < MARKER.ringsPerCity; r += 1) {
      const ring = markers.rings[i * MARKER.ringsPerCity + r];
      const phase = ((t / MARKER.ringPeriod) + r / MARKER.ringsPerCity) % 1;
      ring.scale.setScalar(1 + phase * MARKER.ringScale);
      ring.material.opacity = (1 - phase) ** 2 * 0.75 * reveal;
    }
  });
  aSize.needsUpdate = true;
  aAlpha.needsUpdate = true;
}

function updateOrbit(orbit, t) {
  const a = t * ORBIT.speed * Math.PI * 2;
  orbit.satellite.geometry.attributes.position.setXYZ(0, Math.cos(a) * ORBIT.radius, 0, Math.sin(a) * ORBIT.radius);
  orbit.satellite.geometry.attributes.aAlpha.setX(0, smoothstep(INTRO.reveal, INTRO.reveal + 1, t) * 0.9);
  orbit.satellite.geometry.attributes.position.needsUpdate = true;
  orbit.satellite.geometry.attributes.aAlpha.needsUpdate = true;
}

function updateLabels(ctx, t) {
  const { labels, markers, globe, camera, size, scratch, scratchDir, legs } = ctx;
  labels.items.forEach((el, i) => {
    const world = scratch.copy(markers.normals[i]).applyMatrix4(globe.matrixWorld);
    const facing = scratchDir.subVectors(camera.position, world).normalize().dot(world);
    const reveal = smoothstep(0, LABEL.fade, t - cityRevealTime(i, legs) - 0.2);
    const opacity = smoothstep(LABEL.hideBelow, LABEL.showAbove, facing) * reveal;
    world.project(camera);
    const x = (world.x * 0.5 + 0.5) * size.width;
    const y = (-world.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.style.opacity = opacity.toFixed(3);
  });
}

function updateScene(ctx, t) {
  const { shared, globe, camera, input, legs } = ctx;
  input.update();
  const intro = easeOutCubic(t / INTRO.duration);
  const sway = Math.sin(t * SWAY.speed * Math.PI * 2 * 0.5);
  globe.rotation.y = -VIEW.lon * DEG + (1 - intro) * INTRO.yaw + sway * SWAY.yaw + input.state.yaw;
  globe.rotation.x = VIEW.lat * DEG + (1 - intro) * INTRO.pitch + Math.cos(t * SWAY.speed * 2) * SWAY.pitch
    + input.state.pitch;
  camera.position.set(input.state.px * PARALLAX.x, -input.state.py * PARALLAX.y, ctx.distance);
  camera.lookAt(0, 0, 0);
  globe.updateMatrixWorld();

  shared.uTime.value = t;
  shared.uReveal.value = easeOutCubic(t / INTRO.reveal);
  legs.forEach((leg) => leg.materials.forEach((m) => { m.uniforms.uDraw.value = legProgress(leg, t); }));
  updatePackets(ctx.packets, legs, t, ctx.arrivals, ctx.scratch);
  updateMarkers(ctx.markers, legs, t, ctx.arrivals);
  updateOrbit(ctx.orbit, t);
  updateLabels(ctx, t);
}

/* ---------- lifecycle ---------- */

function createRenderer(THREE) {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'globe__canvas';
    return renderer;
  } catch (err) {
    console.warn('[globe] WebGL renderer could not be created:', err);
    return null;
  }
}

function resize(ctx) {
  // The canvas bleeds past the mount (globe.css) so the halo and orbit are never clipped.
  const canvas = ctx.renderer.domElement;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const radiusPx = Math.max(1, Math.min(ctx.mount.clientWidth, ctx.mount.clientHeight) * GLOBE_FILL * 0.5);
  const tanHalf = Math.tan((CAMERA.fov * DEG) / 2);
  ctx.size = { width, height };
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.distance = (GLOBE_RADIUS * height * 0.5) / (radiusPx * tanHalf);
  ctx.camera.updateProjectionMatrix();
  ctx.shared.uScale.value = (height * ctx.renderer.getPixelRatio()) / (2 * tanHalf);
  ctx.shared.uSilhouette.value = GLOBE_RADIUS / Math.sqrt(ctx.distance ** 2 - GLOBE_RADIUS ** 2);
}

function disposeScene(scene) {
  scene.traverse((obj) => {
    obj.geometry?.dispose();
    [].concat(obj.material ?? []).forEach((m) => m.dispose());
  });
}

function buildContext(THREE, mount, renderer) {
  const shared = createSharedUniforms(THREE);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  const globe = new THREE.Group();
  globe.rotation.order = 'XYZ';
  const focus = latLonToVec3(THREE, FOCUS.lat, FOCUS.lon);
  const legs = ROUTE.map((leg, i) => createLeg(THREE, shared, leg, i));
  const markers = createMarkers(THREE, shared);
  const packets = createPackets(THREE, shared, legs);
  const orbit = createOrbit(THREE, shared);
  globe.add(createBody(THREE, shared), createGraticule(THREE, shared), createDots(THREE, shared, focus),
    ...legs.map((l) => l.group), markers.group, packets.points);
  scene.add(createAtmosphere(THREE, shared), globe, orbit.group);
  return {
    THREE, mount, renderer, shared, scene, camera, globe, legs, markers, packets, orbit,
    labels: createLabels(mount, readLang()),
    input: createInput(mount),
    arrivals: PLACES.map(() => 0),
    scratch: new THREE.Vector3(),
    scratchDir: new THREE.Vector3(),
    size: { width: 1, height: 1 },
    distance: 5,
  };
}

function start(THREE, mount) {
  const renderer = createRenderer(THREE);
  if (!renderer) { markOff(mount, 'no-webgl'); return; }
  if (getComputedStyle(mount).position === 'static') mount.style.position = 'relative';
  mount.prepend(renderer.domElement);
  const ctx = buildContext(THREE, mount, renderer);
  // data-globe-seek="<seconds>" starts the timeline later (used for screenshots/tests).
  const seek = Math.max(0, Number.parseFloat(mount.dataset.globeSeek) || 0);
  const loop = { raf: 0, last: 0, elapsed: seek, inView: true, ready: false, disposed: false };

  const frame = (now) => {
    loop.raf = requestAnimationFrame(frame);
    const dt = Math.min((now - loop.last) / 1000, MAX_FRAME_DT);
    loop.last = now;
    loop.elapsed += Math.max(dt, 0);
    updateScene(ctx, loop.elapsed);
    renderer.render(ctx.scene, ctx.camera);
    if (!loop.ready) {
      loop.ready = true;
      mount.classList.add('globe-ready');
      mount.dataset.globe = 'running';
    }
  };
  const sync = () => {
    const shouldRun = loop.inView && !document.hidden && !loop.disposed;
    if (shouldRun && !loop.raf) {
      loop.last = performance.now();
      loop.raf = requestAnimationFrame(frame);
    } else if (!shouldRun && loop.raf) {
      cancelAnimationFrame(loop.raf);
      loop.raf = 0;
    }
  };

  const resizeObserver = new ResizeObserver(() => resize(ctx));
  const intersection = new IntersectionObserver(([entry]) => { loop.inView = entry.isIntersecting; sync(); });
  const smallQuery = window.matchMedia(`(max-width: ${MIN_VIEWPORT_PX - 0.02}px)`);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onEnvChange = () => {
    if (smallQuery.matches || motionQuery.matches) dispose(smallQuery.matches ? 'small-screen' : 'reduced-motion');
  };
  const onContextLost = (e) => { e.preventDefault(); dispose('context-lost'); };
  const onPageHide = (e) => { if (!e.persisted) dispose('unloaded'); };
  const onDisposeRequest = () => dispose('disposed');

  function dispose(reason) {
    if (loop.disposed) return;
    loop.disposed = true;
    sync();
    resizeObserver.disconnect();
    intersection.disconnect();
    smallQuery.removeEventListener('change', onEnvChange);
    motionQuery.removeEventListener('change', onEnvChange);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pagehide', onPageHide);
    mount.removeEventListener('globe:dispose', onDisposeRequest);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    ctx.input.dispose();
    disposeScene(ctx.scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    ctx.labels.layer.remove();
    markOff(mount, reason);
  }

  resize(ctx);
  resizeObserver.observe(mount);
  intersection.observe(mount);
  smallQuery.addEventListener('change', onEnvChange);
  motionQuery.addEventListener('change', onEnvChange);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', onPageHide);
  mount.addEventListener('globe:dispose', onDisposeRequest);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  sync();
}

function boot() {
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return;
  const reason = getDisabledReason();
  if (reason) { markOff(mount, reason); return; }
  mount.dataset.globe = 'loading';
  import(THREE_URL)
    .then((THREE) => start(THREE, mount))
    .catch((err) => {
      console.warn('[globe] disabled, Three.js failed to load or start:', err);
      markOff(mount, 'load-error');
    });
}

boot();
