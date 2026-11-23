// The route in 3D: Unreal's true map (the body-height slice the evaluator uses, extruded to a fixed height for the
// picture), the obstacle in yellow, the input, Unreal's path and every method's camera path (VGGT-Omega, the Task 2
// evaluator) drawn up to the video's current time, with a camera marker at its head. One WebGL canvas, rendered only
// while on screen. Drag to turn it. Returns null without WebGL (the 2D top view stays).
import * as THREE from '../vendor/three.module.min.js';

const WALL_H = 1.5, CAM_Y = 0.75;

function insideRing(x, y, p) {          // even-odd test against one flat ring [u0, v0, u1, v1, ...]
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// rings -> shapes with holes (a ring inside an odd number of others is a hole of its innermost container)
function shapesOf(rings) {
  const R = rings.filter(p => p.length >= 6);
  const depth = R.map((p, i) => R.reduce((n, q, j) => n + (j !== i && insideRing(p[0], p[1], q) ? 1 : 0), 0));
  const toV = (p) => { const v = []; for (let i = 0; i < p.length; i += 2) v.push(new THREE.Vector2(p[i], p[i + 1])); return v; };
  const solids = [];
  R.forEach((p, i) => { if (depth[i] % 2 === 0) solids.push({ i, s: new THREE.Shape(toV(p)) }); });
  R.forEach((p, i) => {
    if (depth[i] % 2 !== 1) return;
    const host = solids.filter(o => depth[o.i] === depth[i] - 1 && insideRing(p[0], p[1], R[o.i]))[0];
    if (host) host.s.holes.push(new THREE.Path(toV(p)));
  });
  return solids.map(o => o.s);
}
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);

function extrude(rings, h, mat, edgeColor) {
  const geo = new THREE.ExtrudeGeometry(shapesOf(rings), { depth: h, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);                       // shape (u, v), extrusion z  ->  world (u, z, -v)
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: .55 }));
  const g = new THREE.Group(); g.add(mesh, edges); return g;
}

function polyline(P, y) {                         // deduplicated world points and cumulative lengths
  const pts = [], cum = [];
  let L = 0;
  for (const [u, v] of P) {
    const q = new THREE.Vector3(u, y, -v);
    if (pts.length && q.distanceTo(pts[pts.length - 1]) < 0.004) continue;
    if (pts.length) L += q.distanceTo(pts[pts.length - 1]);
    pts.push(q); cum.push(L);
  }
  return { pts, cum, L };
}

