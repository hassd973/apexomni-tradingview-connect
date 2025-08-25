/* fpv-explore.js — Ridge Glide FPV
   - Smooth, critically-damped camera + inputs (mobile swipe-look, joystick).
   - Constrained "ridge" traversal: stay on the top of the BTC hash tube.
   - Extra clearance keeps camera out of dense point clouds (less overdraw = smoother).
   - Robust fullscreen; UI buttons unaffected.
*/
const THREE = window.THREE;
(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1, bounds=null;
  let isFPV=false, pathVisible=false;

  // Path coords and look
  let t=0, u=0.0;               // u≈0 = ridge (top). We keep it near 0.
  let yaw=0, pitch=0;           // current
  let tyaw=0, tpitch=0;         // targets for smoothing
  const inp = { fwd:0, strafe:0, run:0 };

  // Timing smoothing
  let prevDt=0.016;

  const cfg = {
    fov: 84, sens: 0.0016, invertY: false,
    radiusMin: 0.12, radiusMax: 0.38, radiusScale: 0.012,
    rideHeight: 0.05,           // small boot height
    lookAhead: 3.8,
    baseSpeed: 4.2, runBoost: 1.55, strafeSpeed: 1.8,
    camPosLerp: 0.55, camRotSlerp: 0.28,
    // Glide constraints (stay on ridge)
    bankMax: 0.55,              // |u| ≤ bankMax
    bankElastic: 6.0,           // pull back toward 0
    bankDamp: 8.0,              // damp angular motion
    clearance: 0.28,            // extra lift above tube radius to stay out of clouds
    // Filters
    lookSlew: 10.0,             // how fast yaw/pitch reach their targets
    dtBlend: 0.25               // blend real dt with previous to stabilize updates
  };

  // ---------- helpers ----------
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }
  function computeBounds(pts){ const bb=new THREE.Box3(); pts.forEach(p=>bb.expandByPoint(p)); return bb; }
  function radiusAuto(bb){ const d=bb.getSize(new THREE.Vector3()).length(); return Math.max(cfg.radiusMin, Math.min(cfg.radiusMax, d*cfg.radiusScale)); }

  function buildCurveAndTube(){
    const pts = getPathPoints(); if (!pts || pts.length<3) return false;
    curve = new THREE.CatmullRomCurve3(pts,false,'centripetal',.25);
    const tmp=curve.getPoints(1000); let L=0; for (let i=1;i<tmp.length;i++) L+=tmp[i-1].distanceTo(tmp[i]);
    curveLen=Math.max(1e-3,L);
    bounds = computeBounds(pts);

    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const r = radiusAuto(bounds);
    const geo=new THREE.TubeGeometry(curve, Math.min(2000, pts.length*6), r, 14, false);
    const mat=new THREE.MeshStandardMaterial({ color:0x00ff98, emissive:0x00331c, transparent:true, opacity:0.34, roughness:0.35, metalness:0.05 });
    tube=new THREE.Mesh(geo,mat); tube.name='HashTube'; tube.visible=pathVisible; Q.scene.add(tube);
    return true;
  }

  function frameAt(tt){
    const T=curve.getTangentAt(tt).normalize();
    const refUp=Math.abs(T.y)>0.92? new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const N=new THREE.Vector3().crossVectors(refUp,T).normalize();  // "right"
    const B=new THREE.Vector3().crossVectors(T,N).normalize();      // "up" around tube
    return {T,N,B};
  }

  // ---------- fullscreen (robust) ----------
  function fsActive(stage){ return document.fullscreenElement===stage || document.webkitFullscreenElement===stage || stage.classList.contains('fs-fallback'); }
  async function enterFS(stage){
    try{
      if (stage.requestFullscreen) await stage.requestFullscreen({ navigationUI:'hide' });
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
      else throw 0;
      stage.classList.add('fs-active');
    }catch{
      stage.classList.add('fs-active','fs-fallback'); document.body.classList.add('fs-noscroll');
    }
  }
  async function exitFS(stage){
    try{ if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }catch{}
    stage.classList.remove('fs-active','fs-fallback'); document.body.classList.remove('fs-noscroll');
  }

  // ---------- inputs & HUD ----------
  function enablePointerLock(el){
    el?.addEventListener('click', ()=>{ if (!document.pointerLockElement) el.requestPointerLock?.(); }, {capture:true});
    window.addEventListener('mousemove', (e)=>{
      if (!isFPV || document.pointerLockElement!==el) return;
      tyaw   -= e.movementX * cfg.sens;
      const inv = cfg.invertY? -1 : 1;
      tpitch -= e.movementY * cfg.sens * inv;
      tpitch = Math.max(-1.1, Math.min(1.1, tpitch));
    });
  }
  function bindKeys(){
    window.addEventListener('keydown', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if (k==='w'||k==='arrowup')    inp.fwd= 1;
      if (k==='s'||k==='arrowdown')  inp.fwd=-1;
      if (k==='a'||k==='arrowleft')  inp.strafe=-1;
      if (k==='d'||k==='arrowright') inp.strafe= 1;
      if (k==='shift') inp.run=1;
      if (k==='x') setPathVisible(!pathVisible);
      if (k==='escape') toggle(false);
    });
    window.addEventListener('keyup', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if (k==='w'||k==='s'||k==='arrowup'||k==='arrowdown') inp.fwd=0;
      if (k==='a'||k==='d'||k==='arrowleft'||k==='arrowright') inp.strafe=0;
      if (k==='shift') inp.run=0;
    });
  }

  let hud=null;
  function mountHUD(){
    if (hud) return;
    hud=document.createElement('div'); hud.id='fpv-hud'; hud.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:9999;';
    const mk=(txt,style,cls='')=>{ const b=document.createElement('button'); b.textContent=txt; b.className=cls; b.style.cssText='pointer-events:auto;border:1px solid rgba(255,255,255,.12);background:rgba(15,17,20,.55);color:#fff;border-radius:12px;padding:10px 12px;font:12px system-ui;'+style; return b; };
    const exit = mk('✕','position:absolute;top:12px;left:12px;'); exit.onclick=()=>toggle(false);
    const path = mk('Path','position:absolute;top:60px;left:12px;'); path.onclick=()=> setPathVisible(!pathVisible);
    hud.appendChild(exit); hud.appendChild(path);

    if (isTouch){
      // joystick
      const joy=document.createElement('div');
      joy.style.cssText='position:absolute;bottom:26px;left:18px;width:132px;height:132px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);pointer-events:auto;';
      const knob=document.createElement('div'); knob.style.cssText='position:absolute;left:37px;top:37px;width:58px;height:58px;border-radius:999px;background:rgba(255,255,255,.22);';
      joy.appendChild(knob); hud.appendChild(joy);
      let touching=false,cx=66,cy=66;
      joy.addEventListener('pointerdown',e=>{touching=true;joy.setPointerCapture(e.pointerId);});
      joy.addEventListener('pointerup',e=>{touching=false;inp.fwd=inp.strafe=0;knob.style.left='37px';knob.style.top='37px';});
      joy.addEventListener('pointermove',e=>{
        if(!touching) return; const r=joy.getBoundingClientRect();
        const x=Math.max(0,Math.min(132,e.clientX-r.left)); const y=Math.max(0,Math.min(132,e.clientY-r.top));
        knob.style.left=(x-29)+'px'; knob.style.top=(y-29)+'px';
        const dx=(x-cx)/66, dy=(y-cy)/66;
        // damped inputs for glide (no twitch)
        inp.strafe = dx;                  // side = bank within limits (clamped later)
        inp.fwd    = Math.max(-0.35, -dy);// tiny back allowed
      });

      // run / (optional) jump
      const run = mk('Run','position:absolute;bottom:42px;right:96px;'); run.onpointerdown=()=>{inp.run=1;}; run.onpointerup=()=>{inp.run=0;};
      const jump= mk('⤒','position:absolute;bottom:42px;right:22px;width:64px;height:64px;border-radius:999px;font-size:28px;text-align:center;');
      jump.onclick=()=>{/* optional hop later */};
      hud.appendChild(run); hud.appendChild(jump);

      // swipe-look (right half), but LOW-PASS into targets
      let swiping=false,lx=0,ly=0;
      hud.addEventListener('pointerdown',e=>{
        const rect=hud.getBoundingClientRect();
        if (e.clientX>rect.width*0.5){ swiping=true; lx=e.clientX; ly=e.clientY; hud.setPointerCapture(e.pointerId); }
      });
      hud.addEventListener('pointerup',()=> swiping=false);
      hud.addEventListener('pointermove',e=>{
        if(!swiping) return;
        const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
        const inv = cfg.invertY? -1 : 1;
        tyaw   -= dx * 0.0027;               // lower sensitivity for smoothness
        tpitch -= dy * 0.0027 * inv;
        tpitch = Math.max(-1.0, Math.min(1.0, tpitch));
      });
    }
    $('stagePanel')?.appendChild(hud);
  }
  function unmountHUD(){ hud?.remove(); hud=null; }

  function setPathVisible(on){ pathVisible=!!on; if (tube) tube.visible=pathVisible; }

  // ---------- math utils ----------
  const clamp = (x,a,b)=> Math.max(a,Math.min(b,x));
  const mix = (a,b,t)=> a + (b-a)*t;
  function damp(cur, target, rate, dt){ return cur + (target-cur) * Math.min(1, rate*dt); }

  // ---------- update loop ----------
  function update(dtRaw){
    if (!isFPV || !curve) return;

    // Filter dt to avoid touch-jitter induced spikes
    const dt = mix(prevDt, dtRaw, cfg.dtBlend); prevDt = dt;

    // Smooth look toward targets
    yaw   = damp(yaw,   tyaw,   cfg.lookSlew, dt);
    pitch = damp(pitch, tpitch, cfg.lookSlew, dt);

    // Path frame
    const {T,N,B}=frameAt(t);

    // Convert look to a forward vector around the ridge frame
    const yawM=new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchM=new THREE.Matrix4().makeRotationAxis(N, Math.max(-1.0, Math.min(1.0, pitch)));
    const lookDir=T.clone().applyMatrix4(yawM).applyMatrix4(pitchM).normalize();

    // --- Ridge Glide:
    // 1) Advance along tangent (no dipping into cloud).
    const speed = cfg.baseSpeed * (inp.run? cfg.runBoost : 1);
    const fwdAlongT = Math.max(0, lookDir.dot(T)); // forward only
    t = (t + (inp.fwd * speed * fwdAlongT * dt)/curveLen + 1) % 1;

    // 2) Banking limited: clamp |u| and spring it back to 0 (the crest).
    //    Use input.strafe to nudge within band; spring + damping keeps it buttery.
    // target bank from input
    const uTarget = clamp(u + (inp.strafe * cfg.strafeSpeed * dt), -cfg.bankMax, cfg.bankMax);
    // elastic pull to 0 + damping
    const spring = -cfg.bankElastic * u;       // to center
    const toward = uTarget + spring * dt;      // combine
    u = damp(u, clamp(toward, -cfg.bankMax, cfg.bankMax), cfg.bankDamp, dt);

    // Camera position: always above tube + extra clearance
    const pos=curve.getPointAt(t);
    const rBase=(tube?.geometry?.parameters?.radius||cfg.radiusMin);
    const r = rBase + cfg.rideHeight + cfg.clearance;
    const radial=new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const eye=pos.clone().addScaledVector(radial, r);

    // Look point with softened lead
    const look=pos.clone().addScaledVector(lookDir, cfg.lookAhead);

    // Camera pose
    const cam=Q.camera;
    if (cam.fov!==cfg.fov){ cam.fov=cfg.fov; cam.updateProjectionMatrix(); }
    if (cam.near!==0.01){ cam.near=0.01; cam.updateProjectionMatrix(); }
    cam.position.lerp(eye, cfg.camPosLerp);
    const up = radial.clone().cross(T).normalize();
    const m=new THREE.Matrix4().lookAt(eye, look, up);
    const q=new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, cfg.camRotSlerp);

    // Optional micro-optimization: if your app exposes dot clouds as QUANTUMI.dotClouds (Array<Object3D>),
    // you can reduce overdraw near the camera by fading them out within a tiny bubble.
    if (Array.isArray(window.QUANTUMI?.dotClouds)){
      for (const g of window.QUANTUMI.dotClouds){
        const d = g.getWorldPosition(new THREE.Vector3()).distanceTo(eye);
        g.visible = d > (rBase + cfg.clearance*0.5); // hide very-close emitters
      }
    }
  }

  // ---------- mode switch ----------
  async function toggle(on){
    if (on===isFPV) return;
    isFPV=!!on;
    const stage=$('stagePanel');
    if (isFPV){
      if (!Q) Q=window.QUANTUMI;
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }
      if (!buildCurveAndTube()){ console.warn('FPV: missing path'); isFPV=false; return; }

      // reset at ridge
      t=0; u=0.0; yaw=0; tyaw=0; pitch=0; tpitch=0; prevDt=0.016;
      inp.fwd=1;           // gentle auto-forward for glide feel on mobile
      inp.strafe=0; inp.run=0;

      // fullscreen & input
      if (!fsActive(stage)) await enterFS(stage);
      if (!isTouch) enablePointerLock(stage);

      // HUD
      mountHUD();
    } else {
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      await exitFS(stage);
      unmountHUD();
    }
  }

  // ---------- wiring ----------
  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q=window.QUANTUMI;

    // Attach Explore button (id="play-fp"); if missing, create a minimal one.
    let cta = $('#play-fp');
    if (!cta){ cta=document.createElement('button'); cta.id='play-fp'; cta.textContent='Explore'; cta.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:20px;z-index:20;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(15,17,20,.55);color:#fff;'; document.body.appendChild(cta); }
    cta.onclick = ()=> toggle(!isFPV);

    // Core loop
    document.addEventListener('quantumi:tick',(e)=> update(e.detail.dt||0.016));
    document.addEventListener('quantumi:cloud', ()=> buildCurveAndTube());

    // Leave FPV cleanly if FS exits
    document.addEventListener('fullscreenchange', ()=>{ const stage=$('stagePanel'); if (!fsActive(stage) && isFPV) toggle(false); });
    document.addEventListener('webkitfullscreenchange', ()=>{ const stage=$('stagePanel'); if (!fsActive(stage) && isFPV) toggle(false); });

    bindKeys();
  }
  start();
})();

