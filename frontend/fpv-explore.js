/* Clean FPS on BTC path + mobile HUD. Thin tube, pointer-lock desktop, swipe-look mobile. Path toggle works. */
const THREE = window.THREE;
(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1, bounds=null;
  let isFPV=false, pathVisible=false;
  // Path coordinates + look
  let t=0, u=Math.PI, yaw=0, pitch=0;

  const cfg = {
    fov: 85, sens: 0.0018, invertY: false,
    radiusMin: 0.12, radiusMax: 0.38, radiusScale: 0.012,
    rideHeight: 0.04, baseSpeed: 4.0, runBoost: 1.55, strafeSpeed: 2.2, lookAhead: 3.6,
    camPosLerp: 0.5, camRotSlerp: 0.28
  };

  const inp = { fwd:0, strafe:0, run:0 };
  const key = new Set();
  const latch = { X:false, B:false };

  // -------- Path build (thin radius)
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }
  function computeBounds(pts){ const bb=new THREE.Box3(); pts.forEach(p=>bb.expandByPoint(p)); return bb; }
  function radiusAuto(bb){ const d=bb.getSize(new THREE.Vector3()).length(); return Math.max(cfg.radiusMin, Math.min(cfg.radiusMax, d*cfg.radiusScale)); }

  function buildCurveAndTube(){
    const pts = getPathPoints(); if (!pts || pts.length<3) return false;
    curve = new THREE.CatmullRomCurve3(pts,false,'centripetal',.25);
    const tmp=curve.getPoints(1200); let L=0; for (let i=1;i<tmp.length;i++) L+=tmp[i-1].distanceTo(tmp[i]);
    curveLen=Math.max(1e-3,L);
    bounds = computeBounds(pts);

    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const r = radiusAuto(bounds);
    const geo=new THREE.TubeGeometry(curve, Math.min(2400, pts.length*6), r, 14, false);
    const mat=new THREE.MeshStandardMaterial({ color:0x00ff98, emissive:0x00331c, transparent:true, opacity:0.34, roughness:0.35, metalness:0.05 });
    tube=new THREE.Mesh(geo,mat); tube.name='HashTube'; tube.visible=pathVisible; Q.scene.add(tube);
    return true;
  }

  function frameAt(tt){
    const T=curve.getTangentAt(tt).normalize();
    const refUp=Math.abs(T.y)>0.92? new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const N=new THREE.Vector3().crossVectors(refUp,T).normalize();
    const B=new THREE.Vector3().crossVectors(T,N).normalize();
    return {T,N,B};
  }

  // -------- Inputs
  function pointerLock(el){
    el?.addEventListener('click', ()=>{ if (!document.pointerLockElement) el.requestPointerLock?.(); });
    window.addEventListener('mousemove', (e)=>{
      if (!isFPV || document.pointerLockElement!==el) return;
      yaw   -= e.movementX * cfg.sens;
      const inv = cfg.invertY? -1 : 1;
      pitch -= e.movementY * cfg.sens * inv;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
    });
  }
  function bindKeys(){
    window.addEventListener('keydown', e=>{
      if (!isFPV) return; const k=e.key.toLowerCase(); key.add(k);
      if (k==='w'||k==='arrowup')    inp.fwd= 1;
      if (k==='s'||k==='arrowdown')  inp.fwd=-1;
      if (k==='a'||k==='arrowleft')  inp.strafe=-1;
      if (k==='d'||k==='arrowright') inp.strafe= 1;
      if (k==='shift') inp.run=1;
      if (k==='x'){ setPathVisible(!pathVisible); }
      if (k==='escape') toggle(false);
    });
    window.addEventListener('keyup', e=>{
      if (!isFPV) return; const k=e.key.toLowerCase(); key.delete(k);
      if (k==='w'||k==='s'||k==='arrowup'||k==='arrowdown') inp.fwd=0;
      if (k==='a'||k==='d'||k==='arrowleft'||k==='arrowright') inp.strafe=0;
      if (k==='shift') inp.run=0;
    });
  }
  function pollPad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return; const gp = pads[0], dz=0.12;
    const lx=gp.axes[0]||0, ly=gp.axes[1]||0, rx=gp.axes[2]||0, ry=gp.axes[3]||0;
    inp.strafe = Math.abs(lx)>dz ? lx : (key.size?inp.strafe:0);
    inp.fwd    = Math.abs(ly)>dz ? -ly : (key.size?inp.fwd:0);
    // look with RS
    yaw   -= (Math.abs(rx)>dz ? rx : 0)*0.03;
    const inv = cfg.invertY? -1 : 1;
    pitch -= (Math.abs(ry)>dz ? ry : 0)*0.03*inv;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    // X toggles path, B exits, LB/RB run
    if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) inp.run=1; else if (!key.has('shift')) inp.run=0;
    if (gp.buttons[2]?.pressed && !latch.X){ setPathVisible(!pathVisible); latch.X=true; } if (!gp.buttons[2]?.pressed) latch.X=false;
    if (gp.buttons[1]?.pressed && !latch.B){ toggle(false); latch.B=true; } if (!gp.buttons[1]?.pressed) latch.B=false;
  }

  // -------- Mobile HUD
  let hud=null;
  function buildHUD(){
    if (hud) return;
    hud = document.createElement('div'); hud.id='fpv-hud'; document.body.appendChild(hud);

    const exit = document.createElement('button'); exit.className='fpv-btn glass fpv-exit'; exit.textContent='✕'; exit.onclick=()=>toggle(false); hud.appendChild(exit);
    const path = document.createElement('button'); path.className='fpv-btn glass fpv-path'; path.textContent='Path'; path.onclick=()=> setPathVisible(!pathVisible); hud.appendChild(path);

    if (isTouch){
      // Joystick
      const joy=document.createElement('div'); joy.className='joy'; joy.style.pointerEvents='auto';
      joy.innerHTML=`<div class="ring glass"></div><div class="knob"></div>`; hud.appendChild(joy);
      const knob=joy.querySelector('.knob'); let touching=false,cx=65,cy=65;
      joy.addEventListener('pointerdown',e=>{touching=true;joy.setPointerCapture(e.pointerId);});
      joy.addEventListener('pointerup',e=>{touching=false;inp.fwd=inp.strafe=0;knob.style.left='36px';knob.style.top='36px';});
      joy.addEventListener('pointermove',e=>{
        if(!touching) return; const r=joy.getBoundingClientRect(); const x=Math.max(0,Math.min(130,e.clientX-r.left)); const y=Math.max(0,Math.min(130,e.clientY-r.top));
        knob.style.left=(x-29)+'px'; knob.style.top=(y-29)+'px';
        const dx=(x-cx)/65, dy=(y-cy)/65;
        inp.fwd   = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.35 : 0);
        inp.strafe= (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });

      // Jump / Run
      const run=document.createElement('button'); run.className='fpv-btn glass fpv-run'; run.textContent='Run'; run.onpointerdown=()=>{inp.run=1;}; run.onpointerup=()=>{inp.run=0;}; hud.appendChild(run);
      const jump=document.createElement('button'); jump.className='fpv-btn glass fpv-jump'; jump.textContent='⤒'; jump.onclick=()=>{/* optional hop impulse later */}; hud.appendChild(jump);

      // Swipe-look (right half)
      let swiping=false, lx=0, ly=0;
      hud.addEventListener('pointerdown',e=>{ const rect=hud.getBoundingClientRect(); if (e.clientX > rect.width*0.5){ swiping=true; lx=e.clientX; ly=e.clientY; hud.setPointerCapture(e.pointerId);} });
      hud.addEventListener('pointerup',e=>{ swiping=false; });
      hud.addEventListener('pointermove',e=>{
        if(!swiping) return; const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
        yaw   -= dx*0.003; const inv = cfg.invertY? -1 : 1; pitch -= dy*0.003*inv; pitch=Math.max(-1.2, Math.min(1.2, pitch));
      });
    }
  }
  function destroyHUD(){ hud?.remove(); hud=null; }

  // -------- Path visibility
  function setPathVisible(on){ pathVisible=!!on; if (tube) tube.visible=pathVisible; }

  // -------- Per-frame update
  function update(dt){
    if (!isFPV || !curve) return;
    pollPad();

    // Frame at t
    const {T,N,B}=frameAt(t);
    // Look vector from yaw/pitch
    const yawM=new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchM=new THREE.Matrix4().makeRotationAxis(N, pitch);
    const lookDir=T.clone().applyMatrix4(yawM).applyMatrix4(pitchM).normalize();

    // Move along tangent
    const speed = cfg.baseSpeed * (inp.run? cfg.runBoost : 1);
    const fwdAlongT = Math.max(0, lookDir.dot(T));
    t = (t + (inp.fwd * speed * fwdAlongT * dt)/curveLen + 1) % 1;
    // Strafe: rotate around tube
    u += inp.strafe * cfg.strafeSpeed * dt;

    // Camera pose near surface
    const pos=curve.getPointAt(t);
    const r=(tube?.geometry?.parameters?.radius||cfg.radiusMin)+cfg.rideHeight;
    const radial=new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const eye=pos.clone().addScaledVector(radial, r);
    const look=pos.clone().addScaledVector(lookDir, cfg.lookAhead);

    const cam=Q.camera;
    if (cam.fov!==cfg.fov){ cam.fov=cfg.fov; cam.updateProjectionMatrix(); }
    if (cam.near!==0.01){ cam.near=0.01; cam.updateProjectionMatrix(); }
    cam.position.lerp(eye, cfg.camPosLerp);
    const up = radial.clone().cross(T).normalize();
    const m=new THREE.Matrix4().lookAt(eye,look,up);
    const q=new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, cfg.camRotSlerp);
    Q.controls && (Q.controls.enabled===false ? null : (Q.controls.target.copy(look), Q.controls.update?.()));
  }

  // -------- Mode switch
  function toggle(on){
    if (on===isFPV) return; isFPV=!!on;
    if (isFPV){
      if (!Q) Q=window.QUANTUMI;
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }
      if (!buildCurveAndTube()){ console.warn('FPV: no path'); isFPV=false; return; }
      t=0; u=Math.PI; yaw=0; pitch=0;
      const stage=$('stagePanel'); stage?.requestFullscreen?.().catch(()=>{});
      if (!isTouch) pointerLock(stage);
      buildHUD();
    } else {
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      document.exitFullscreen?.(); destroyHUD();
      inp.fwd=inp.strafe=inp.run=0;
    }
  }

  // -------- Wiring
  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q=window.QUANTUMI;

    // Explore CTA (ensures there is one visible mobile button)
    let cta = $('#play-fp');
    if (!cta){
      cta = document.createElement('button'); cta.id='play-fp'; cta.className='cta glass'; cta.textContent='Explore';
      document.body.appendChild(cta);
    }
    cta.onclick = ()=> toggle(!isFPV);

    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt||0.016));
    document.addEventListener('quantumi:cloud', ()=> buildCurveAndTube());
    bindKeys();
  }
  start();
})();