export class Map3D {
  static create(host, data) {
    let r;
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) return null;
      r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch (e) { return null; }
    return new Map3D(host, data, r);
  }
  constructor(host, d, renderer) {
    this.host = host; this.d = d; this.r = renderer; this.t = 0; this.keys = []; this.paths = []; this.hl = null; this.dirty = true; this.visible = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    // each look's paper: white by day, dimmed parchment in Night View, navy in the GTA look (the scene itself is the same)
    const LOOK = { day: [0xfafbfc, 0xf1f3f6], night: [0xd5ccb8, 0xd9d0bc], gta: [0x101a2c, 0x1a2742] };
    const look = (t) => LOOK[t] || LOOK.day;
    const [bg0, fl0] = look(document.documentElement.dataset.theme);
    renderer.setClearColor(bg0, 1);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    host.append(renderer.domElement);
    const scene = this.scene = new THREE.Scene();
    // what to frame: the hand-off, the input, Unreal's path
    const pts = [[0, 0], ...d.intent.p, ...d.unreal.p].filter(([u, v]) => Math.hypot(u, v) < 14);
    const box = new THREE.Box2(); pts.forEach(([u, v]) => box.expandByPoint(new THREE.Vector2(u, v)));
    if (d.contact) box.expandByPoint(new THREE.Vector2(d.contact[0], d.contact[1]));
    const c2 = box.getCenter(new THREE.Vector2()), size = box.getSize(new THREE.Vector2());
    this.target = new THREE.Vector3(c2.x, 0.4, -c2.y);
    this.radius = Math.max(2.2, Math.hypot(size.x, size.y) / 2 + 1.2);
    scene.fog = new THREE.Fog(bg0, this.radius * 2.2, this.radius * 6);
    // light
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa1af, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(this.target.x - 6, 12, this.target.z + 7); sun.target.position.copy(this.target);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008;
    const sc = sun.shadow.camera, ext = this.radius + 5; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 40;
    scene.add(sun, sun.target);
    // floor and a 1 m grid
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: fl0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, 0xd5dae2, 0xe3e7ee); grid.position.set(Math.round(this.target.x), 0.002, Math.round(this.target.z)); scene.add(grid);
    // the map (without the obstacle's own rings) and the obstacle
    const obst = d.obstacle || [];
    const near = (p) => { const R2 = this.radius * 2.6; for (let i = 0; i < p.length; i += 2) if (Math.hypot(p[i] - c2.x, p[i + 1] - c2.y) < R2) return true; return false; };
    const rest = d.map.filter(p => near(p) && !obst.some(q => same(p, q)));
    scene.add(extrude(rest, WALL_H, new THREE.MeshLambertMaterial({ color: 0xc9cfda }), 0x4b5262));
    if (obst.length) scene.add(this.obstacle = extrude(obst, WALL_H + 0.01, new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x4a3a00, transparent: true, opacity: .9 }), 0x8a6a00));
    // the input (dashed, on the floor) and Unreal's path (a wide pale band)
    const ip = polyline(d.intent.p, 0.02);
    const il = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ip.pts), new THREE.LineDashedMaterial({ color: 0x22262e, dashSize: .12, gapSize: .1, transparent: true, opacity: .8 }));
    il.computeLineDistances(); scene.add(il);
    this.unreal = this.tube(d.unreal, 0x22262e, .07, .22);
    // start marker
    const start = new THREE.Mesh(new THREE.RingGeometry(.1, .15, 32), new THREE.MeshBasicMaterial({ color: 0x22262e }));
    start.rotation.x = -Math.PI / 2; start.position.set(0, 0.01, 0); scene.add(start);
    // camera and interaction
    this.cam = new THREE.PerspectiveCamera(34, 1, .05, 200);
    const iv = d.intent.p, a = iv[0], b = iv[iv.length - 1];
    this.theta0 = Math.atan2(-(b[0] - a[0]), (b[1] - a[1])) + 0.55;      // behind the input, a little to the side
    this.theta = this.theta0; this.phi = 0.86; this.user = 0;
    this.drag();
    new ResizeObserver(() => this.resize()).observe(host); this.resize();
    addEventListener('nope:theme', (e) => { const [bg, fl] = look(e.detail); renderer.setClearColor(bg, 1); scene.fog.color.set(bg);
      floor.material.color.set(fl); this.dirty = true; });
    this.ready = false;
    const go = () => { this.ready = true; if (this.visible) this.loop(); };
    (renderer.compileAsync ? renderer.compileAsync(scene, this.cam).catch(() => {}) : Promise.resolve()).then(go);
    new IntersectionObserver((es) => { this.visible = es.some(e => e.isIntersecting); if (this.visible) this.loop(); }, { threshold: 0.01 }).observe(host);
  }
  tube(path, color, radius, opacity) {
    const pl = polyline(path.p, CAM_Y);
    if (pl.pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pl.pts, false, 'centripetal');
    const seg = Math.min(600, Math.max(24, pl.pts.length * 6)), radial = 8;
    const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: .35, transparent: true, opacity });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; this.scene.add(mesh);
    return { mesh, geo, mat, pl, path, seg, radial, curve, opacity };
  }
  setKeys(keys) {
    for (const p of this.paths) { this.scene.remove(p.mesh, p.head); p.geo.dispose(); p.mat.dispose(); }
    this.paths = [];
    for (const k of keys) {
      const path = this.d.paths[k.key]; if (!path) continue;
      const col = new THREE.Color(k.color).offsetHSL(0, .05, .08);
      const tb = this.tube(path, col, .045, 1); if (!tb) continue;
      const head = new THREE.Group();
      head.add(new THREE.Mesh(new THREE.SphereGeometry(.11, 20, 14), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: .5 })));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.2, .42, 4, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false }));
      cone.rotation.x = Math.PI / 2; cone.position.z = -.26; head.add(cone);   // a view frustum pointing along -z
      this.scene.add(head);
      this.paths.push({ ...tb, key: k.key, head });
    }
    this.setTime(this.t);
  }
  highlight(key) { this.hl = key; for (const p of this.paths) p.mat.opacity = !key || key === p.key ? 1 : .18, p.mat.transparent = true; this.dirty = true; }
  frac(p, t) {                                     // share of the path's length travelled by time t
    const T = p.path.t, n = Math.min(T.length, p.path.p.length);
    if (t <= T[0]) return 0; if (t >= T[n - 1]) return 1;
    let i = 1; while (i < n && T[i] < t) i++;
    const a = (t - T[i - 1]) / Math.max(1e-6, T[i] - T[i - 1]);
    // map sample index to the deduplicated polyline's length (close enough: duplicates have zero length)
    const pl = p.pl, P = p.path.p;
    let L = 0, prev = null;
    for (let j = 0; j <= i; j++) { const q = P[j]; if (prev) { const dl = Math.hypot(q[0] - prev[0], q[1] - prev[1]); L += j === i ? a * dl : dl; } prev = q; }
    return Math.min(1, L / Math.max(1e-6, pl.L));
  }
  setTime(t) {
    this.t = t;
    for (const p of this.paths) {
      const f = this.frac(p, t);
      p.geo.setDrawRange(0, Math.max(0, Math.floor(f * p.seg)) * p.radial * 6);
      const q = p.curve.getPointAt(Math.min(.999, Math.max(.001, f))), q2 = p.curve.getPointAt(Math.min(1, f + .01));
      p.head.position.copy(q);
      if (q2.distanceTo(q) > 1e-4) p.head.lookAt(q.clone().sub(q2).add(q));   // the frustum (-z) points along the motion
    }
    this.dirty = true;
    if (this.visible) this.loop();
  }
  drag() {
    const el = this.r.domElement;
    let x0 = null, y0 = 0;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; if (e.pointerType === 'mouse') el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      this.theta -= (e.clientX - x0) * .008; if (e.pointerType === 'mouse') this.phi = Math.min(1.35, Math.max(.2, this.phi - (e.clientY - y0) * .005));
      x0 = e.clientX; y0 = e.clientY; this.user = performance.now(); this.dirty = true; this.loop();
    });
    const up = () => { x0 = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.dirty = true;
  }
  loop() {
    if (this.raf || !this.ready) return;
    const step = (now) => {
      this.raf = 0;
      if (!this.visible) return;
      const idle = now - this.user > 3500 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (idle) { this.theta += (this.theta0 + .32 * Math.sin(now / 5200) - this.theta) * .02; this.dirty = true; }
      if (this.dirty) {
        const R = this.radius / Math.sin(THREE.MathUtils.degToRad(this.cam.fov / 2)) * (this.cam.aspect < 1 ? 1.45 : 1.08);
        const T = this.target;
        this.cam.position.set(T.x + R * Math.sin(this.phi) * Math.sin(this.theta), T.y + R * Math.cos(this.phi), T.z + R * Math.sin(this.phi) * Math.cos(this.theta));
        this.cam.lookAt(T);
        this.r.render(this.scene, this.cam); this.dirty = false;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
