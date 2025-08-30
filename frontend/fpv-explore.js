/* Glide v3 — crest-locked FP camera with spring smoothing + mobile HUD.
   Requires: window.THREE and window.QUANTUMI { scene, camera, controls, path (Vector3[]) }.
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1;
  let isFPV=false, pathVisible=false, walking=false, walkCluster=null, walkClusterIdx=-1;
  let jumpTargetT=null, thrustHold=0, tapStart=null;

  // Path params
  let t=0;        // along path [0..1)
  let u=0;        // around tube (radians), steered to crest
  let yaw=0, pitch=0;

  // Inputs (glide style)
  const inp = { thrust:0, run:0, bank:0 };
  let allow360=false, holdTimer=null;

  // Smoothing (critically damped springs)
  const sPos = new THREE.Vector3(), sVel = new THREE.Vector3();
  let sYaw=0, sPitch=0, sYawVel=0, sPitchVel=0;

  const cfg = {
    fov: 84, sens: 0.0016, invertY:false,
    radiusMin:0.12, radiusMax:0.36, radiusScale:0.012,
    rideHeight:0.07, glideSpeed:5.4, runBoost:1.6,
    bankStrength:0.6, lookAhead:4.0,
    posSmooth:0.22, rotSmooth:0.18,
    uLock:7.5, uDamp:8.5,
    worldUp: new THREE.Vector3(0,1,0),
    shellCull: true, shellRadius: 1.6,
    walkSpeed: 2.0
  };

  // ---------- math helpers ----------
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrapA=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
  function smoothDamp(cur,tgt,velRef,time,dt){
    const w = 2/Math.max(1e-4,time), x=w*dt;
    const k = 1/(1+x+0.48*x*x+0.235*x*x*x);
    const ch = cur-tgt, tmp=(velRef.v + w*ch)*dt;
    velRef.v = (velRef.v - w*tmp)*k;
    return (cur - ch)*k + tgt*(1-k) + tmp*k;
  }
  function smoothDampV3(cur,tgt,vel,time,dt){
    return new THREE.Vector3(
      smoothDamp(cur.x,tgt.x,{get v(){return vel.x},set v(v){vel.x=v}},time,dt),
      smoothDamp(cur.y,tgt.y,{get v(){return vel.y},set v(v){vel.y=v}},time,dt),
      smoothDamp(cur.z,tgt.z,{get v(){return vel.z},set v(v){vel.z=v}},time,dt)
    );
  }

  // ---------- path + tube ----------
  function pathPoints(){ return (window.QUANTUMI?.path)||[]; }
  function autoRadius(pts){
    const bb=new THREE.Box3(); pts.forEach(p=>bb.expandByPoint(p));
    const d=bb.getSize(new THREE.Vector3()).length();
    return Math.max(cfg.radiusMin, Math.min(cfg.radiusMax, d*cfg.radiusScale));
  }
  function buildCurve(){
    const pts = pathPoints(); if (!pts || pts.length<3) return false;
    curve = new THREE.CatmullRomCurve3(pts,false,'centripetal',0.25);
    const tmp = curve.getPoints(1200); let L=0; for(let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3,L);

    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const r = autoRadius(pts);
    const geo=new THREE.TubeGeometry(curve, Math.min(2400, pts.length*6), r, 14, false);
    const mat=new THREE.MeshStandardMaterial({ color:0x00ff98, emissive:0x00331c, transparent:true, opacity:0.34, roughness:0.35, metalness:0.05 });
    tube = new THREE.Mesh(geo,mat); tube.name='HashTube'; tube.visible=pathVisible;
    Q.scene.add(tube);
    return true;
  }
  function frameAt(tt){
    const T = curve.getTangentAt(tt).normalize();
    const refUp = Math.abs(T.y)>0.92? new THREE.Vector3(1,0,0):cfg.worldUp;
    const N = new THREE.Vector3().crossVectors(refUp,T).normalize();
    const B = new THREE.Vector3().crossVectors(T,N).normalize();
    return {T,N,B};
  }
  function crestAngle(N,B){
    // angle ‘u’ that aligns radial with world up the most:
    const Nu=N.dot(cfg.worldUp), Bu=B.dot(cfg.worldUp);
    return Math.atan2(Bu,Nu);
  }

  // ---------- FS + HUD ----------
  const fsActive = (stage)=> document.fullscreenElement===stage || document.webkitFullscreenElement===stage || stage.classList.contains('fs-fallback');
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

  let hud=null;
  function mountHUD(){
    if (hud) return;
    hud=document.createElement('div'); Object.assign(hud.style,{position:'absolute',inset:'0',zIndex:9999,pointerEvents:'none'});
    const mkBtn=(txt,css)=>{ const b=document.createElement('button'); b.textContent=txt; Object.assign(b.style,{pointerEvents:'auto',border:'1px solid rgba(255,255,255,.12)',background:'rgba(15,17,20,.55)',color:'#fff',borderRadius:'12px',padding:'10px 12px',font:'12px system-ui'}); Object.assign(b.style,css||{}); return b; };
    const exit=mkBtn('✕',{position:'absolute',top:'12px',left:'12px'}); exit.onclick=()=>toggle(false);
    const path=mkBtn('Path',{position:'absolute',top:'60px',left:'12px'}); path.onclick=()=>{ pathVisible=!pathVisible; if(tube) tube.visible=pathVisible; };
    hud.appendChild(exit); hud.appendChild(path);

    if (isTouch){
      // joystick = thrust/bank
      const joy=document.createElement('div'); Object.assign(joy.style,{position:'absolute',bottom:'26px',left:'18px',width:'132px',height:'132px',borderRadius:'999px',border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',pointerEvents:'auto'});
      const knob=document.createElement('div'); Object.assign(knob.style,{position:'absolute',left:'37px',top:'37px',width:'58px',height:'58px',borderRadius:'999px',background:'rgba(255,255,255,.22)'}); joy.appendChild(knob);
      hud.appendChild(joy);
      let touching=false,cx=66,cy=66;
      joy.addEventListener('pointerdown',e=>{touching=true;joy.setPointerCapture(e.pointerId);});
      joy.addEventListener('pointerup',e=>{touching=false;inp.thrust=0;inp.bank=0;knob.style.left='37px';knob.style.top='37px';});
      joy.addEventListener('pointermove',e=>{
        if(!touching) return; const r=joy.getBoundingClientRect(); const x=Math.max(0,Math.min(132,e.clientX-r.left)); const y=Math.max(0,Math.min(132,e.clientY-r.top));
        knob.style.left=(x-29)+'px'; knob.style.top=(y-29)+'px';
        const dx=(x-cx)/66, dy=(y-cy)/66;
        inp.thrust = clamp(-dy, -0.2, 1);   // slight reverse allowed
        inp.bank   = clamp(dx, -1, 1);
      });

      // swipe look outside joystick with long‑press for 360
      let swiping=false,lx=0,ly=0,vx=0,vy=0;
      hud.addEventListener('pointerdown',e=>{
        const r=joy.getBoundingClientRect();
        if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){
          swiping=true; lx=e.clientX; ly=e.clientY; vx=vy=0;
          allow360=false;
          holdTimer=setTimeout(()=>{allow360=true;},500);
          hud.setPointerCapture(e.pointerId);
        }
      });
      hud.addEventListener('pointerup',()=>{
        swiping=false;
        allow360=false;
        clearTimeout(holdTimer);
      });
      hud.addEventListener('pointermove',e=>{
        if(!swiping) return;
        const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
        vx=vx*0.7+dx*0.3; vy=vy*0.7+dy*0.3;
        yaw   -= vx*0.003;
        pitch -= vy*0.003*(cfg.invertY?-1:1);
        pitch = allow360 ? wrapA(pitch) : clamp(pitch,-1.0,1.0);
      });
      const run=mkBtn('Run',{position:'absolute',bottom:'42px',right:'22px'});
      run.onpointerdown=()=>{inp.run=1};
      run.onpointerup=()=>{inp.run=0};
      hud.appendChild(run);
    }
    $('stagePanel')?.appendChild(hud);
  }
  function unmountHUD(){ hud?.remove(); hud=null; }

  // ---------- inputs ----------
  function enablePointerLook(el){
    el?.addEventListener('click', ()=>{ if (!document.pointerLockElement) el.requestPointerLock?.(); }, {capture:true});
    window.addEventListener('mousemove', (e)=>{
      if (!isFPV || document.pointerLockElement!==el) return;
      yaw   -= e.movementX * cfg.sens;
      pitch -= e.movementY * cfg.sens * (cfg.invertY?-1:1);
      pitch = clamp(pitch,-1.0,1.0);
    });
  }
  function bindKeys(){
    window.addEventListener('keydown',e=>{
      if(!isFPV) return; const k=e.key.toLowerCase();
      if (k==='w'||k==='arrowup')    inp.thrust=1;
      if (k==='s'||k==='arrowdown')  inp.thrust=-0.2;
      if (k==='a'||k==='arrowleft')  inp.bank=-1;
      if (k==='d'||k==='arrowright') inp.bank=1;
      if (k==='shift') inp.run=1;
      if (k==='x'){ pathVisible=!pathVisible; if(tube) tube.visible=pathVisible; }
      if (k==='escape') toggle(false);
    });
    window.addEventListener('keyup',e=>{
      if(!isFPV) return; const k=e.key.toLowerCase();
      if (k==='w'||k==='s'||k==='arrowup'||k==='arrowdown') inp.thrust=0;
      if (k==='a'||k==='d'||k==='arrowleft'||k==='arrowright') inp.bank=0;
      if (k==='shift') inp.run=0;
    });
  }
  function pollPad(){
    const pads=navigator.getGamepads?Array.from(navigator.getGamepads()).filter(Boolean):[];
    if(!pads.length) return; const gp=pads[0], dz=0.12;
    const lx=gp.axes[0]||0, ly=gp.axes[1]||0, rx=gp.axes[2]||0, ry=gp.axes[3]||0;
    inp.bank   = Math.abs(lx)>dz ? lx : 0;
    inp.thrust = Math.abs(ly)>dz ? -ly : 0;
    yaw   -= (Math.abs(rx)>dz?rx:0)*0.03;
    pitch -= (Math.abs(ry)>dz?ry:0)*0.03*(cfg.invertY?-1:1);
    pitch = clamp(pitch,-1.0,1.0);
    inp.run = (gp.buttons[4]?.pressed||gp.buttons[5]?.pressed)?1:0;
    if (gp.buttons[2]?.pressed){ pathVisible=!pathVisible; if(tube) tube.visible=pathVisible; } // X
    if (gp.buttons[1]?.pressed) toggle(false); // B
  }

  // ---------- shell cull ----------
  function shellCull(camPos){
    if(!cfg.shellCull) return;
    const list = window.QUANTUMI?.dotClouds||[];
    for(const c of list){
      const bs = c.geometry?.boundingSphere; if(!bs) continue;
      const center = c.localToWorld ? c.localToWorld(bs.center.clone()) : bs.center;
      c.visible = center.distanceTo(camPos) > cfg.shellRadius;
    }
  }

  // ---------- update ----------
  const _yawVel={v:0}, _pitchVel={v:0};
  function update(dt){
    if(!isFPV || !curve) return;
    pollPad();
    if(walking){
      if(isTouch){
        const speed = cfg.walkSpeed * (1 + inp.run*(cfg.runBoost-1));
        const forward = new THREE.Vector3();
        Q.camera.getWorldDirection(forward);
        forward.y=0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, cfg.worldUp).normalize();
        const move = forward.multiplyScalar(inp.thrust*speed*dt).add(right.multiplyScalar(inp.bank*speed*dt));
        Q.camera.position.add(move);
      } else {
        window.walkMode?.update(dt);
      }
      shellCull(Q.camera.position);
      if(inp.thrust>0.8){
        thrustHold += dt;
        if(thrustHold>1){ jumpToCluster(walkClusterIdx+1); thrustHold=0; }
      } else {
        thrustHold=0;
      }
      const cls=window.QUANTUMI?.clusters||[];
      for(let i=0;i<cls.length;i++){
        if(Q.camera.position.distanceTo(cls[i].center)<cls[i].radius){ walkCluster=cls[i]; walkClusterIdx=i; break; }
      }
      return;
    }

    const {T,N,B} = frameAt(t);
    // steer u to crest + bank
    const uTarget = wrapA( crestAngle(N,B) + inp.bank*cfg.bankStrength );
    const uErr = wrapA(uTarget - u);
    u = wrapA( u + (cfg.uLock*uErr - cfg.uDamp*0) * dt );

    // progress along;
    if(jumpTargetT!==null){
      const step = cfg.glideSpeed * dt / curveLen;
      const diff = jumpTargetT - t;
      if(Math.abs(diff) <= step){ t = jumpTargetT; jumpTargetT=null; }
      else t += Math.sign(diff) * step;
    } else {
      const v = cfg.glideSpeed * (1 + inp.run*(cfg.runBoost-1));
      const dir = Math.max(0, inp.thrust); // no hard reverse in glide
      t = (t + dir * v * dt / curveLen) % 1;
      if (inp.thrust<0) t = (t + inp.thrust*0.4 * dt / curveLen + 1) % 1; // slight back
    }

    // intended look
    const yawM=new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchM=new THREE.Matrix4().makeRotationAxis(N, pitch);
    const lookDir = T.clone().applyMatrix4(yawM).applyMatrix4(pitchM).normalize();

    // target camera pose: above tube, never inside
    const r = (tube?.geometry?.parameters?.radius||cfg.radiusMin)+cfg.rideHeight;
    const radial = new THREE.Vector3().addScaledVector(N,Math.cos(u)).addScaledVector(B,Math.sin(u)).normalize();
    const pos = curve.getPointAt(t);
    const camTarget = pos.clone().addScaledVector(radial, r);
    const lookTarget = pos.clone().addScaledVector(lookDir, cfg.lookAhead);

    // smooth position and rotation
    const cam = Q.camera;
    sPos.copy( smoothDampV3(cam.position, camTarget, sVel, cfg.posSmooth, dt) );
    cam.position.copy(sPos);

    sYaw   = smoothDamp(sYaw,   yaw,   _yawVel,   cfg.rotSmooth, dt);
    sPitch = smoothDamp(sPitch, pitch, _pitchVel, cfg.rotSmooth, dt);

    const yawMs=new THREE.Matrix4().makeRotationAxis(B, sYaw);
    const pitchMs=new THREE.Matrix4().makeRotationAxis(N, sPitch);
    const lookSm = T.clone().applyMatrix4(yawMs).applyMatrix4(pitchMs).normalize();
    const up = radial.clone().cross(T).normalize();
    const m=new THREE.Matrix4().lookAt(sPos, sPos.clone().addScaledVector(lookSm, cfg.lookAhead), up);
    const q=new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, 0.35);

    if (cam.fov!==cfg.fov){ cam.fov=cfg.fov; cam.updateProjectionMatrix(); }
    shellCull(cam.position);
    const cls=window.QUANTUMI?.clusters||[];
    for(let i=0;i<cls.length;i++){
      const c=cls[i];
      if(cam.position.distanceTo(c.center)<c.radius){
        walking=true;
        walkCluster=c;
        walkClusterIdx=i;
        if(!isTouch) window.walkMode?.startWalkMode(Q.camera, Q.renderer);
        return;
      }
    }
  }

  function jumpToCluster(idx){
    const cls = window.QUANTUMI?.clusters || [];
    if(!cls.length) return;
    idx = (idx + cls.length) % cls.length;
    const c = cls[idx];
    if(Q && Q.camera){
      Q.camera.position.set(c.center.x, c.center.y + c.radius + 2, c.center.z);
    }
    walkCluster = c;
    walkClusterIdx = idx;
  }

  // ---------- toggle ----------
  async function toggle(on){
    if(on===isFPV) return;
    isFPV=!!on; const stage=$('stagePanel'); walking=false;
    if (isFPV){
      if(!Q) Q=window.QUANTUMI;
      // disable orbit during FPV
      Q.controls && (Q.controls.enabled=false, Q.controls.autoRotate=false, Q.controls.update?.());
      if(!buildCurve()){ console.warn('FPV: no path'); isFPV=false; return; }
      await enterFS(stage);
      if(!isTouch) enablePointerLook(stage);
      // start on crest
      const {N,B} = frameAt(t=0);
      u = crestAngle(N,B); yaw=0; pitch=0; sYaw=0; sPitch=0; sVel.set(0,0,0);
      walking=true;
      if(!isTouch) window.walkMode?.startWalkMode(Q.camera, Q.renderer);
      mountHUD();
    } else {
      Q.controls && (Q.controls.enabled=true, Q.controls.update?.());
      await exitFS(stage); unmountHUD();
      inp.thrust=inp.bank=inp.run=0;
    }
  }

  function start(){
    if(!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q=window.QUANTUMI;
    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt||0.016));
    document.addEventListener('quantumi:cloud', ()=> buildCurve());
    bindKeys();

    const stage=$('stagePanel');
    if(stage){
      stage.addEventListener('pointerdown',e=>{
        if(!isFPV || !walking) return;
        if(e.target.closest('.fpv-joy') || e.target.closest('.fpv-run')) return;
        tapStart={x:e.clientX,y:e.clientY,t:performance.now()};
      });
      stage.addEventListener('pointerup',e=>{
        if(!isFPV || !walking || !tapStart) return;
        if(e.target.closest('.fpv-joy') || e.target.closest('.fpv-run')){ tapStart=null; return; }
        const dx=Math.abs(e.clientX-tapStart.x);
        const dy=Math.abs(e.clientY-tapStart.y);
        const dt=performance.now()-tapStart.t;
        if(dx<10 && dy<10 && dt<250){ const cls=window.QUANTUMI?.clusters||[]; if(cls.length){ const next=(walkClusterIdx+1)%cls.length; jumpToCluster(next); } }
        tapStart=null;
      });
    }

    const explore=$('play-fp'); if (explore){ explore.onclick = ()=> toggle(!isFPV); }
    document.addEventListener('fullscreenchange', ()=>{ const stage=$('stagePanel'); if(!fsActive(stage) && isFPV) toggle(false); });
    document.addEventListener('webkitfullscreenchange', ()=>{ const stage=$('stagePanel'); if(!fsActive(stage) && isFPV) toggle(false); });
  }
  start();
})();

