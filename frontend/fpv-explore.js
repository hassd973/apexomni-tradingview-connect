/* fpv-explore.js — FPV tube-surface locomotion + Xbox + mobile + path toggle
   Requirements: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[])
   Mechanics:
   - Player is constrained to the hash tube surface using Frenet frames (t along path, u around circumference).
   - Soft "tube gravity" pulls u toward the underside (PI). Jump adds angular velocity to climb around the tube.
   - Forward/back moves along t; strafe rotates around u; Ride mode glides along t with easing.
   - Xbox controller + keyboard + mobile joystick supported.
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  let Q, curve=null, tube=null, frames=null, curveLen=1;

  // FPV state
  let isFPV=false, riding=false;
  let t=0;                 // progress along curve [0..1)
  let u=Math.PI;           // angle around tube (radians), PI = underside (feet “down”)
  let uVel=0;              // angular velocity for climb/jump
  let speedEase=0;         // easing for forward speed

  // Input
  const move = { fwd:0, lat:0, run:0, jump:false };
  const cfg = {
    // scale & feel
    camFov: 80,            // more heroic scale
    camNear: 0.01,
    tubeRadius: 0.9,       // visual tube radius (hidden by default)
    rideHeight: 0.04,      // offset above surface for camera “boots”
    // motion
    baseSpeed: 4.0, runBoost: 1.7,
    latSpeed: 2.4,
    lookAhead: 3.5,
    // tube “gravity” & jumping (on the circumference)
    uGravity: 3.5,         // pulls u toward PI
    jumpKick: 4.8,         // adds to uVel on jump
    uDamp: 3.0,            // angular damping
    // smoothing
    easeRate: 8.0,         // speed easing
    camPosLerp: 0.5, camRotSlerp: 0.35,
  };

  // HUD
  let hud=null, exitBtn=null, pathBtn=null, rideBtn=null, joy=null;

  // ---------------- Path + Frenet frames ----------------
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }

  function rebuildCurveAndTube(){
    const pts = getPathPoints(); if (!pts || pts.length<3) return false;

    // Build curve
    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // Length
    const tmp = curve.getPoints(1000); let L=0; for(let i=1;i<tmp.length;i++) L+=tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // Frenet frames for robust normals/binormals
    const segs = Math.min(1800, pts.length*6);
    const tubeGeo = new THREE.TubeGeometry(curve, segs, cfg.tubeRadius, 12, false);
    frames = tubeGeo.computeFrenetFrames(segs, false);

    // Visual tube (hidden by default but can be toggled)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    tube = new THREE.Mesh(
      tubeGeo,
      new THREE.MeshStandardMaterial({ color:0x00ff7f, emissive:0x00331c, roughness:0.35, metalness:0.05, transparent:true, opacity:0.42 })
    );
    tube.visible = false; tube.name='HashTube';
    Q.scene.add(tube);
    return true;
  }

  function frameAtT(tt){
    // Get frame index for parameter tt
    const segs = frames.tangents.length;
    const idx = Math.floor(tt * segs) % segs;
    return {
      T: frames.tangents[idx].clone(),
      N: frames.normals[idx].clone(),
      B: frames.binormals[idx].clone(),
    };
  }

  // ---------------- Input: keyboard, gamepad, mobile ----------------
  // Keyboard
  function bindKeys(){
    window.addEventListener('keydown', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if(k==='w') move.fwd= 1;
      if(k==='s') move.fwd=-1;
      if(k==='a') move.lat=-1;
      if(k==='d') move.lat= 1;
      if(k==='shift') move.run= 1;
      if(k===' ') move.jump=true;
      if(k==='y') riding=!riding;         // keyboard toggle (mirrors pad Y)
      if(k==='x') if(tube) tube.visible=!tube.visible;
      if(k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if(k==='w' || k==='s') move.fwd=0;
      if(k==='a' || k==='d') move.lat=0;
      if(k==='shift') move.run=0;
      if(k===' ') move.jump=false;
    });
  }

  // Gamepad (Xbox)
  function pollGamepad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads[0];
    // Axes: LS X/Y
    const axX = gp.axes[0] || 0;                 // left/right (strafe around tube)
    const axY = gp.axes[1] || 0;                 // forward/back
    const dead = 0.15;
    move.lat = Math.abs(axX) > dead ? axX : 0;
    move.fwd = Math.abs(axY) > dead ? -axY : 0;  // invert so up is forward
    // Buttons: 0 A jump, 1 B exit, 2 X path, 3 Y ride, 4 LB run, 5 RB run
    if (gp.buttons[0]?.pressed) move.jump = true; else if (!gp.buttons[0]) move.jump = false;
    if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) move.run = 1; else move.run = 0;
    if (gp.buttons[2]?.pressed && !pollGamepad._xLatch){ if (tube) tube.visible = !tube.visible; pollGamepad._xLatch=true; }
    if (!gp.buttons[2]?.pressed) pollGamepad._xLatch=false;
    if (gp.buttons[3]?.pressed && !pollGamepad._yLatch){ riding = !riding; pollGamepad._yLatch=true; }
    if (!gp.buttons[3]?.pressed) pollGamepad._yLatch=false;
    if (gp.buttons[1]?.pressed && !pollGamepad._bLatch){ toggleFPV(false); pollGamepad._bLatch=true; }
    if (!gp.buttons[1]?.pressed) pollGamepad._bLatch=false;
  }

  // Mobile joystick HUD
  function buildHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id='fpv-hud';
    Object.assign(root.style,{position:'absolute', inset:'0', pointerEvents:'none', zIndex:30});

    const ex = document.createElement('button');
    ex.textContent='✕';
    Object.assign(ex.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      width:'44px', height:'44px', borderRadius:'12px', background:'rgba(0,0,0,.45)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', pointerEvents:'auto'
    });
    ex.onclick=()=>toggleFPV(false); root.appendChild(ex); exitBtn=ex;

    const pb=document.createElement('button'); pb.textContent='Path';
    Object.assign(pb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 60px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    pb.onclick=()=>{ if(tube) tube.visible=!tube.visible; }; root.appendChild(pb); pathBtn=pb;

    const rb=document.createElement('button'); rb.textContent='Ride';
    Object.assign(rb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', right:'calc(env(safe-area-inset-right,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    rb.onclick=()=>{ riding=!riding; }; root.appendChild(rb); rideBtn=rb;

    if (isTouch){
      const joyRoot=document.createElement('div');
      Object.assign(joyRoot.style,{
        position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 20px)', left:'calc(env(safe-area-inset-left,0px) + 18px)',
        width:'120px', height:'120px', borderRadius:'999px', background:'rgba(255,255,255,.06)',
        border:'1px solid rgba(255,255,255,.12)', touchAction:'none', pointerEvents:'auto'
      });
      const knob=document.createElement('div');
      Object.assign(knob.style,{position:'absolute',width:'56px',height:'56px',borderRadius:'999px',left:'32px',top:'32px',
        background:'rgba(255,255,255,.22)'});
      joyRoot.appendChild(knob); root.appendChild(joyRoot);
      let touching=false,cx=60,cy=60;
      joyRoot.addEventListener('pointerdown',e=>{touching=true;joyRoot.setPointerCapture(e.pointerId);});
      joyRoot.addEventListener('pointerup',e=>{touching=false;move.fwd=0;move.lat=0; knob.style.left='32px'; knob.style.top='32px';});
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return;
        const r=joyRoot.getBoundingClientRect(); const x=Math.max(0,Math.min(120,e.clientX-r.left)); const y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60, dy=(y-cy)/60;
        move.fwd = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.4 : 0);
        move.lat = (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });
      joy = { root:joyRoot, knob };
      // Jump & Run buttons (optional; LS-click is not on touch)
      const jump=document.createElement('button'); jump.textContent='⤒';
      Object.assign(jump.style,{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 42px)',right:'calc(env(safe-area-inset-right,0px) + 22px)',
        width:'64px',height:'64px',borderRadius:'999px',background:'rgba(255,255,255,.14)',color:'#fff',border:'1px solid rgba(255,255,255,.2)',fontSize:'28px',pointerEvents:'auto'});
      jump.onclick=()=>{ move.jump=true; setTimeout(()=> move.jump=false, 80); };
      root.appendChild(jump);
    }

    $('stagePanel')?.appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=exitBtn=pathBtn=rideBtn=joy=null; }

  // ---------------- World Builder (hook only; keep existing behavior) ----------------
  function classifyPrompt(s=''){ s=s.toLowerCase();
    if(/city|urban|skyscraper|building/.test(s)) return 'city';
    if(/terrain|land|mountain|ground|island|voxel/.test(s)) return 'terrain';
    if(/alien|coral|crystal|sci[- ]?fi|neon/.test(s)) return 'alien';
    return 'grass';
  }
  function buildWorldFromPoints(mode){
    // If your project already had world generation, keep that; this function remains a no-op unless wired by your UI.
    // (We avoid conflicting with your existing generator; fpv module is about traversal.)
  }

  // ---------------- Core locomotion on tube surface ----------------
  function ease(cur,target,dt){ return cur + (target-cur)*Math.min(1, cfg.easeRate*dt); }

  function updateFPV(dt){
    // Gamepad poll (if present)
    pollGamepad();

    // Smooth forward speed for ride feel
    const targetSpeed = (move.fwd||0) * cfg.baseSpeed * (move.run? cfg.runBoost : 1);
    speedEase = ease(speedEase, targetSpeed, dt);

    // Move along path
    if (curve){
      t = (t + (speedEase * dt) / curveLen + 1) % 1;
      // Side movement: rotate around tube (lat controls u)
      const lat = (move.lat||0) * cfg.latSpeed;
      u += lat * dt;

      // “Tube gravity”: pull u toward PI (underside)
      let du = (Math.PI - u); // signed shortest angular difference
      du = Math.atan2(Math.sin(du), Math.cos(du)); // wrap to [-PI,PI]
      uVel += cfg.uGravity * du * dt;

      // Jump adds angular velocity opposite gravity (i.e., climb)
      if (move.jump){ uVel -= cfg.jumpKick * Math.sign(du || 1); move.jump=false; }

      // Damping & integrate
      uVel *= Math.exp(-cfg.uDamp * dt);
      u += uVel * dt;

      // Sample curve & frame
      const pos = curve.getPointAt(t);
      const {T,N,B} = frameAtT(t);

      // Position slightly above surface for boots
      const r = cfg.tubeRadius + cfg.rideHeight;
      const radial = new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
      const eye = pos.clone().addScaledVector(radial, r);

      // Look ahead
      const look = curve.getPointAt((t + (cfg.lookAhead/curveLen)) % 1);

      // Camera — big presence feel
      if (Q.camera){
        if (Q.camera.fov !== cfg.camFov){ Q.camera.fov = cfg.camFov; Q.camera.updateProjectionMatrix(); }
        if (Q.camera.near !== cfg.camNear){ Q.camera.near = cfg.camNear; Q.camera.updateProjectionMatrix(); }
        Q.camera.position.lerp(eye, cfg.camPosLerp);
        const m = new THREE.Matrix4().lookAt(eye, look, radial.clone().cross(T).normalize()); // natural up around tube
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        Q.camera.quaternion.slerp(q, cfg.camRotSlerp);
      }
      Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
    }
  }

  // ---------------- Mode switch & bindings ----------------
  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      // stop any auto-rotation & disable OrbitControls
      if (Q.controls){ Q.controls.enabled = false; if ('autoRotate' in Q.controls) Q.controls.autoRotate = false; }
      // build path & frames & visual tube
      if (!rebuildCurveAndTube()){ console.warn('FPV: missing path'); isFPV=false; return; }
      // start on underside near start
      t = 0; u = Math.PI; uVel = 0; speedEase = 0;
      // fullscreen
      $('stagePanel')?.requestFullscreen?.().catch(()=>{});
      // HUD
      buildHUD();
    } else {
      // restore camera defaults
      if (Q.controls){ Q.controls.enabled = true; Q.controls.update?.(); }
      document.exitFullscreen?.();
      destroyHUD();
      // reset input
      Object.assign(move, {fwd:0, lat:0, run:0, jump:false});
    }
  }

  function bindUI(){
    const explore=$('play-fp'); if (explore){ explore.onclick=()=> toggleFPV(!isFPV); explore.title='Explore (fullscreen + FPV)'; }
    // world builder hook if present
    const prompt=$('worldPrompt'), build=$('build-world');
    if (build){ build.onclick=()=>{ const mode=classifyPrompt(prompt?.value||''); buildWorldFromPoints(mode); }; }

    // Rebuild on new data
    document.addEventListener('quantumi:cloud', ()=> rebuildCurveAndTube());
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
  }

  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q = window.QUANTUMI;

    // per-frame drive from host
    document.addEventListener('quantumi:tick', (e)=> updateFPV(e.detail.dt || 0.016));
    document.addEventListener('quantumi:frame', (e)=> updateFPV((e?.detail?.dt) ?? 0.016));

    bindKeys(); bindUI();
  }
  start();
})();

