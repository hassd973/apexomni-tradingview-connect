const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1, bounds=null;
  let isFPV=false, pathVisible=false;

  // path coords + look
  let t=0, u=Math.PI, yaw=0, pitch=0;
  const inp = { fwd:0, strafe:0, run:0 };

  const cfg = {
    fov: 84, sens: 0.0018, invertY: false,
    radiusMin: 0.12, radiusMax: 0.38, radiusScale: 0.012,
    rideHeight: 0.04, baseSpeed: 4.0, runBoost: 1.55, strafeSpeed: 2.2, lookAhead: 3.6,
    camPosLerp: 0.5, camRotSlerp: 0.28
  };

  // ---------- helpers ----------
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

  // ---------- fullscreen helpers (robust) ----------
  function fsActive(stage){ return document.fullscreenElement===stage || document.webkitFullscreenElement===stage || stage.classList.contains('fs-fallback'); }
  async function enterFullscreen(stage){
    try{
      if (stage.requestFullscreen){ await stage.requestFullscreen({ navigationUI:'hide' }); }
      else if (stage.webkitRequestFullscreen){ stage.webkitRequestFullscreen(); }
      else throw new Error('no FS api');
      stage.classList.add('fs-active');
    }catch(e){
      // fallback overlay
      stage.classList.add('fs-active','fs-fallback');
      document.body.classList.add('fs-noscroll');
    }
  }
  async function exitFullscreen(stage){
    try{
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }catch{}
    stage.classList.remove('fs-active','fs-fallback');
    document.body.classList.remove('fs-noscroll');
  }

  // ---------- input ----------
  function enablePointerLock(el){
    el?.addEventListener('click', ()=>{ if (!document.pointerLockElement) el.requestPointerLock?.(); }, { capture:true });
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
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if (k==='w'||k==='arrowup')    inp.fwd= 1;
      if (k==='s'||k==='arrowdown')  inp.fwd=-1;
      if (k==='a'||k==='arrowleft')  inp.strafe=-1;
      if (k==='d'||k==='arrowright') inp.strafe= 1;
      if (k==='shift') inp.run=1;
      if (k==='x'){ togglePath(); }
      if (k==='escape'){ toggle(false); }
    });
    window.addEventListener('keyup', e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if (k==='w'||k==='s'||k==='arrowup'||k==='arrowdown') inp.fwd=0;
      if (k==='a'||k==='d'||k==='arrowleft'||k==='arrowright') inp.strafe=0;
      if (k==='shift') inp.run=0;
    });
  }

  // ---------- mobile HUD (self-contained; non-conflicting) ----------
  let hud=null;
  function mountHUD(){
    if (hud) return;
    hud = document.createElement('div');
    hud.id='fpv-hud-layer';
    Object.assign(hud.style, {
      position:'absolute', inset:'0', zIndex: 9999, pointerEvents:'none'
    });
    const mkBtn=(txt,cls)=>{ const b=document.createElement('button'); b.textContent=txt; b.className=cls; b.style.pointerEvents='auto'; b.style.border='1px solid rgba(255,255,255,.12)'; b.style.background='rgba(15,17,20,.55)'; b.style.color='#fff'; b.style.borderRadius='12px'; b.style.padding='10px 12px'; b.style.font='12px system-ui'; return b; };
    const exit = mkBtn('✕',''); Object.assign(exit.style,{ position:'absolute', top:'12px', left:'12px' }); exit.onclick=()=> toggle(false);
    const path = mkBtn('Path',''); Object.assign(path.style,{ position:'absolute', top:'60px', left:'12px' }); path.onclick=()=> togglePath();
    hud.appendChild(exit); hud.appendChild(path);

    if (isTouch){
      // joystick
      const joy=document.createElement('div');
      Object.assign(joy.style,{ position:'absolute', bottom:'26px', left:'18px', width:'132px', height:'132px', borderRadius:'999px', border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', pointerEvents:'auto' });
      const knob=document.createElement('div'); Object.assign(knob.style,{ position:'absolute', left:'37px', top:'37px', width:'58px',height:'58px', borderRadius:'999px', background:'rgba(255,255,255,.22)'});
      joy.appendChild(knob); hud.appendChild(joy);
      let touching=false,cx=66,cy=66;
      joy.addEventListener('pointerdown',e=>{ touching=true; joy.setPointerCapture(e.pointerId); });
      joy.addEventListener('pointerup',e=>{ touching=false; inp.fwd=inp.strafe=0; knob.style.left='37px'; knob.style.top='37px'; });
      joy.addEventListener('pointermove',e=>{
        if(!touching) return;
        const r=joy.getBoundingClientRect(); const x=Math.max(0,Math.min(132,e.clientX-r.left)); const y=Math.max(0,Math.min(132,e.clientY-r.top));
        knob.style.left=(x-29)+'px'; knob.style.top=(y-29)+'px';
        const dx=(x-cx)/66, dy=(y-cy)/66;
        inp.fwd   = (-dy>0 ? -dy : 0) + (dy>0 ? -dy*0.35 : 0);
        inp.strafe= (dx>0 ? dx : 0) + (-dx>0 ? -dx : 0);
      });

      // Run / Jump
      const run=mkBtn('Run',''); Object.assign(run.style,{ position:'absolute', bottom:'42px', right:'96px' });
      run.onpointerdown=()=>{inp.run=1;}; run.onpointerup=()=>{inp.run=0;};
      const jump=mkBtn('⤒',''); Object.assign(jump.style,{ position:'absolute', bottom:'42px', right:'22px', width:'64px', height:'64px', borderRadius:'999px', fontSize:'28px', textAlign:'center' });
      jump.onclick=()=>{/* placeholder hop */};
      hud.appendChild(run); hud.appendChild(jump);

      // swipe-look (right half)
      let swiping=false, lx=0, ly=0;
      hud.addEventListener('pointerdown',e=>{
        const rect=hud.getBoundingClientRect();
        if (e.clientX > rect.width/2){ swiping=true; lx=e.clientX; ly=e.clientY; hud.setPointerCapture(e.pointerId); }
      });
      hud.addEventListener('pointerup',()=> swiping=false);
      hud.addEventListener('pointermove',e=>{
        if(!swiping) return;
        const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
        yaw   -= dx*0.003; const inv = cfg.invertY ? -1 : 1; pitch -= dy*0.003*inv; pitch=Math.max(-1.2, Math.min(1.2, pitch));
      });
    }

    $('stagePanel')?.appendChild(hud);
  }
  function unmountHUD(){ hud?.remove(); hud=null; }

  function togglePath(){ pathVisible=!pathVisible; if (tube) tube.visible = pathVisible; $('toggle-path')?.setAttribute('aria-pressed', String(pathVisible)); }

  // ---------- update loop ----------
  function update(dt){
    if (!isFPV || !curve) return;
    // frame at t
    const {T,N,B}=frameAt(t);
    // look
    const yawM=new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchM=new THREE.Matrix4().makeRotationAxis(N, pitch);
    const lookDir=T.clone().applyMatrix4(yawM).applyMatrix4(pitchM).normalize();

    const speed = cfg.baseSpeed * (inp.run? cfg.runBoost : 1);
    const fwdAlongT = Math.max(0, lookDir.dot(T));
    t = (t + (inp.fwd * speed * fwdAlongT * dt)/curveLen + 1) % 1;
    u += inp.strafe * cfg.strafeSpeed * dt;

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
  }

  // ---------- mode switch ----------
  async function toggle(on){
    if (on===isFPV) return;
    isFPV=!!on;
    const stage = $('stagePanel');
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }
      if (!buildCurveAndTube()){ console.warn('FPV: missing path'); isFPV=false; return; }

      // fullscreen first (robust)
      if (!fsActive(stage)) await enterFullscreen(stage);

      // pointer-lock for desktop
      if (!isTouch) enablePointerLock(stage);
      // reset
      t=0; u=Math.PI; yaw=0; pitch=0; inp.fwd=inp.strafe=inp.run=0;
      // HUD
      mountHUD();
    } else {
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      await exitFullscreen(stage);
      unmountHUD();
      inp.fwd=inp.strafe=inp.run=0;
    }
  }

  // ---------- wiring ----------
  function start(){
    if (!window.QUANTUMI?.scene){ return setTimeout(start,60); }
    Q = window.QUANTUMI;

    // drive from main loop (already present in studio.html)
    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt||0.016));
    document.addEventListener('quantumi:cloud', ()=> buildCurveAndTube());

    // Explore button: ALWAYS fullscreen + FPV
    const explore = $('play-fp');
    if (explore){
      explore.onclick = async ()=> { 
        if (!isFPV){ await toggle(true); } else { await toggle(false); }
      };
    }

    // Safety: if user exits FS via system gesture, leave FPV cleanly
    document.addEventListener('fullscreenchange', ()=> {
      const stage = $('stagePanel'); if (!fsActive(stage) && isFPV) toggle(false);
    });
    document.addEventListener('webkitfullscreenchange', ()=> {
      const stage = $('stagePanel'); if (!fsActive(stage) && isFPV) toggle(false);
    });

    bindKeys();
  }
  start();
})();
