/* fpv-explore.js — FPV only via Explore; hidden tube by default; smooth motion.
   Requires: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[]).
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);

  let Q, curve=null, tube=null, curveLen=1;
  let isFPV=false;
  let runnerT=0, playerY=0, velY=0;

  // Inputs and smoothing
  const moveRaw = {f:0,b:0,l:0,r:0, run:0};
  const moveSm  = {fwd:0, lat:0}; // smoothed forward & lateral
  const keysDown = new Set();

  const cfg = {
    tubeRadius: 0.065,
    baseSpeed: 2.2,
    runBoost: 1.7,
    strafeSpeed: 1.2,
    eyeHeight: 0.12,
    lookAhead: 2.6,
    jumpVel: 3.0,
    gravity: 9.0,
    // smoothing
    easeIn: 8.0,     // higher = faster response
    easeOut: 6.0,
    camPosLerp: 0.45,
    camRotSlerp: 0.35,
  };

  // HUD (minimal) + Path toggle
  let hud=null, pathBtn=null, hintTimer=null, headerPathBtn=null;
  function buildHUD() {
    if (hud) return;
    const root = document.createElement('div');
    root.style.position='absolute'; root.style.inset='0'; root.style.pointerEvents='none';
    root.style.zIndex='30'; root.id='fpv-hud-min';
    // path toggle (top-left)
    const btn = document.createElement('button');
    btn.textContent = 'Path';
    btn.id='toggle-path';
    Object.assign(btn.style,{
      position:'absolute', top:'12px', left:'12px', pointerEvents:'auto',
      padding:'6px 10px', borderRadius:'10px',
      background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      fontSize:'12px'
    });
    btn.setAttribute('aria-pressed','false');
    btn.onclick = ()=> {
      if (!tube) return;
      const on = !(tube.visible);
      tube.visible = on;
      btn.setAttribute('aria-pressed', String(on));
      headerPathBtn && headerPathBtn.setAttribute('aria-pressed', String(on));
    };

    // small hint (auto-fade)
    const hint = document.createElement('div');
    hint.textContent = 'W/S move • A/D strafe • Space jump • Shift run • Esc exit';
    Object.assign(hint.style,{
      position:'absolute', bottom:'16px', left:'50%', transform:'translateX(-50%)',
      background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'12px',
      padding:'6px 10px', borderRadius:'8px', opacity:'0', transition:'opacity .4s ease'
    });

    root.appendChild(btn);
    root.appendChild(hint);
    $('stagePanel')?.appendChild(root);
    hud = root; pathBtn = btn;

    clearTimeout(hintTimer);
    hint.style.opacity='1';
    hintTimer = setTimeout(()=> hint.style.opacity='0', 3200);
  }

  // Mobile joystick (optional): keep it simple & hidden until FPV, but we rely on WASD for now.
  // If you want it back, we can re-add later without touching this file.

  function getPathPoints(){
    const pts = (window.QUANTUMI?.path) || [];
    return pts.length>=3 ? pts : [];
  }

  function rebuildCurveAndTube(){
    const pts = getPathPoints();
    if (pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // Approx length
    const tmp = curve.getPoints(800);
    let L=0; for(let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // Tube (hidden by default)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(1600, pts.length*6), cfg.tubeRadius, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, transparent:true, opacity:0.85, roughness:0.35, metalness:0.05
    });
    tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'HashTube';
    tube.visible = false; // <- hidden by default
    Q.scene.add(tube);
    pathBtn && pathBtn.setAttribute('aria-pressed','false');
    headerPathBtn && headerPathBtn.setAttribute('aria-pressed','false');
    return true;
  }

  // Fullscreen helpers — do NOT bind to fullscreen buttons; Explore handles FPV.
  function enterFullscreen(el){ el?.requestFullscreen?.().catch(()=>{}); }
  function exitFullscreen(){ if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }

  // Input binding (desktop)
  function bindKeys(){
    window.addEventListener('keydown', (e)=>{
      if (!isFPV) return;
      if (['INPUT','TEXTAREA'].includes((document.activeElement?.tagName||''))) return;
      const k = e.key.toLowerCase();
      keysDown.add(k);
      if (k==='w') moveRaw.f = 1;
      if (k==='s') moveRaw.b = 1;
      if (k==='a') moveRaw.l = 1;
      if (k==='d') moveRaw.r = 1;
      if (k==='shift') moveRaw.run = 1;
      if (k===' ') { if (Math.abs(playerY) < 0.02) velY = cfg.jumpVel; }
      if (k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', (e)=>{
      if (!isFPV) return;
      const k = e.key.toLowerCase();
      keysDown.delete(k);
      if (k==='w') moveRaw.f = 0;
      if (k==='s') moveRaw.b = 0;
      if (k==='a') moveRaw.l = 0;
      if (k==='d') moveRaw.r = 0;
      if (k==='shift') moveRaw.run = 0;
    });
  }

  // Smooth step toward target with different in/out rates
  function easeToward(cur, target, dt){
    const diff = target - cur;
    const rate = (Math.abs(target) > Math.abs(cur)) ? cfg.easeIn : cfg.easeOut;
    return cur + diff * Math.min(1, rate * dt);
  }

  function tick(dt){
    if (!isFPV || !curve) return;

    // Smooth inputs
    const targetFwd = (moveRaw.f - moveRaw.b);
    const targetLat = (moveRaw.r - moveRaw.l);
    moveSm.fwd = easeToward(moveSm.fwd, targetFwd, dt);
    moveSm.lat = easeToward(moveSm.lat, targetLat, dt);

    // Advance along curve
    const speed = cfg.baseSpeed * (moveRaw.run ? cfg.runBoost : 1);
    runnerT = (runnerT + (moveSm.fwd * speed * dt) / curveLen + 1) % 1;

    // Jump/gravity
    velY -= cfg.gravity * dt;
    playerY += velY * dt;
    if (playerY < 0){ playerY = 0; velY = 0; }

    // Sample curve
    const pos = curve.getPointAt(runnerT);
    const tan = curve.getTangentAt(runnerT).normalize();
    const up  = new THREE.Vector3(0,1,0);
    const side= new THREE.Vector3().crossVectors(tan, up).normalize();

    const eye = pos.clone()
      .add(up.clone().multiplyScalar(cfg.eyeHeight + playerY))
      .add(side.multiplyScalar(moveSm.lat * cfg.strafeSpeed * 0.4));

    const look = curve.getPointAt((runnerT + (cfg.lookAhead/curveLen)) % 1);

    const cam = Q.camera;
    cam.position.lerp(eye, cfg.camPosLerp);
    const m = new THREE.Matrix4().lookAt(eye, look, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, cfg.camRotSlerp);

    // Keep controls target sensible for when we exit FPV
    Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
  }

  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;

    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      // Build curve from current data
      if (!rebuildCurveAndTube()){
        console.warn('FPV: missing path points');
        return;
      }
      // Start position
      runnerT = 0; playerY=0; velY=0;
      // Disable OrbitControls while FPV
      Q.controls && (Q.controls.enabled=false);
      // Fullscreen the stage
      enterFullscreen($('stagePanel'));
      // HUD on
      buildHUD();
    } else {
      // Restore controls
      Q && Q.controls && (Q.controls.enabled=true, Q.controls.update?.());
      // HUD off
      if (hud && hud.parentNode){ hud.parentNode.removeChild(hud); hud=null; pathBtn=null; }
      // We leave the tube in scene (still hidden unless user toggled it)
      exitFullscreen();
      // Reset inputs
      Object.assign(moveRaw,{f:0,b:0,l:0,r:0,run:0});
      Object.assign(moveSm,{fwd:0,lat:0});
    }
  }

  function bindUI(){
    // Only “Explore” toggles FPV.
    const explore = $('play-fp'); // already present in your header
    if (explore){
      explore.onclick = ()=> toggleFPV(!isFPV);
      explore.title = 'Explore BTC hash in first-person (toggle)';
    }

    // Path toggle in header (if present)
    const pathToggle = $('toggle-path');
    if (pathToggle){
      headerPathBtn = pathToggle;
      pathToggle.onclick = ()=>{
        if (!tube) return;
        const on = !(tube.visible);
        tube.visible = on;
        pathToggle.setAttribute('aria-pressed', String(on));
        pathBtn && pathBtn.setAttribute('aria-pressed', String(on));
      };
    }

    // DO NOT hook fullscreen buttons; they keep their original behavior (fullscreen only).
    // (toggle-fs, mobile-fs-toggle) remain as-is in studio.html.

    // Rebuild tube when new data cloud is produced
    document.addEventListener('quantumi:cloud', ()=> rebuildCurveAndTube());
  }

  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start, 60);
    Q = window.QUANTUMI;
    document.addEventListener('quantumi:tick', (e)=> tick(e.detail.dt));
    document.addEventListener('quantumi:frame', (e)=>{
      const dt = (e?.detail?.dt) ?? 0.016; tick(dt);
    });
    bindKeys();
    bindUI();
  }

  start();
})();

