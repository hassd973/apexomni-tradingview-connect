/* fpv-explore.js — One-button FPV hash explorer with mobile joystick
   Requires: window.THREE, window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[])
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);

  let Q;
  let tube=null, curve=null, curveLen=1;
  let runnerT = 0;               // normalized [0..1)
  let playerY = 0;               // jump/bob offset
  let velY = 0;                  // vertical velocity for jumps
  let isExploring = false;

  // Movement state
  const move = { f:0, b:0, l:0, r:0, run:0 };
  const kbd = new Set();

  // Tunables
  const cfg = {
    tubeRadius: 0.07,
    speed: 2.2,          // base m/s along curve
    runBoost: 1.7,
    strafeSpeed: 1.4,    // lateral drift along binormal
    jumpVel: 3.0,
    gravity: 9.0,
    damping: 8.0,
    eyeHeight: 0.12,     // above curve point
    lookAhead: 2.5,      // meters ahead for look
  };

  // Joystick (mobile)
  let joy=null, jumpBtn=null, exitBtn=null, hud=null;
  function buildMobileHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id = 'fpv-hud';
    Object.assign(root.style,{
      position:'absolute', inset:'0', pointerEvents:'none', zIndex:30,
      fontFamily:'inherit', color:'var(--fg,white)'
    });

    // Joystick ring
    const joyRoot = document.createElement('div');
    Object.assign(joyRoot.style,{
      position:'absolute', bottom:'20px', left:'18px', width:'120px', height:'120px',
      borderRadius:'999px', background:'rgba(255,255,255,.06)',
      border:'1px solid rgba(255,255,255,.12)', touchAction:'none', pointerEvents:'auto'
    });
    const knob = document.createElement('div');
    Object.assign(knob.style,{
      position:'absolute', width:'56px', height:'56px', borderRadius:'999px',
      left:'32px', top:'32px', background:'rgba(255,255,255,.22)'
    });
    joyRoot.appendChild(knob);

    // Jump button
    const j = document.createElement('button');
    j.textContent = '⤒';
    Object.assign(j.style,{
      position:'absolute', bottom:'42px', right:'22px', width:'64px', height:'64px',
      borderRadius:'999px', background:'rgba(255,255,255,.14)', color:'white',
      border:'1px solid rgba(255,255,255,.2)', fontSize:'28px', pointerEvents:'auto'
    });

    // Exit
    const x = document.createElement('button');
    x.textContent = '✕';
    Object.assign(x.style,{
      position:'absolute', top:'14px', right:'14px', width:'44px', height:'44px',
      borderRadius:'12px', background:'rgba(0,0,0,.35)', color:'white',
      border:'1px solid rgba(255,255,255,.15)', fontSize:'18px', pointerEvents:'auto'
    });

    root.appendChild(joyRoot); root.appendChild(j); root.appendChild(x);
    $('stagePanel')?.appendChild(root);
    hud = root;

    // Joystick logic
    let touching=false, cx=60, cy=60;
    function setKnob(x,y){ knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px'; }
    joyRoot.addEventListener('pointerdown',e=>{ touching=true; joyRoot.setPointerCapture(e.pointerId); });
    joyRoot.addEventListener('pointerup',e=>{ touching=false; move.f=move.b=move.l=move.r=0; setKnob(cx,cy); });
    joyRoot.addEventListener('pointermove',e=>{
      if(!touching) return;
      const r = joyRoot.getBoundingClientRect();
      const x = Math.max(0, Math.min(120, e.clientX - r.left));
      const y = Math.max(0, Math.min(120, e.clientY - r.top));
      setKnob(x,y);
      const dx = (x-cx)/60, dy = (y-cy)/60;
      move.f = (-dy>0 ? -dy : 0);
      move.b = (dy>0 ? dy : 0);
      move.r = (dx>0 ? dx : 0);
      move.l = (-dx>0 ? -dx : 0);
    });

    // buttons
    j.addEventListener('click', ()=> tryJump());
    x.addEventListener('click', ()=> exitExplore());

    joy = { root:joyRoot, knob };
    jumpBtn = j; exitBtn = x;
  }

  // Desktop helpers
  function bindKeys(){
    window.addEventListener('keydown', (e)=>{
      if (!isExploring) return;
      if (['INPUT','TEXTAREA'].includes((document.activeElement?.tagName||''))) return;
      const k = e.key.toLowerCase();
      if (k==='w') move.f = 1;
      if (k==='s') move.b = 1;
      if (k==='a') move.l = 1;
      if (k==='d') move.r = 1;
      if (k==='shift') move.run = 1;
      if (k===' ') tryJump();
      if (k==='escape') exitExplore();
      kbd.add(k);
    });
    window.addEventListener('keyup', (e)=>{
      if (!isExploring) return;
      const k = e.key.toLowerCase();
      if (k==='w') move.f = 0;
      if (k==='s') move.b = 0;
      if (k==='a') move.l = 0;
      if (k==='d') move.r = 0;
      if (k==='shift') move.run = 0;
      kbd.delete(k);
    });
  }

  function tryJump(){
    // simple: only allow when "on curve"
    if (Math.abs(playerY) < 0.02) velY = cfg.jumpVel;
  }

  function buildCurveAndTube(){
    const pts = (window.QUANTUMI?.path)||[];
    if (!pts || pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.25);
    // length approximation
    const samples = curve.getPoints(800);
    let L=0; for(let i=1;i<samples.length;i++) L += samples[i-1].distanceTo(samples[i]);
    curveLen = Math.max(1e-3, L);

    // tube visual
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(1600, pts.length*6), cfg.tubeRadius, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, transparent:true, opacity:0.88, roughness:0.35, metalness:0.05
    });
    tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'HashTube';
    Q.scene.add(tube);
    return true;
  }

  function enterFullscreen(target){
    if (!target) return;
    const el = target;
    if (el.requestFullscreen) el.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
    // iOS WebKit fallback is handled by CSS/screen real-estate; we still proceed.
  }

  function exitFullscreen(){
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }

  function enterExplore(){
    if (isExploring) return;
    if (!Q) Q = window.QUANTUMI;

    // Build curve + tube
    if (!buildCurveAndTube()){
      console.warn('FPV: No path points yet.');
      return;
    }

    // Put player on the curve start
    runnerT = 0;
    playerY = 0; velY = 0;

    // Disable OrbitControls while in FPV
    if (Q.controls) Q.controls.enabled = false;

    // Fullscreen stage
    const stage = $('stagePanel');
    enterFullscreen(stage);

    // Mobile HUD
    buildMobileHUD();

    // Pointer lock on desktop if available
    if (stage?.requestPointerLock) {
      stage.requestPointerLock = stage.requestPointerLock || stage.mozRequestPointerLock;
      stage.addEventListener('click', requestPointer, { once:true });
    }

    // A tiny hint overlay (auto fades)
    showHint('FPV: W/S move along hash • Space jump • Shift run • Esc exit');

    isExploring = true;
  }

  function requestPointer(){
    const stage = $('stagePanel');
    stage?.requestPointerLock?.();
  }

  function exitExplore(){
    if (!isExploring) return;
    isExploring = false;

    if (Q && Q.controls){ Q.controls.enabled = true; Q.controls.update?.(); }
    exitFullscreen();

    // Remove HUD
    if (hud && hud.parentNode){ hud.parentNode.removeChild(hud); hud=null; joy=null; jumpBtn=null; exitBtn=null; }

    // Keep the tube; or remove — we keep for context
  }

  function showHint(text){
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style,{
      position:'absolute', top:'16px', left:'16px', padding:'8px 12px', borderRadius:'10px',
      background:'rgba(0,0,0,.5)', color:'#fff', fontSize:'12px', letterSpacing:'.3px',
      pointerEvents:'none', zIndex:31, opacity:'1', transition:'opacity .6s ease'
    });
    $('stagePanel')?.appendChild(el);
    setTimeout(()=> el.style.opacity='0', 3200);
    setTimeout(()=> el.remove(), 4200);
  }

  // Main per-frame
  function tick(dt){
    if (!isExploring || !curve) return;

    // Move along the curve using W/S + run boost
    const forward = move.f - move.b;
    const lateral = move.r - move.l;
    const speed = cfg.speed * (move.run? cfg.runBoost : 1);

    runnerT = (runnerT + (forward * speed * dt) / curveLen + 1) % 1;

    // Jump/gravity
    velY -= cfg.gravity * dt;
    playerY += velY * dt;
    // Snap back to path when "landing"
    if (playerY < 0){ playerY = 0; velY = 0; }

    // Sample curve
    const pos = curve.getPointAt(runnerT);
    const tan = curve.getTangentAt(runnerT).normalize();
    const up  = new THREE.Vector3(0,1,0);

    // A simple side vector using Frenet frame-ish approach
    const side = new THREE.Vector3().crossVectors(tan, up).normalize();

    // Lateral drift around the tube
    const lat = lateral * cfg.strafeSpeed;
    const eye = pos.clone()
      .add(up.clone().multiplyScalar(cfg.eyeHeight + playerY))
      .add(side.multiplyScalar(lat * 0.4));

    // Look ahead along the curve
    const ahead = curve.getPointAt((runnerT + (cfg.lookAhead/curveLen)) % 1);
    const look = new THREE.Vector3().lerpVectors(eye, ahead, 1.0);

    // Apply camera
    const cam = Q.camera;
    cam.position.lerp(eye, 0.45);
    const m = new THREE.Matrix4().lookAt(eye, look, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, 0.35);

    // If OrbitControls exist (disabled), keep target in front for smooth return
    if (Q.controls){ Q.controls.target.copy(look); Q.controls.update?.(); }
  }

  function bindUI(){
    // Rebuild path whenever a new cloud is drawn
    document.addEventListener('quantumi:cloud', ()=> buildCurveAndTube());

    // Use your existing Explore & fullscreen buttons if present
    const exploreBtn = $('play-fp');
    if (exploreBtn){
      exploreBtn.onclick = ()=> enterExplore();
      exploreBtn.title = 'Explore the BTC hash in first-person';
    }

    // Also let the small mobile fullscreen button start explore for one-tap UX
    const mobileFs = $('mobile-fs-toggle');
    if (mobileFs){
      mobileFs.onclick = ()=> enterExplore();
      mobileFs.title = 'Explore hash (full screen)';
    }

    // Safety: exit FPV when page loses visibility to avoid “stuck” controls
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) exitExplore(); });

    // Keyboard bindings
    bindKeys();
  }

  function start(){
    if (!window.QUANTUMI || !window.THREE) return;
    Q = window.QUANTUMI;

    // Build once if we already have a path
    buildCurveAndTube();

    // Listen for dt from host; also a fallback frame event
    document.addEventListener('quantumi:tick', (e)=> tick(e.detail.dt));
    document.addEventListener('quantumi:frame', (e)=>{
      const dt = (e?.detail?.dt) ?? 0.016;
      tick(dt);
    });

    bindUI();
  }

  // Boot when QUANTUMI is ready
  function wait(){ if (window.QUANTUMI?.scene) start(); else setTimeout(wait, 60); }
  wait();
})();
