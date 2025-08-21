/* fpv-explore.js — FPV via Explore; mobile joystick restored; smooth motion; tube hidden by default.
   Requires: window.THREE and window.QUANTUMI with .scene, .camera, .controls, .path (Vector3[]).
*/
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  let Q, curve=null, tube=null, curveLen=1;
  let isFPV=false;
  let runnerT=0, playerY=0, velY=0;

  // Raw inputs (from keys/joystick) and smoothed values
  const moveRaw = {f:0,b:0,l:0,r:0, run:0};
  const moveSm  = {fwd:0, lat:0};

  const cfg = {
    tubeRadius: 0.065,
    baseSpeed: 2.2,
    runBoost: 1.7,
    strafeSpeed: 1.2,
    eyeHeight: 0.12,
    lookAhead: 2.6,
    jumpVel: 3.0,
    gravity: 9.0,
    // smoothing
    easeIn: 8.0,
    easeOut: 6.0,
    camPosLerp: 0.45,
    camRotSlerp: 0.35,
  };

  // HUD + Path toggle + Mobile controls
  let hud=null, pathBtn=null, hintTimer=null;
  let joy=null, jumpBtn=null, exitBtn=null;

  function buildHUD() {
    if (hud) return;

    const root = document.createElement('div');
    root.id = 'fpv-hud';
    Object.assign(root.style,{
      position:'absolute', inset:'0', pointerEvents:'none', zIndex:30,
      fontFamily:'inherit', color:'#fff'
    });

    // Path toggle (top-left)
    const btn = document.createElement('button');
    btn.textContent = 'Path';
    btn.id='toggle-path';
    Object.assign(btn.style,{
      position:'absolute', top:'12px', left:'12px', pointerEvents:'auto',
      padding:'6px 10px', borderRadius:'10px',
      background:'rgba(0,0,0,.35)', color:'#fff', border:'1px solid rgba(255,255,255,.15)',
      fontSize:'12px'
    });
    btn.setAttribute('aria-pressed','false');
    btn.onclick = ()=> {
      if (!tube) return;
      const on = !tube.visible;
      tube.visible = on;
      btn.setAttribute('aria-pressed', String(on));
    };
    root.appendChild(btn);
    pathBtn = btn;

    // Desktop hint (auto-fade)
    if (!isTouch){
      const hint = document.createElement('div');
      hint.textContent = 'W/S move • A/D strafe • Space jump • Shift run • Esc exit';
      Object.assign(hint.style,{
        position:'absolute', bottom:'16px', left:'50%', transform:'translateX(-50%)',
        background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'12px',
        padding:'6px 10px', borderRadius:'8px', opacity:'0', transition:'opacity .4s ease',
        pointerEvents:'none'
      });
      root.appendChild(hint);
      clearTimeout(hintTimer);
      hint.style.opacity='1';
      hintTimer = setTimeout(()=> hint.style.opacity='0', 3200);
    }

    // Mobile controls: joystick + Jump + Exit
    if (isTouch){
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
      root.appendChild(joyRoot);

      // Jump
      const j = document.createElement('button');
      j.textContent = '⤒';
      Object.assign(j.style,{
        position:'absolute', bottom:'42px', right:'22px', width:'64px', height:'64px',
        borderRadius:'999px', background:'rgba(255,255,255,.14)', color:'white',
        border:'1px solid rgba(255,255,255,.2)', fontSize:'28px', pointerEvents:'auto'
      });
      root.appendChild(j);

      // Exit (top-right)
      const x = document.createElement('button');
      x.textContent = '✕';
      Object.assign(x.style,{
        position:'absolute', top:'14px', right:'14px', width:'44px', height:'44px',
        borderRadius:'12px', background:'rgba(0,0,0,.35)', color:'white',
        border:'1px solid rgba(255,255,255,.15)', fontSize:'18px', pointerEvents:'auto'
      });
      root.appendChild(x);

      // Wire joystick
      let touching=false, cx=60, cy=60;
      function setKnob(x,y){ knob.style.left=(x-28)+'px'; knob.style.top=(y-28)+'px'; }
      joyRoot.addEventListener('pointerdown',e=>{ touching=true; joyRoot.setPointerCapture(e.pointerId); });
      joyRoot.addEventListener('pointerup',e=>{ touching=false; moveRaw.f=moveRaw.b=moveRaw.l=moveRaw.r=0; setKnob(cx,cy); });
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching) return;
        const r = joyRoot.getBoundingClientRect();
        const x = Math.max(0, Math.min(120, e.clientX - r.left));
        const y = Math.max(0, Math.min(120, e.clientY - r.top));
        setKnob(x,y);
        const dx = (x-cx)/60, dy = (y-cy)/60;
        moveRaw.f = (-dy>0 ? -dy : 0);
        moveRaw.b = (dy>0 ? dy : 0);
        moveRaw.r = (dx>0 ? dx : 0);
        moveRaw.l = (-dx>0 ? -dx : 0);
      });

      j.addEventListener('click', ()=> { if (Math.abs(playerY) < 0.02) velY = cfg.jumpVel; });
      x.addEventListener('click', ()=> toggleFPV(false));

      joy = { root:joyRoot, knob }; jumpBtn=j; exitBtn=x;
    }

    $('stagePanel')?.appendChild(root);
    hud = root;
  }

  function destroyHUD(){
    if (hud && hud.parentNode){ hud.parentNode.removeChild(hud); }
    hud=null; pathBtn=null; joy=null; jumpBtn=null; exitBtn=null;
  }

  function getPathPoints(){
    const pts = (window.QUANTUMI?.path) || [];
    return pts.length>=3 ? pts : [];
  }

  function rebuildCurveAndTube(){
    const pts = getPathPoints();
    if (pts.length<3) return false;

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);

    // Approx length
    const tmp = curve.getPoints(800);
    let L=0; for(let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);

    // Tube (hidden by default)
    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(1600, pts.length*6), cfg.tubeRadius, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color:0x00ff7f, emissive:0x00331c, transparent:true, opacity:0.85, roughness:0.35, metalness:0.05
    });
    tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'HashTube';
    tube.visible = false; // hidden by default
    Q.scene.add(tube);

    // Sync Path button state if exists
    const headerBtn = $('toggle-path');
    if (headerBtn) headerBtn.onclick = ()=> {
      const on = !tube.visible;
      tube.visible = on;
      headerBtn.setAttribute('aria-pressed', String(on));
    };
    pathBtn && pathBtn.setAttribute('aria-pressed','false');
    return true;
  }

  // Fullscreen helpers — FPV uses fullscreen; standalone fullscreen buttons remain unchanged
  function enterFullscreen(el){ el?.requestFullscreen?.().catch(()=>{}); }
  function exitFullscreen(){ if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }

  // Keyboard bindings (desktop)
  function bindKeys(){
    window.addEventListener('keydown', (e)=>{
      if (!isFPV) return;
      if (['INPUT','TEXTAREA'].includes((document.activeElement?.tagName||''))) return;
      const k = e.key.toLowerCase();
      if (k==='w') moveRaw.f = 1;
      if (k==='s') moveRaw.b = 1;
      if (k==='a') moveRaw.l = 1;
      if (k==='d') moveRaw.r = 1;
      if (k==='shift') moveRaw.run = 1;
      if (k===' ') { if (Math.abs(playerY) < 0.02) velY = cfg.jumpVel; }
      if (k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', (e)=>{
      if (!isFPV) return;
      const k = e.key.toLowerCase();
      if (k==='w') moveRaw.f = 0;
      if (k==='s') moveRaw.b = 0;
      if (k==='a') moveRaw.l = 0;
      if (k==='d') moveRaw.r = 0;
      if (k==='shift') moveRaw.run = 0;
    });
  }

  // Smoothing helper
  function easeToward(cur, target, dt){
    const diff = target - cur;
    const rate = (Math.abs(target) > Math.abs(cur)) ? cfg.easeIn : cfg.easeOut;
    return cur + diff * Math.min(1, rate * dt);
  }

  function tick(dt){
    if (!isFPV || !curve) return;

    // Smooth input
    const targetFwd = (moveRaw.f - moveRaw.b);
    const targetLat = (moveRaw.r - moveRaw.l);
    moveSm.fwd = easeToward(moveSm.fwd, targetFwd, dt);
    moveSm.lat = easeToward(moveSm.lat, targetLat, dt);

    // Advance along curve
    const speed = cfg.baseSpeed * (moveRaw.run ? cfg.runBoost : 1);
    runnerT = (runnerT + (moveSm.fwd * speed * dt) / curveLen + 1) % 1;

    // Jump/gravity
    velY -= cfg.gravity * dt;
    playerY += velY * dt;
    if (playerY < 0){ playerY = 0; velY = 0; }

    // Sample curve
    const pos = curve.getPointAt(runnerT);
    const tan = curve.getTangentAt(runnerT).normalize();
    const up  = new THREE.Vector3(0,1,0);
    const side= new THREE.Vector3().crossVectors(tan, up).normalize();

    const eye = pos.clone()
      .add(up.clone().multiplyScalar(cfg.eyeHeight + playerY))
      .add(side.multiplyScalar(moveSm.lat * cfg.strafeSpeed * 0.4));
    const look = curve.getPointAt((runnerT + (cfg.lookAhead/curveLen)) % 1);

    const cam = Q.camera;
    cam.position.lerp(eye, cfg.camPosLerp);
    const m = new THREE.Matrix4().lookAt(eye, look, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, cfg.camRotSlerp);

    Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
  }

  function toggleFPV(on){
    if (on === isFPV) return;
    isFPV = !!on;

    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      if (!rebuildCurveAndTube()){
        console.warn('FPV: missing path points');
        isFPV=false; return;
      }
      runnerT = 0; playerY=0; velY=0;

      // Disable OrbitControls
      Q.controls && (Q.controls.enabled=false);

      // Fullscreen stage
      enterFullscreen($('stagePanel'));

      // Build HUD (adds joystick on mobile automatically)
      buildHUD();
    } else {
      // Restore controls
      Q && Q.controls && (Q.controls.enabled=true, Q.controls.update?.());
      destroyHUD();
      // Keep tube object; still hidden unless toggled on
      exitFullscreen();
      // Reset inputs
      Object.assign(moveRaw,{f:0,b:0,l:0,r:0,run:0});
      Object.assign(moveSm,{fwd:0,lat:0});
    }
  }

  function bindUI(){
    // Only “Explore” toggles FPV.
    const explore = $('play-fp');
    if (explore){
      explore.onclick = ()=> toggleFPV(!isFPV);
      explore.title = 'Explore BTC hash in first-person (toggle)';
    }

    // DO NOT hook fullscreen-only buttons (#toggle-fs, #mobile-fs-toggle).

    // Rebuild tube when new data cloud is produced
    document.addEventListener('quantumi:cloud', ()=> rebuildCurveAndTube());

    // Safety: exit FPV when the page is hidden (e.g., app switch on mobile)
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) toggleFPV(false); });
  }

  function start(){
    if (!window.QUANTUMI?.scene) return setTimeout(start, 60);
    Q = window.QUANTUMI;

    // Frame driving
    document.addEventListener('quantumi:tick', (e)=> tick(e.detail.dt));
    document.addEventListener('quantumi:frame', (e)=>{
      const dt = (e?.detail?.dt) ?? 0.016; tick(dt);
    });

    bindKeys();
    bindUI();
  }

  start();
})();

