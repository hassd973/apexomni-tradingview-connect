import { createPointCloud, updatePointSize, updateDensity, applyGenerativeMapping } from './pointcloud.js';
import { setupFirstPersonControls, enablePlayHUD, disablePlayHUD, resetCamera } from './controls.js';
import { parseBTCPointData } from './btcDataWorker.js';
import { toggleFullscreen } from './fullscreen.js';

const canvas = document.getElementById('webgl');
const statusText = document.getElementById('statusText');
const fpsEl = document.getElementById('fps');

let renderer, scene, camera, pointCloud;
let tickRAF;

init();

async function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  resize();
  addEventListener('resize', resize, { passive: true });

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.FogExp2(0x04060a, 0.0012);

  camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
  camera.position.set(0, 3, 8);

  const hemi = new THREE.HemisphereLight(0x7db0ff, 0x08121a, 0.8);
  scene.add(hemi);

  statusText.textContent = 'Loading Bitcoin point data…';
  const btcData = await parseBTCPointData(); // { positions: Float32Array, seeds: Uint32Array }

  pointCloud = createPointCloud(btcData, { scene });

  const ctrl = setupFirstPersonControls({ camera, canvas, scene, collider: pointCloud.collider });

  document.getElementById('applyPrompt').onclick = () => {
    const prompt = document.getElementById('prompt').value.trim();
    applyGenerativeMapping(pointCloud, prompt);
  };
  document.getElementById('size').oninput = (e) => updatePointSize(pointCloud, parseFloat(e.target.value));
  document.getElementById('density').oninput = (e) => updateDensity(pointCloud, parseFloat(e.target.value));
  document.getElementById('resetCam').onclick = () => resetCamera(camera);
  document.getElementById('playBtn').onclick = async () => {
    await toggleFullscreen(canvas);
    ctrl.lock();
  };

  ctrl.onLock = () => { enablePlayHUD(); };
  ctrl.onUnlock = () => { disablePlayHUD(); };

  statusText.textContent = 'Ready.';
  requestIdleCallback?.(() => renderer.compile(scene, camera));

  let last = performance.now();
  const stats = { frames: 0, lastFPS: performance.now() };

  const target = 58;
  tickRAF = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    stats.frames++;
    if (now - stats.lastFPS > 1000) {
      const fps = Math.round((stats.frames * 1000) / (now - stats.lastFPS));
      fpsEl.textContent = `${fps} fps`;
      stats.frames = 0; stats.lastFPS = now;

      if (fps < target - 8) updateDensity(pointCloud, Math.max(0.2, pointCloud.userDensity * 0.9));
      else if (fps > target + 8) updateDensity(pointCloud, Math.min(1.0, pointCloud.userDensity * 1.05));
    }

    ctrl.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tickRAF);
  };
  requestAnimationFrame(tickRAF);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer?.setSize(w, h, false);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
