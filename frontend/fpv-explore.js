/* fpv-explore.js — FPV with capsule physics, spatial-hash colliders, path riding, mobile HUD fix */
import { SpatialHash, CapsuleController } from './collider-lite.js';
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1;

  // Physics world
  let hash = null;                 // SpatialHash of AABB cubes
  let player = null;               // CapsuleController
  const world = { gravity: 12.0 };

  // Modes
  let isFPV = false;
  let ridingPath = false;          // if true, we glide along curve ignoring gravity (teleport/ride)
  let runnerT = 0;                 // normalized position on path

  // Inputs (raw & smoothed)
  const moveRaw = {f:0,b:0,l:0,r:0, run:0};
  const moveSm  = {fwd:0, lat:0};
  const cfg = {
    tubeRadius: 0.06,
    baseSpeed: 3.0,
    runBoost: 1.6,
    strafeSpeed: 2.0,
    eyeHeight: 0.18,
    lookAhead: 3.2,
    jumpVel: 4.4,
    // smoothing
    easeIn: 9.0, easeOut: 7.0,
    camPosLerp: 0.5, camRotSlerp: 0.35,
    // collider generation
    voxel: 0.9,         // size of cubes for "masses"
    voxelPad: 0.04,     // enlarge half-extents a bit
  };

  // HUD elements
  let hud=null, pathBtn=null, rideBtn=null, exitBtn=null, joy=null, jumpBtn=null;

  // -------------------- DATA ADAPTERS --------------------
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }

  function getActiveCloudPoints(){
    // Try QUANTUMI.dotClouds if exposed; else scan scene for Points or InstancedMesh named 'dotCloud'
    let pts=[];
    const dcs = window.QUANTUMI?.dotClouds || [];
    if (Array.isArray(dcs) && dcs.length){
      for (const m of dcs){
        const g = m.geometry;
        if (g?.attributes?.position){
          const p = g.attributes.position.array;
          for (let i=0;i<p.length;i+=3) pts.push(new THREE.Vector3(p[i],p[i+1],p[i+2]));
        }
      }
      return pts;
    }
    // fallback: scan scene
    window.QUANTUMI?.scene?.traverse(n=>{
      if (n.isPoints && n.geometry?.attributes?.position){
        const p = n.geometry.attributes.position.array;
        for (let i=0;i<p.length;i+=3) pts.push(new THREE.Vector3(p[i],p[i+1],p[i+2]));
      }
    });
    return pts;
  }

  // -------------------- COLLIDERS --------------------
  function buildCollidersFromCloud(){
    const pts = getActiveCloudPoints();
    hash = new SpatialHash(cfg.voxel);

    // aggregate into grid cells, create AABBs as "square masses"
    const seen = new Map();
    const c = cfg.voxel;
    for (const v of pts){
      const ix=Math.round(v.x/c), iy=Math.round(v.y/c), iz=Math.round(v.z/c);
      const key = `${ix}|${iy}|${iz}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      const center = new THREE.Vector3(ix*c, iy*c, iz*c);
      const half = (c*0.5) + cfg.voxelPad;
      const min = center.clone().addScalar(-half);
      const max = center.clone().addScalar(+half);
      hash.insertAABB(min, max);
    }
  }

  // -------------------- PATH --------------------
  function rebuildCurveAndTube(){
    const pts = getPathPoints();
    if (pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);
    const tmp = curve.getPoints(800); let L=0; for(let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const geo = new THREE.TubeGeometry(curve, Math.min(1600, pts.length*6), cfg.tubeRadius, 10, false);
    const mat = new THREE.MeshStandardMaterial({ color:0x00ff7f, emissive:0x00331c, transparent:true, opacity:0.82, roughness:0.35, metalness:0.05 });
    tube = new THREE.Mesh(geo, mat); tube.visible = false; tube.name='HashTube';
    Q.scene.add(tube);
    return true;
  }

  // -------------------- HUD --------------------
  function buildHUD(){
    if (hud) return;
    const root = document.createElement('div');
    root.id='fpv-hud'; Object.assign(root.style,{position:'absolute', inset:'0', pointerEvents:'none', zIndex:30});

    // Exit (safe-area top-left)
    const ex = document.createElement('button');
    ex.textContent='\u2715';
    Object.assign(ex.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      width:'44px', height:'44px', borderRadius:'12px', background:'rgba(0,0,0,.4)', color:'#fff',
      border:'1px solid rgba(255,255,255,.15)', pointerEvents:'auto'
    });
    ex.onclick = ()=> toggleFPV(false);
    root.appendChild(ex); exitBtn=ex;

    // Path toggle (top-left, offset under exit)
    const pb = document.createElement('button'); pb.textContent='Path';
    Object.assign(pb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 60px)', left:'calc(env(safe-area-inset-left,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    pb.onclick = ()=>{ if (tube) tube.visible = !tube.visible; };
    root.appendChild(pb); pathBtn=pb;

    // Ride toggle (top-right)
    const rb = document.createElement('button'); rb.textContent='Ride';
    Object.assign(rb.style,{
      position:'absolute', top:'calc(env(safe-area-inset-top,0px) + 10px)', right:'calc(env(safe-area-inset-right,0px) + 10px)',
      padding:'6px 10px', borderRadius:'10px', background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      pointerEvents:'auto', fontSize:'12px'
    });
    rb.onclick = ()=> { ridingPath = !ridingPath; };
    root.appendChild(rb); rideBtn=rb;

    // Mobile controls
    if (isTouch){
      // Joystick bottom-left
      const joyRoot = document.createElement('div');
      Object.assign(joyRoot.style,{ position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 20px)', left:'calc(env(safe-area-inset-left,0px) + 18px)',
        width:'120px', height:'120px', borderRadius:'999px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', touchAction:'none', pointerEvents:'auto'});
      const knob = document.createElement('div'); Object.assign(knob.style,{ position:'absolute', width:'56px', height:'56px', borderRadius:'999px', left:'32px', top:'32px', background:'rgba(255,255,255,.22)'});
      joyRoot.appendChild(knob); root.appendChild(joyRoot);
      let touching=false,cx=60,cy=60;
      joyRoot.addEventListener('pointerdown',e=>{touching=true; joyRoot.setPointerCapture(e.pointerId);});
      joyRoot.addEventListener('pointerup',e=>{touching=false; moveRaw.f=moveRaw.b=moveRaw.l=moveRaw.r=0; knob.style.left='32px'; knob.style.top='32px';});
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return; const r=joyRoot.getBoundingClientRect();
        const x=Math.max(0,Math.min(120,e.clientX-r.left)), y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60, dy=(y-cy)/60;
        moveRaw.f=(-dy>0?-dy:0); moveRaw.b=(dy>0?dy:0); moveRaw.r=(dx>0?dx:0); moveRaw.l=(-dx>0?-dx:0);
      });
      joy = { root:joyRoot, knob };

      // Jump bottom-right
      const jb = document.createElement('button'); jb.textContent='\u2912';
      Object.assign(jb.style,{ position:'absolute', bottom:'calc(env(safe-area-inset-bottom,0px) + 42px)', right:'calc(env(safe-area-inset-right,0px) + 22px)',
        width:'64px', height:'64px', borderRadius:'999px', background:'rgba(255,255,255,.14)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', fontSize:'28px', pointerEvents:'auto'});
      jb.onclick = ()=> { if (player?.onGround) player.vel.y = cfg.jumpVel; };
      root.appendChild(jb); jumpBtn=jb;
    }

    $('stagePanel')?.appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=null; pathBtn=rideBtn=exitBtn=joy=jumpBtn=null; }

  // -------------------- WORLD BUILDER (fixed) --------------------
  function classifyPrompt(s=''){
    s=s.toLowerCase();
    if (/(city|urban|skyscraper|building|blocks?)/.test(s)) return 'city';
    if (/(terrain|land|mountain|ground|island|voxel)/.test(s)) return 'terrain';
    if (/(alien|coral|crystal|sci[- ]?fi|neon)/.test(s)) return 'alien';
    return 'grass';
  }
  function buildWorldFromPoints(mode){
    const scene = Q.scene;
    // Clear prior generated world (tagged)
    const old = scene.getObjectByName('WorldGen'); old && scene.remove(old);

    // Source points: use active cloud
    const pts = getActiveCloudPoints(); if (!pts.length) return;
    const group = new THREE.Group(); group.name='WorldGen';

    let geo, mat, scaleFn = ()=>1, jitter=()=>0, colorize = (i)=>0xffffff;
    if (mode==='grass'){
      geo = new THREE.ConeGeometry(0.05, 0.22, 6);
      mat = new THREE.MeshStandardMaterial({ roughness:0.8, metalness:0.0, vertexColors:true });
      scaleFn = ()=> 0.6 + Math.random()*0.7;
      jitter = ()=> (Math.random()-.5)*0.35;
      colorize = (i)=> new THREE.Color().setHSL(0.36 + Math.random()*0.05, 0.8, 0.45 + Math.random()*0.1).getHex();
    } else if (mode==='city'){
      geo = new THREE.BoxGeometry(0.22, 1, 0.22);
      mat = new THREE.MeshStandardMaterial({ roughness:0.55, metalness:0.2, vertexColors:true });
      scaleFn = (p)=> 0.8 + Math.abs(p.y)*0.05 + Math.random()*0.4;
      jitter = ()=> (Math.random()-.5)*0.4;
      colorize = ()=> new THREE.Color().setHSL(0.6 + Math.random()*0.02, 0.1, 0.7 - Math.random()*0.2).getHex();
    } else if (mode==='terrain'){
      geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
      mat = new THREE.MeshStandardMaterial({ roughness:0.9, metalness:0.0, vertexColors:true });
      scaleFn = (p)=> 0.6 + Math.random()*0.6 + Math.max(0,(p.y+10)/20);
      jitter = ()=> (Math.random()-.5)*0.28;
      colorize = ()=> new THREE.Color().setHSL(0.08 + Math.random()*0.03, 0.65, 0.42 + Math.random()*0.08).getHex();
    } else { // alien
      geo = new THREE.IcosahedronGeometry(0.12, 0);
      mat = new THREE.MeshStandardMaterial({ roughness:0.2, metalness:0.6, vertexColors:true, emissive:0x0b2f33 });
      scaleFn = ()=> 0.8 + Math.sin(Math.random()*Math.PI)*0.6;
      jitter = ()=> (Math.random()-.5)*0.4;
      colorize = ()=> new THREE.Color().setHSL(0.52 + Math.random()*0.1, 0.8, 0.55).getHex();
    }

    const count = Math.min(2500, pts.length);
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i=0;i<count;i++){
      const p = pts[i];
      dummy.position.set(p.x + jitter(), p.y + jitter()*0.3, p.z + jitter());
      const s = scaleFn(p); dummy.scale.setScalar(s);
      dummy.rotation.y = Math.random()*Math.PI;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(colorize(i)); inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true;
    group.add(inst); Q.scene.add(group);
  }

  // -------------------- MOVEMENT --------------------
  function ease(cur,target,dt){
    const rate = (Math.abs(target)>Math.abs(cur))?cfg.easeIn:cfg.easeOut;
    return cur + (target-cur)*Math.min(1, rate*dt);
  }

  function tick(dt){
    if (!isFPV) return;

    if (ridingPath && curve){
      // Glide along curve (gravity off) to travel between clusters smoothly
      const speed = cfg.baseSpeed * (moveRaw.run? cfg.runBoost : 1) * 0.9;
      const target = (moveRaw.f - moveRaw.b);
      moveSm.fwd = ease(moveSm.fwd, target, dt);
      runnerT = (runnerT + (moveSm.fwd * speed * dt)/curveLen + 1) % 1;

      const pos = curve.getPointAt(runnerT);
      const tan = curve.getTangentAt(runnerT).normalize();
      const up = new THREE.Vector3(0,1,0);
      const eye = pos.clone().add(up.clone().multiplyScalar(cfg.eyeHeight));
      const look = curve.getPointAt((runnerT + (cfg.lookAhead/curveLen)) % 1);
      const cam = Q.camera;
      cam.position.lerp(eye, cfg.camPosLerp);
      const m = new THREE.Matrix4().lookAt(eye, look, up);
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      cam.quaternion.slerp(q, cfg.camRotSlerp);
      Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
      return;
    }

    // Physics-driven (gravity + colliders)
    if (!player) return;
    // smooth inputs
    const targetFwd = (moveRaw.f - moveRaw.b);
    const targetLat = (moveRaw.r - moveRaw.l);
    moveSm.fwd = ease(moveSm.fwd, targetFwd, dt);
    moveSm.lat = ease(moveSm.lat, targetLat, dt);

    // local axes from camera forward projected on XZ to move
    const camF = new THREE.Vector3(0,0,-1).applyQuaternion(Q.camera.quaternion); camF.y=0; camF.normalize();
    const camR = new THREE.Vector3().crossVectors(camF, new THREE.Vector3(0,1,0)).normalize();

    const speed = cfg.baseSpeed * (moveRaw.run? cfg.runBoost : 1);
    const wish = new THREE.Vector3()
      .addScaledVector(camF, moveSm.fwd * speed)
      .addScaledVector(camR, moveSm.lat * speed);
    player.vel.x = wish.x;
    player.vel.z = wish.z;

    // integrate & collide
    player.integrate(dt, world.gravity, hash);

    // camera follow
    const head = new THREE.Vector3(player.pos.x, player.pos.y + player.height, player.pos.z);
    const look = head.clone().add(camF.clone().multiplyScalar(3.0));
    Q.camera.position.lerp(head, cfg.camPosLerp);
    const m = new THREE.Matrix4().lookAt(head, look, new THREE.Vector3(0,1,0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    Q.camera.quaternion.slerp(q, cfg.camRotSlerp);
    Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
  }

  // -------------------- MODE SWITCH --------------------
  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      // build path tube & colliders
      rebuildCurveAndTube();
      buildCollidersFromCloud();

      // spawn player atop a nearby collider or at curve start
      const start = getPathPoints()[0] || new THREE.Vector3(0,2,5);
      player = new CapsuleController({ pos: start.clone().add(new THREE.Vector3(0,1.5,0)) });

      // controls & fullscreen
      Q.controls && (Q.controls.enabled=false);
      $('stagePanel')?.requestFullscreen?.().catch(()=>{});
      buildHUD();

      // default: physics free-roam (ridingPath = false)
      ridingPath = false;
      runnerT = 0;
    } else {
      Q && Q.controls && (Q.controls.enabled=true, Q.controls.update?.());
      document.exitFullscreen?.();
      destroyHUD();
      // reset inputs
      Object.assign(moveRaw,{f:0,b:0,l:0,r:0,run:0});
      Object.assign(moveSm,{fwd:0,lat:0});
    }
  }

  // -------------------- BINDINGS --------------------
  function bindKeys(){
    window.addEventListener('keydown',e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if(k==='w') moveRaw.f=1; if(k==='s') moveRaw.b=1; if(k==='a') moveRaw.l=1; if(k==='d') moveRaw.r=1;
      if(k==='shift') moveRaw.run=1;
      if(k===' ') { if (player?.onGround) player.vel.y = cfg.jumpVel; }
      if(k==='e') { ridingPath = !ridingPath; }
      if(k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup',e=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase();
      if(k==='w') moveRaw.f=0; if(k==='s') moveRaw.b=0; if(k==='a') moveRaw.l=0; if(k==='d') moveRaw.r=0; if(k==='shift') moveRaw.run=0;
    });
  }

  function bindUI(){
    const explore=$('play-fp'); if (explore){ explore.onclick=()=> toggleFPV(!isFPV); explore.title='Explore (fullscreen + FPV)'; }
    // World builder hook if you have #worldPrompt + #build-world
    const prompt = $('worldPrompt'), build = $('build-world');
    if (build){
      build.onclick = ()=>{
        const mode = classifyPrompt(prompt?.value || '');
        buildWorldFromPoints(mode);
      };
    }
    document.addEventListener('quantumi:cloud', ()=>{
      rebuildCurveAndTube();
      buildCollidersFromCloud();
    });
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
  }

  function start(){
    if(!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q=window.QUANTUMI;
    // frame hooks
    document.addEventListener('quantumi:tick', (e)=> tick(e.detail.dt));
    document.addEventListener('quantumi:frame', (e)=>{ const dt=(e?.detail?.dt)??0.016; tick(dt); });
    bindKeys(); bindUI();
  }
  start();
})();

