/* fpv-explore.js — FPV tube-surface locomotion + Xbox + mobile + reliable Path toggle
   Requires: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[])
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, frames=null, tube=null, curveLen=1;

  // FPV state
  let isFPV=false, riding=false;
  let t=0;              // progress along curve [0..1)
  let u=Math.PI;        // angle around tube (radians); PI = "underside" (down)
  let uVel=0, speedEase=0;

  // Remember OrbitControls state to restore on exit
  let prevControlsEnabled = true, prevAutoRotate = undefined;

  // Input
  const move = { fwd:0, lat:0, run:0, jump:false };
  const cfg = {
    // Presence / camera
    camFov: 82, camNear: 0.01,
    // Tube
    tubeRadius: 0.9,
    rideHeight: 0.045,
    buildSegments: 1800,
    pathVisibleOnEnter: true,   // <- set to false if you want hidden-by-default
    // Motion
    baseSpeed: 4.2, runBoost: 1.65, latSpeed: 2.5, lookAhead: 3.6,
    // Circumferential "gravity"
    uGravity: 3.8, jumpKick: 5.0, uDamp: 3.2,
    // Smoothing
    easeRate: 8.5, camPosLerp: 0.5, camRotSlerp: 0.35,
  };

  // HUD
  let hud=null, exitBtn=null, pathBtn=null, rideBtn=null, joy=null;

  // ----- Utilities -----
  function safeStage(){ return $('stagePanel') || document.body; }
  function ease(cur,target,dt){ return cur + (target-cur)*Math.min(1, cfg.easeRate*dt); }

  // ----- Path & Frenet -----
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }

  function rebuildCurveAndTube(){
    const pts = getPathPoints(); if (!pts || pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // Length approximation
    const tmp = curve.getPoints(1000); let L=0; for (let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // Frenet frames (robust normals/binormals)
    const segs = Math.min(cfg.buildSegments, pts.length*6);
    frames = curve.computeFrenetFrames(segs, false);

    // Visual tube (toggleable)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const tubeGeo = new THREE.TubeGeometry(curve, segs, cfg.tubeRadius, 12, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, roughness:0.35, metalness:0.05, transparent:true, opacity:0.42
    });
    tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'HashTube';
    tube.visible = !!cfg.pathVisibleOnEnter;
    Q.scene.add(tube);
    return true;
  }

  function frameAt(tt){
    const segs = frames.tangents.length;
    const i = Math.floor(tt * segs) % segs;
    return {
      T: frames.tangents[i].clone(),
      N: frames.normals[i].clone(),
      B: frames.binormals[i].clone(),
    };
  }

  // ----- Input: keyboard -----
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
      if(k==='y') riding=!riding;
      if(k==='x'){ const m=Q?.scene?.getObjectByName('HashTube'); if (m) m.visible = !m.visible; }
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

  // ----- Input: Xbox via Gamepad API -----
  function pollGamepad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads[0];

    const axX = gp.axes[0]||0, axY = gp.axes[1]||0;
    const dead=0.15;
    move.lat = Math.abs(axX)>dead ? axX : 0;
    move.fwd = Math.abs(axY)>dead ? -axY : 0;  // up is forward
    move.run = (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) ? 1 : 0; // LB/RB

    // A jump
    if (gp.buttons[0]?.pressed) move.jump = true; else move.jump = false;

    // X toggle path (latch)
    if (gp.buttons[2]?.pressed && !pollGamepad._xLatch){
      const m=Q?.scene?.getObjectByName('HashTube'); if (m) m.visible=!m.visible; pollGamepad._xLatch=true;
    }
    if (!gp.buttons[2]?.pressed) pollGamepad._xLatch=false;

    // Y ride
    if (gp.buttons[3]?.pressed && !pollGamepad._yLatch){ riding=!riding; pollGamepad._yLatch=true; }
    if (!gp.buttons[3]?.pressed) pollGamepad._yLatch=false;

    // B exit
    if (gp.buttons[1]?.pressed && !pollGamepad._bLatch){ toggleFPV(false); pollGamepad._bLatch=true; }
    if (!gp.buttons[1]?.pressed) pollGamepad._bLatch=false;
  }

  // ----- HUD (mobile joystick, Exit, Path, Ride) -----
  function buildHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id='fpv-hud';
    Object.assign(root.style,{position:'absolute', inset:'0', pointerEvents:'none', zIndex:30});

    // Exit (safe-area top-left)
    const ex = document.createElement('button');
    ex.textContent='✕';
    Object.assign(ex.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      width:'44px', height:'44px', borderRadius:'12px', background:'rgba(0,0,0,.45)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', pointerEvents:'auto'
    });
    ex.onclick=()=>toggleFPV(false); root.appendChild(ex); exitBtn=ex;

    // Path toggle (top-left under Exit)
    const pb=document.createElement('button'); pb.textContent='Path';
    Object.assign(pb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 60px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    pb.onclick=()=>{ const m=Q?.scene?.getObjectByName('HashTube'); if (m) m.visible=!m.visible; };
    root.appendChild(pb); pathBtn=pb;

    // Ride toggle (top-right)
    const rb=document.createElement('button'); rb.textContent='Ride';
    Object.assign(rb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', right:'calc(env(safe-area-inset-right,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    rb.onclick=()=>{ riding=!riding; }; root.appendChild(rb); rideBtn=rb;

    // Mobile joystick
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
      joyRoot.addEventListener('pointerdown',e=>{touching=true; joyRoot.setPointerCapture(e.pointerId);});
      joyRoot.addEventListener('pointerup',e=>{touching=false; move.fwd=0; move.lat=0; knob.style.left='32px'; knob.style.top='32px';});
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return; const r=joyRoot.getBoundingClientRect();
        const x=Math.max(0,Math.min(120,e.clientX-r.left)), y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60, dy=(y-cy)/60;
        move.fwd = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.4 : 0); // forward bias
        move.lat = (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });
      joy = { root:joyRoot, knob };

      // Jump button
      const jump=document.createElement('button'); jump.textContent='⤒';
      Object.assign(jump.style,{position:'absolute',bottom:'calc(env(safe-area-inset-bottom,0px) + 42px)',right:'calc(env(safe-area-inset-right,0px) + 22px)',
        width:'64px',height:'64px',borderRadius:'999px',background:'rgba(255,255,255,.14)',color:'#fff',border:'1px solid rgba(255,255,255,.2)',fontSize:'28px',pointerEvents:'auto'});
      jump.onclick=()=>{ move.jump=true; setTimeout(()=> move.jump=false, 80); };
      root.appendChild(jump);
    }

    safeStage().appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=exitBtn=pathBtn=rideBtn=joy=null; }

  // ----- QUANTUMI helpers (make path visible on demand) -----
  function exposeHelpers(){
    window.QUANTUMI = window.QUANTUMI || {};
    window.QUANTUMI.functions = window.QUANTUMI.functions || {};
    window.QUANTUMI.functions.showPath = function(){
      const m = window.QUANTUMI?.scene?.getObjectByName('HashTube');
      if (m) m.visible = true;
    };
    window.QUANTUMI.functions.togglePath = function(){
      const m = window.QUANTUMI?.scene?.getObjectByName('HashTube');
      if (m) m.visible = !m.visible;
    };
  }

  // ----- World Builder hook (kept minimal to avoid conflicts) -----
  function classifyPrompt(s=''){ s=s.toLowerCase();
    if(/city|urban|skyscraper|building/.test(s)) return 'city';
    if(/terrain|land|mountain|ground|island|voxel/.test(s)) return 'terrain';
    if(/alien|coral|crystal|sci[- ]?fi|neon/.test(s)) return 'alien';
    return 'grass';
  }
  function wireWorldBuilder(){
    const prompt=$('worldPrompt'), build=$('build-world');
    if (!build) return;
    build.onclick=()=>{ const mode=classifyPrompt(prompt?.value||''); /* call your existing builder here if present */ };
  }

  // ----- Core FPV update (tube surface) -----
  function updateFPV(dt){
    if (!isFPV || !curve || !frames) return;

    // Poll gamepad (if present)
    pollGamepad();

    // Speed easing
    const targetSpeed = (move.fwd||0) * cfg.baseSpeed * (move.run? cfg.runBoost : 1);
    speedEase = ease(speedEase, targetSpeed, dt);

    // Move along path
    t = (t + (speedEase * dt) / curveLen + 1) % 1;

    // Rotate around tube with strafe
    u += (move.lat||0) * cfg.latSpeed * dt;

    // Tube “gravity” pulls u toward PI
    let du = Math.PI - u;
    du = Math.atan2(Math.sin(du), Math.cos(du)); // [-PI,PI]
    uVel += cfg.uGravity * du * dt;

    // Jump adds anti-gravity to climb
    if (move.jump){ uVel -= cfg.jumpKick * Math.sign(du || 1); move.jump = false; }

    // Damping & integrate
    uVel *= Math.exp(-cfg.uDamp * dt);
    u += uVel * dt;

    // Sample curve & frame
    const idxFrame = frameAt(t);
    const pos = curve.getPointAt(t);
    const T = idxFrame.T, N = idxFrame.N, B = idxFrame.B;

    // Radial around tube
    const radial = new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const r = cfg.tubeRadius + cfg.rideHeight;
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

  // ----- Enter/Exit FPV -----
  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;

      // build / rebuild tube & frames
      if (!rebuildCurveAndTube()){ console.warn('FPV: missing path'); isFPV=false; return; }

      // disable OrbitControls + autoRotate during FPV
      if (Q.controls){
        prevControlsEnabled = Q.controls.enabled;
        Q.controls.enabled = false;
        if ('autoRotate' in Q.controls){ prevAutoRotate = Q.controls.autoRotate; Q.controls.autoRotate = false; }
      }

      // start on underside near start
      t = 0; u = Math.PI; uVel = 0; speedEase = 0;

      // fullscreen
      safeStage().requestFullscreen?.().catch(()=>{});
      buildHUD();
    } else {
      // restore controls
      if (Q.controls){
        Q.controls.enabled = prevControlsEnabled;
        if (prevAutoRotate !== undefined) Q.controls.autoRotate = prevAutoRotate;
        Q.controls.update?.();
      }
      document.exitFullscreen?.();
      destroyHUD();
      Object.assign(move, { fwd:0, lat:0, run:0, jump:false });
    }
  }

  // ----- Bindings -----
  function bindUI(){
    const explore=$('play-fp'); if (explore){ explore.onclick=()=> toggleFPV(!isFPV); explore.title='Explore (fullscreen + FPV)'; }
    // Rebuild when new data cloud arrives
    document.addEventListener('quantumi:cloud', ()=> rebuildCurveAndTube());
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
    wireWorldBuilder();
    exposeHelpers();
  }

  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q = window.QUANTUMI;

    // Drive from host render loop
    document.addEventListener('quantumi:tick', (e)=> updateFPV(e.detail.dt || 0.016));
    document.addEventListener('quantumi:frame', (e)=> updateFPV((e?.detail?.dt) ?? 0.016));

    bindKeys(); bindUI();
  }
  start();
})();

