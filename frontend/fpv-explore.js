/* fpv-explore.js — Thin path + TRUE FPS look (mouse, gamepad RS, mobile swipe).
   Requires: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[]).
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1, bounds=null;
  let isFPV=false, pathVisible=false;

  // Surface coordinates: t∈[0..1) along curve, u (radians) around tube
  let t=0, u=Math.PI;

  // Look state (true FPS)
  let yaw=0, pitch=0;                     // radians
  const look = { sens: 0.0018, pitchMin: -1.2, pitchMax: 1.2 };

  // Input state
  const key = new Set();
  const inp = { fwd:0, strafe:0, run:0, jump:false, lookX:0, lookY:0 }; // lookX/Y from RS or touch
  const sm  = { fwd:0, strafe:0 };                                      // smoothed move
  const cfg = {
    camFov: 85, camNear: 0.01,
    radiusMin: 0.12, radiusMax: 0.5,    // hard clamp for thin tube
    radiusScale: 0.012,                 // % of path diagonal
    rideHeight: 0.04,                   // boots offset above surface
    baseSpeed: 3.8, runBoost: 1.5,
    strafeSpeed: 2.2,
    lookAhead: 3.6,
    // smoothing (critically-damped style)
    moveRise: 18.0, moveFall: 18.0,     // higher = snappier
    camPosLerp: 0.5, camRotSlerp: 0.28,
  };

  // HUD refs
  let hud=null, exitBtn=null, pathBtn=null, joy=null, jumpBtn=null;

  // ---------------- Path & thickness ----------------
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }

  function computeBounds(pts){
    const bb = new THREE.Box3(); for (const p of pts) bb.expandByPoint(p);
    return bb;
  }

  function pathRadiusFromBounds(bb){
    const diag = bb.getSize(new THREE.Vector3()).length();
    const r = diag * cfg.radiusScale;
    return Math.max(cfg.radiusMin, Math.min(cfg.radiusMax, r));
  }

  function buildCurveAndTube(){
    const pts = getPathPoints();
    if (!pts || pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // length for speed normalization
    const tmp = curve.getPoints(1200); let L=0; for (let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // bounds & thin radius
    bounds = computeBounds(pts);
    const thinR = pathRadiusFromBounds(bounds);

    // (Re)create tube (hidden unless toggled)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const geo = new THREE.TubeGeometry(curve, Math.min(2400, pts.length*6), thinR, 14, false);
    const mat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, roughness:0.35, metalness:0.05, transparent:true, opacity:0.38
    });
    tube = new THREE.Mesh(geo, mat); tube.name='HashTube'; tube.visible = !!pathVisible;
    Q.scene.add(tube);
    return true;
  }

  // Stable frame at t (avoid flips). Reference up changes if near-parallel.
  function frameAt(t){
    const T = curve.getTangentAt(t).normalize();
    const refUp = Math.abs(T.y) > 0.92 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const N = new THREE.Vector3().crossVectors(refUp, T).normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    return {T,N,B};
  }

  // ---------------- TRUE FPS look: mouse/RS/touch ----------------
  function pointerLock(el){
    el?.addEventListener('click', ()=> {
      if (document.pointerLockElement) return;
      el.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', ()=>{ /* no-op */ });
    window.addEventListener('mousemove', (e)=>{
      if (!isFPV) return;
      if (document.pointerLockElement !== el) return;
      yaw   -= e.movementX * look.sens;
      pitch -= e.movementY * look.sens;
      if (pitch < look.pitchMin) pitch = look.pitchMin;
      if (pitch > look.pitchMax) pitch = look.pitchMax;
    });
  }

  function bindKeyboard(){
    window.addEventListener('keydown', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); key.add(k);
      if (k==='w') inp.fwd =  1;
      if (k==='s') inp.fwd = -1;
      if (k==='a') inp.strafe = -1;
      if (k==='d') inp.strafe =  1;
      if (k==='shift') inp.run = 1;
      if (k===' ') inp.jump = true;       // optional: could add small angular hop
      if (k==='x') setPathVisible(!pathVisible);
      if (k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); key.delete(k);
      if (k==='w' || k==='s') inp.fwd = 0;
      if (k==='a' || k==='d') inp.strafe = 0;
      if (k==='shift') inp.run = 0;
      if (k===' ') inp.jump = false;
    });
  }

  // Gamepad (Xbox)
  const latch = { X:false, B:false };
  function pollPad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads[0];
    const dead=0.12;

    // Left stick = move
    const axX = gp.axes[0] || 0, axY = gp.axes[1] || 0;
    inp.strafe = Math.abs(axX)>dead ? axX : (key.size?inp.strafe:0);
    inp.fwd    = Math.abs(axY)>dead ? -axY : (key.size?inp.fwd:0);

    // Right stick = look
    const lx = gp.axes[2] || 0, ly = gp.axes[3] || 0;
    if (Math.abs(lx)>dead) yaw   -= lx * 0.03;
    if (Math.abs(ly)>dead) {
      pitch -= ly * 0.03;
      if (pitch < look.pitchMin) pitch = look.pitchMin;
      if (pitch > look.pitchMax) pitch = look.pitchMax;
    }

    // Run / Jump
    inp.run = (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) ? 1 : (key.has('shift')?1:0);
    if (gp.buttons[0]?.pressed) inp.jump = true;

    // X = Path toggle
    if (gp.buttons[2]?.pressed && !latch.X){ setPathVisible(!pathVisible); latch.X=true; }
    if (!gp.buttons[2]?.pressed) latch.X=false;

    // B = Exit
    if (gp.buttons[1]?.pressed && !latch.B){ toggleFPV(false); latch.B=true; }
    if (!gp.buttons[1]?.pressed) latch.B=false;
  }

  // Mobile swipe-look + joystick
  function buildHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id='fpv-hud';
    Object.assign(root.style,{position:'absolute', inset:'0', pointerEvents:'none', zIndex:30});

    // Exit (safe area)
    const ex = document.createElement('button'); ex.textContent='✕';
    Object.assign(ex.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      width:'44px', height:'44px', borderRadius:'12px', background:'rgba(0,0,0,.45)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', pointerEvents:'auto'
    });
    ex.onclick=()=>toggleFPV(false); root.appendChild(ex); exitBtn=ex;

    // Path toggle
    const pb=document.createElement('button'); pb.textContent='Path';
    Object.assign(pb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 60px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    pb.onclick=()=> setPathVisible(!pathVisible);
    root.appendChild(pb); pathBtn=pb;

    // Joystick (move)
    if (isTouch){
      const joyRoot=document.createElement('div');
      Object.assign(joyRoot.style,{
        position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 20px)', left:'calc(env(safe-area-inset-left,0px) + 18px)',
        width:'120px', height:'120px', borderRadius:'999px', background:'rgba(255,255,255,.06)',
        border:'1px solid rgba(255,255,255,.12)', touchAction:'none', pointerEvents:'auto'
      });
      const knob=document.createElement('div');
      Object.assign(knob.style,{position:'absolute', width:'56px', height:'56px', borderRadius:'999px', left:'32px', top:'32px', background:'rgba(255,255,255,.22)'});
      joyRoot.appendChild(knob); root.appendChild(joyRoot);
      let touching=false,cx=60,cy=60;
      joyRoot.addEventListener('pointerdown',e=>{touching=true; joyRoot.setPointerCapture(e.pointerId);});
      joyRoot.addEventListener('pointerup',e=>{touching=false; inp.fwd=0; inp.strafe=0; knob.style.left='32px'; knob.style.top='32px';});
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return;
        const r=joyRoot.getBoundingClientRect(); const x=Math.max(0,Math.min(120,e.clientX-r.left)); const y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60, dy=(y-cy)/60;
        inp.fwd   = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.35 : 0);
        inp.strafe= (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });

      // Swipe-look on right half
      let swiping=false, lastX=0, lastY=0;
      root.addEventListener('pointerdown',e=>{
        const rect = root.getBoundingClientRect();
        if (e.clientX > rect.width/2){ swiping=true; lastX=e.clientX; lastY=e.clientY; root.setPointerCapture(e.pointerId); }
      });
      root.addEventListener('pointerup',e=>{ swiping=false; });
      root.addEventListener('pointermove',e=>{
        if (!swiping) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX=e.clientX; lastY=e.clientY;
        yaw   -= dx * 0.003;
        pitch -= dy * 0.003;
        if (pitch < look.pitchMin) pitch = look.pitchMin;
        if (pitch > look.pitchMax) pitch = look.pitchMax;
      });

      joy = {root:joyRoot, knob};
      const jump=document.createElement('button'); jump.textContent='⤒';
      Object.assign(jump.style,{ position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 42px)', right:'calc(env(safe-area-inset-right,0px) + 22px)',
        width:'64px', height:'64px', borderRadius:'999px', background:'rgba(255,255,255,.14)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', fontSize:'28px', pointerEvents:'auto'});
      jump.onclick=()=>{ inp.jump=true; setTimeout(()=> inp.jump=false, 80); };
      root.appendChild(jump); jumpBtn=jump;
    }

    $('stagePanel')?.appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=exitBtn=pathBtn=joy=jumpBtn=null; }

  // Path visibility helpers (also expose to QUANTUMI.functions)
  function setPathVisible(on){
    pathVisible = !!on;
    if (tube) tube.visible = pathVisible;
    pathBtn && pathBtn.setAttribute('aria-pressed', String(pathVisible));
  }
  function exposeHelpers(){
    window.QUANTUMI = window.QUANTUMI || {};
    window.QUANTUMI.functions = window.QUANTUMI.functions || {};
    window.QUANTUMI.functions.showPath   = ()=> setPathVisible(true);
    window.QUANTUMI.functions.hidePath   = ()=> setPathVisible(false);
    window.QUANTUMI.functions.togglePath = ()=> setPathVisible(!pathVisible);
  }

  // ---------------- Movement update (critically damped) ----------------
  function damp(current, target, rate, dt){ return current + (target-current) * Math.min(1, rate*dt); }

  function update(dt){
    if (!isFPV || !curve) return;

    // Poll gamepad each frame
    pollPad();

    // Smooth movement
    sm.fwd    = damp(sm.fwd,    inp.fwd,    (inp.fwd===0?cfg.moveFall:cfg.moveRise), dt);
    sm.strafe = damp(sm.strafe, inp.strafe, (inp.strafe===0?cfg.moveFall:cfg.moveRise), dt);

    // Frame at current t
    const {T,N,B} = frameAt(t);

    // Build a camera-local forward from yaw/pitch, expressed in the path frame
    // Yaw rotates around B (tube “up”), pitch around N (side).
    const yawMat   = new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchMat = new THREE.Matrix4().makeRotationAxis(N, pitch);
    const baseFwd  = T.clone().applyMatrix4(yawMat).applyMatrix4(pitchMat).normalize();

    // Move intent: forward along the *tangent direction component* of baseFwd, strafe around the circumference (N/B plane).
    const fwdAlongT = baseFwd.dot(T);
    const speed = cfg.baseSpeed * (inp.run ? cfg.runBoost : 1);
    t = (t + (sm.fwd * speed * fwdAlongT * dt) / curveLen + 1) % 1;

    // Strafe rotates u around the tube; forward slight auto-align to avoid drift
    u += sm.strafe * cfg.strafeSpeed * dt;

    // Position camera slightly off the surface
    const pos = curve.getPointAt(t);
    const radial = new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const eye = pos.clone().addScaledVector(radial, tube.geometry.parameters.radius + cfg.rideHeight);

    // Look point: go in the baseFwd direction
    const look = pos.clone().addScaledVector(baseFwd, cfg.lookAhead);

    // Camera pose
    const cam = Q.camera;
    if (cam.fov !== cfg.camFov){ cam.fov = cfg.camFov; cam.updateProjectionMatrix(); }
    if (cam.near !== cfg.camNear){ cam.near = cfg.camNear; cam.updateProjectionMatrix(); }
    cam.position.lerp(eye, cfg.camPosLerp);
    const up = radial.clone().cross(T).normalize();
    const m = new THREE.Matrix4().lookAt(eye, look, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, cfg.camRotSlerp);

    Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
  }

  // ---------------- Mode switching ----------------
  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }
      if (!buildCurveAndTube()){ console.warn('FPV: missing path points'); isFPV=false; return; }

      // Start at t=0, underside, reset look
      t=0; u=Math.PI; yaw=0; pitch=0; sm.fwd=0; sm.strafe=0;

      // Fullscreen + pointer lock (desktop)
      const stage = $('stagePanel');
      stage?.requestFullscreen?.().catch(()=>{});
      if (!isTouch) pointerLock(stage);

      buildHUD();
      exposeHelpers();

      // Header Path button (if present)
      $('toggle-path') && ($('toggle-path').onclick = ()=> setPathVisible(!pathVisible));
    } else {
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      document.exitFullscreen?.();
      destroyHUD();
      // Reset inputs
      inp.fwd=inp.strafe=inp.run=0; inp.jump=false; inp.lookX=inp.lookY=0;
    }
  }

  // ---------------- Bindings ----------------
  function bindUI(){
    const explore=$('play-fp'); if (explore){ explore.onclick=()=> toggleFPV(!isFPV); explore.title='Explore (fullscreen + FPV)'; }
    document.addEventListener('quantumi:cloud', ()=>{
      const vis = pathVisible;
      buildCurveAndTube();
      setPathVisible(vis);
    });
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
  }
  function bindKeys(){ bindKeyboard(); }
  function bindFrame(){
    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt || 0.016));
    document.addEventListener('quantumi:frame', (e)=> update((e?.detail?.dt) ?? 0.016));
  }

  function start(){
    if (!window.QUANTUMI?.scene){ setTimeout(start,60); return; }
    Q = window.QUANTUMI;
    bindKeys(); bindUI(); bindFrame();
  }
  start();
})();

