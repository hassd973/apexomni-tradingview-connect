/* fpv-explore.js — FPV tube-surface locomotion + Xbox + mobile + robust Path toggle
   Requires: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[])
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1;
  let isFPV=false, pathVisible=false;

  // Tube-surface coordinates: t along the path [0..1), u around circumference (radians)
  let t=0, u=Math.PI, uVel=0, speedEase=0;

  // Input (aggregated)
  const input = { fwd:0, lat:0, run:0, jump:false };
  const keyState = new Set();

  // Config for feel/scale
  const cfg = {
    camFov: 85, camNear: 0.01,
    tubeRadius: 1.1,     // visual tube radius (hash feels massive)
    rideHeight: 0.06,    // “boot” offset above surface
    baseSpeed: 4.2, runBoost: 1.65, latSpeed: 2.6,
    lookAhead: 3.8,
    // angular “gravity” on the tube (pull to underside), and jump/climb
    uGravity: 3.8, uDamp: 3.2, jumpKick: 5.1,
    // smoothing
    easeRate: 8.5, camPosLerp: 0.5, camRotSlerp: 0.35,
  };

  // HUD refs
  let hud=null, exitBtn=null, pathBtn=null, rideBtn=null, joy=null;

  // ---------- Helpers ----------
  function angleDelta(a,b){ // shortest signed angle from a -> b
    let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d;
  }

  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }

  function buildCurveAndTube(){
    const pts = getPathPoints();
    if (!pts || pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // approximate length
    const tmp = curve.getPoints(1000); let L=0; for (let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // (Re)create visual tube (hidden by default unless pathVisible is true)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const geo = new THREE.TubeGeometry(curve, Math.min(2000, pts.length*6), cfg.tubeRadius, 14, false);
    const mat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, roughness:0.35, metalness:0.05, transparent:true, opacity:0.48
    });
    tube = new THREE.Mesh(geo, mat); tube.name='HashTube'; tube.visible = !!pathVisible;
    Q.scene.add(tube);
    return true;
  }

  // Robust N,B given T using a reference up that avoids near-parallel cases
  function computeFrameTNB(tt){
    const T = curve.getTangentAt(tt).normalize();
    const refUp = Math.abs(T.y) > 0.95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const N = new THREE.Vector3().crossVectors(refUp, T).normalize(); // “side”
    const B = new THREE.Vector3().crossVectors(T, N).normalize();     // “up” around tube
    return {T,N,B};
  }

  // ---------- Input systems ----------
  function bindKeyboard(){
    window.addEventListener('keydown', (e)=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); keyState.add(k);
      if (k==='w') input.fwd= 1;
      if (k==='s') input.fwd=-1;
      if (k==='a') input.lat=-1;
      if (k==='d') input.lat= 1;
      if (k==='shift') input.run=1;
      if (k===' ') input.jump=true;
      if (k==='x'){ setPathVisible(!pathVisible); }        // Path toggle
      if (k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', (e)=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); keyState.delete(k);
      if (k==='w' || k==='s') input.fwd=0;
      if (k==='a' || k==='d') input.lat=0;
      if (k==='shift') input.run=0;
      if (k===' ') input.jump=false;
    });
  }

  // Xbox / Gamepad
  const padLatch = { X:false, B:false };
  function pollGamepad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads[0];
    const dead=0.15;
    const axX = gp.axes[0] || 0, axY = gp.axes[1] || 0;
    if (Math.abs(axX)>dead) input.lat = axX; else if (!keyState.size && !joy) input.lat = 0;
    if (Math.abs(axY)>dead) input.fwd = -axY; else if (!keyState.size && !joy) input.fwd = 0;
    input.run = (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) ? 1 : (input.run && keyState.has('shift') ? 1 : 0);
    input.jump = gp.buttons[0]?.pressed || input.jump;

    // X toggles Path
    if (gp.buttons[2]?.pressed && !padLatch.X){ setPathVisible(!pathVisible); padLatch.X=true; }
    if (!gp.buttons[2]?.pressed) padLatch.X=false;

    // B exits FPV
    if (gp.buttons[1]?.pressed && !padLatch.B){ toggleFPV(false); padLatch.B=true; }
    if (!gp.buttons[1]?.pressed) padLatch.B=false;
  }

  // Mobile joystick HUD
  function buildHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id='fpv-hud'; Object.assign(root.style,{position:'absolute', inset:'0', pointerEvents:'none', zIndex:30});

    // Exit (top-left, safe area)
    const ex = document.createElement('button'); ex.textContent='✕';
    Object.assign(ex.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      width:'44px', height:'44px', borderRadius:'12px', background:'rgba(0,0,0,.45)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', pointerEvents:'auto'
    });
    ex.onclick=()=>toggleFPV(false); root.appendChild(ex); exitBtn=ex;

    // Path toggle (under Exit)
    const pb=document.createElement('button'); pb.textContent='Path';
    Object.assign(pb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 60px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    pb.onclick=()=> setPathVisible(!pathVisible);
    root.appendChild(pb); pathBtn=pb;

    // Ride info (top-right). We keep “always-on walk” here; Ride can be added later if needed.
    const rb=document.createElement('div');
    rb.textContent='Walk mode'; Object.assign(rb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 12px)', right:'calc(env(safe-area-inset-right,0px) + 12px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'none', fontSize:'12px'
    });
    root.appendChild(rb); rideBtn=rb;

    // Joystick + Jump (mobile only)
    if (isTouch){
      const joyRoot=document.createElement('div');
      Object.assign(joyRoot.style,{
        position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 20px)', left:'calc(env(safe-area-inset-left,0px) + 18px)',
        width:'120px', height:'120px', borderRadius:'999px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)',
        touchAction:'none', pointerEvents:'auto'
      });
      const knob=document.createElement('div');
      Object.assign(knob.style,{position:'absolute', width:'56px', height:'56px', borderRadius:'999px', left:'32px', top:'32px', background:'rgba(255,255,255,.22)'});
      joyRoot.appendChild(knob); root.appendChild(joyRoot);
      let touching=false, cx=60, cy=60;
      joyRoot.addEventListener('pointerdown',e=>{ touching=true; joyRoot.setPointerCapture(e.pointerId); });
      joyRoot.addEventListener('pointerup',e=>{ touching=false; input.fwd=0; input.lat=0; knob.style.left='32px'; knob.style.top='32px'; });
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return;
        const r=joyRoot.getBoundingClientRect();
        const x=Math.max(0,Math.min(120,e.clientX-r.left)); const y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60, dy=(y-cy)/60;
        input.fwd = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.35 : 0);
        input.lat = (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });
      joy = { root:joyRoot, knob };

      const jump=document.createElement('button'); jump.textContent='⤒';
      Object.assign(jump.style,{ position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 42px)', right:'calc(env(safe-area-inset-right,0px) + 22px)',
        width:'64px', height:'64px', borderRadius:'999px', background:'rgba(255,255,255,.14)', color:'#fff',
        border:'1px solid rgba(255,255,255,.2)', fontSize:'28px', pointerEvents:'auto' });
      jump.onclick=()=>{ input.jump=true; setTimeout(()=> input.jump=false, 80); };
      root.appendChild(jump);
    }

    $('stagePanel')?.appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=exitBtn=pathBtn=rideBtn=joy=null; }

  // ---------- Path visibility helpers (exposed) ----------
  function setPathVisible(on){
    pathVisible = !!on;
    if (tube) tube.visible = pathVisible;
    if (pathBtn) pathBtn.setAttribute('aria-pressed', String(pathVisible));
  }

  function ensureQUANTUMIHelpers(){
    window.QUANTUMI = window.QUANTUMI || {};
    window.QUANTUMI.functions = window.QUANTUMI.functions || {};
    // Show path programmatically from console or other UI
    window.QUANTUMI.functions.showPath = function(){ setPathVisible(true); };
    window.QUANTUMI.functions.hidePath = function(){ setPathVisible(false); };
    window.QUANTUMI.functions.togglePath = function(){ setPathVisible(!pathVisible); };
  }

  // ---------- FPV update ----------
  function ease(cur,target,dt){ return cur + (target-cur)*Math.min(1, cfg.easeRate*dt); }

  function update(dt){
    if (!isFPV || !curve) return;

    // Merge inputs with gamepad each frame
    pollGamepad();

    // Speed easing (forward/back)
    const targetSpeed = (input.fwd||0) * cfg.baseSpeed * (input.run? cfg.runBoost : 1);
    speedEase = ease(speedEase, targetSpeed, dt);

    // Integrate along path
    t = (t + (speedEase * dt) / curveLen + 1) % 1;

    // Lateral rotate around tube
    const lat = (input.lat||0) * cfg.latSpeed; u += lat * dt;

    // Tube “gravity” toward underside (u = PI)
    const du = angleDelta(u, Math.PI);
    uVel += cfg.uGravity * (-du) * dt;

    // Jump/climb adds angular impulse away from underside
    if (input.jump){ uVel += cfg.jumpKick * Math.sign(-du || 1); input.jump=false; }

    // Damping and integrate
    uVel *= Math.exp(-cfg.uDamp * dt);
    u += uVel * dt;

    // Sample curve & frame
    const pos = curve.getPointAt(t);
    const {T,N,B} = computeFrameTNB(t);

    // Position eye slightly above surface
    const r = cfg.tubeRadius + cfg.rideHeight;
    const radial = new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const eye = pos.clone().addScaledVector(radial, r);

    // Look ahead
    const look = curve.getPointAt((t + (cfg.lookAhead/curveLen)) % 1);

    // Camera
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

  // ---------- Mode switch ----------
  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;

    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      // Stop auto-rotate & disable controls
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }

      if (!buildCurveAndTube()){ console.warn('FPV: missing path points'); isFPV=false; return; }

      // Start state
      t = 0; u = Math.PI; uVel = 0; speedEase = 0;

      // Fullscreen stage
      $('stagePanel')?.requestFullscreen?.().catch(()=>{});

      // HUD + helpers
      buildHUD();
      ensureQUANTUMIHelpers();

      // Also wire a header #toggle-path button if present
      const headerBtn = $('toggle-path');
      if (headerBtn){
        headerBtn.onclick = ()=> setPathVisible(!pathVisible);
        headerBtn.setAttribute('aria-pressed', String(pathVisible));
      }
    } else {
      // Restore controls
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      document.exitFullscreen?.();
      destroyHUD();
      // reset input
      input.fwd=0; input.lat=0; input.run=0; input.jump=false;
    }
  }

  // ---------- Bindings ----------
  function bindUI(){
    const explore=$('play-fp');
    if (explore){
      explore.onclick = ()=> toggleFPV(!isFPV);
      explore.title = 'Explore (fullscreen + FPV)';
    }

    // Rebuild path when new cloud is produced
    document.addEventListener('quantumi:cloud', ()=>{
      const vis = pathVisible;
      buildCurveAndTube();
      setPathVisible(vis);
    });

    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
  }

  function bindFrame(){
    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt || 0.016));
    document.addEventListener('quantumi:frame', (e)=> update((e?.detail?.dt) ?? 0.016));
  }

  function start(){
    if (!window.QUANTUMI?.scene){ setTimeout(start,60); return; }
    Q = window.QUANTUMI;
    bindKeyboard(); bindUI(); bindFrame();
  }
  start();
})();
