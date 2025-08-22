/* fpv-explore.js — FPS look + thin/adjustable path + settings */
import { loadSettings, saveSettings, DEFAULTS, bindSettingsBus, emitSettingsChanged } from "./game-settings.js";
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;

  let Q, curve=null, tube=null, curveLen=1, bounds=null;
  let isFPV=false, pathVisible=false;

  // Surface params
  let t=0, u=Math.PI;
  let yaw=0, pitch=0; // radians

  // Runtime settings
  let S = loadSettings();

  // Input state
  const key = new Set();
  const inp = { fwd:0, strafe:0, run:0, lookX:0, lookY:0 };

  // --- Helpers ---
  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }
  function computeBounds(pts){ const bb = new THREE.Box3(); pts.forEach(p=>bb.expandByPoint(p)); return bb; }
  function pathRadiusAuto(bb){
    const size = bb.getSize(new THREE.Vector3()).length();
    const r = Math.max(0.12, Math.min(0.5, size*0.012));
    return r;
  }
  function currentRadius(){
    if (!bounds) return (S.pathRadiusMode==='fixed') ? S.pathRadiusFixed : 0.22;
    return S.pathRadiusMode==='fixed' ? S.pathRadiusFixed : pathRadiusAuto(bounds);
  }

  // Build or rebuild curve + tube (hidden unless toggled)
  function buildCurveAndTube(){
    const pts = getPathPoints(); if (!pts || pts.length<3) return false;
    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', .25);
    const tmp = curve.getPoints(1200); let L=0; for (let i=1;i<tmp.length;i++) L += tmp[i-1].distanceTo(tmp[i]);
    curveLen = Math.max(1e-3, L);
    bounds = computeBounds(pts);

    if (tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const r = currentRadius();
    const geo = new THREE.TubeGeometry(curve, Math.min(2400, pts.length*6), r, 14, false);
    const mat = new THREE.MeshStandardMaterial({ color:0x00ff7f, emissive:0x00331c, roughness:0.35, metalness:0.05, transparent:true, opacity:0.38 });
    tube = new THREE.Mesh(geo, mat); tube.name='HashTube'; tube.visible = pathVisible;
    Q.scene.add(tube);
    return true;
  }

  // Stable frame at t
  function frameAt(tt){
    const T = curve.getTangentAt(tt).normalize();
    const refUp = Math.abs(T.y)>0.92 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const N = new THREE.Vector3().crossVectors(refUp, T).normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    return {T,N,B};
  }

  // Pointer-lock mouse look (desktop)
  function enablePointerLock(el){
    el?.addEventListener('click', ()=>{ if (!document.pointerLockElement) el.requestPointerLock?.(); });
    window.addEventListener('mousemove', (e)=>{
      if (!isFPV || document.pointerLockElement!==el) return;
      const sens = (S.sens/100); // convert to rad/pixel scale
      yaw   -= e.movementX * sens;
      const invert = S.invertY ? -1 : 1;
      pitch -= e.movementY * sens * invert;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
    });
  }

  // Keyboard
  function bindKeys(){
    window.addEventListener('keydown', (e)=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); key.add(k);
      if (k==='w' || k==='arrowup')    inp.fwd =  1;
      if (k==='s' || k==='arrowdown')  inp.fwd = -1;
      if (k==='a' || k==='arrowleft')  inp.strafe = -1;
      if (k==='d' || k==='arrowright') inp.strafe =  1;
      if (k==='shift') inp.run = 1;
      if (k==='x'){ setPathVisible(!pathVisible); }
      if (k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup', (e)=>{
      if (!isFPV) return;
      const k=e.key.toLowerCase(); key.delete(k);
      if (k==='w' || k==='s' || k==='arrowup' || k==='arrowdown') inp.fwd = 0;
      if (k==='a' || k==='d' || k==='arrowleft' || k==='arrowright') inp.strafe = 0;
      if (k==='shift') inp.run = 0;
    });
  }

  // Gamepad (Xbox)
  const latch = { X:false, B:false };
  function pollPad(){
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (!pads.length) return;
    const gp = pads[0], dz=0.12;
    const lx = gp.axes[0]||0, ly = gp.axes[1]||0, rx = gp.axes[2]||0, ry = gp.axes[3]||0;
    inp.strafe = Math.abs(lx)>dz ? lx : (key.size?inp.strafe:0);
    inp.fwd    = Math.abs(ly)>dz ? -ly : (key.size?inp.fwd:0);
    const sens = (S.sens/100)*1.65;
    yaw   -= (Math.abs(rx)>dz ? rx : 0) * sens*16;
    const invert = S.invertY ? -1 : 1;
    pitch -= (Math.abs(ry)>dz ? ry : 0) * sens*16 * invert;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    inp.run = (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) ? 1 : (key.has('shift')?1:0);
    if (gp.buttons[2]?.pressed && !latch.X){ setPathVisible(!pathVisible); latch.X=true; }
    if (!gp.buttons[2]?.pressed) latch.X=false;
    if (gp.buttons[1]?.pressed && !latch.B){ toggleFPV(false); latch.B=true; }
    if (!gp.buttons[1]?.pressed) latch.B=false;
  }

  // Mobile swipe-look + joystick
  function buildHUD(){
    if ($('fp-hud')){ $('fp-hud').classList.add('on'); $('fp-hud').setAttribute('aria-hidden','false'); return; }
  }

  function destroyHUD(){
    const hud=$('fp-hud'); if (hud){ hud.classList.remove('on'); hud.setAttribute('aria-hidden','true'); }
  }

  // Path visibility + helpers
  function setPathVisible(on){
    pathVisible = !!on;
    if (tube) tube.visible = pathVisible;
    $('toggle-path')?.setAttribute('aria-pressed', String(pathVisible));
  }

  // Movement (critically damped; project onto tube)
  const sm = { fwd:0, strafe:0 };
  function damp(cur,tgt,rate,dt){ return cur + (tgt-cur) * Math.min(1, rate*dt); }

  function update(dt){
    if (!isFPV || !curve) return;
    pollPad();

    // Smoothen move
    const rise=18, fall=18;
    sm.fwd    = damp(sm.fwd,    inp.fwd,    (inp.fwd===0?fall:rise), dt);
    sm.strafe = damp(sm.strafe, inp.strafe, (inp.strafe===0?fall:rise), dt);

    // Frame at t
    const {T,N,B} = frameAt(t);

    // Look vectors (yaw around B, pitch around N)
    const yawM = new THREE.Matrix4().makeRotationAxis(B, yaw);
    const pitchM = new THREE.Matrix4().makeRotationAxis(N, pitch);
    const lookDir = T.clone().applyMatrix4(yawM).applyMatrix4(pitchM).normalize();

    // Advance along curve proportional to forward * moveSpeed
    const speed = S.moveSpeed * (inp.run? S.runMult : 1);
    const fwdAlongT = Math.max(0, lookDir.dot(T)); // forward only
    t = (t + (sm.fwd * speed * fwdAlongT * dt) / curveLen + 1) % 1;

    // Strafe rotates around tube
    u += sm.strafe * (S.strafeSpeed) * dt;

    // Place camera on surface (radius + ride height)
    const pos = curve.getPointAt(t);
    const r   = (tube?.geometry?.parameters?.radius || currentRadius()) + S.rideHeight;
    const radial = new THREE.Vector3().addScaledVector(N, Math.cos(u)).addScaledVector(B, Math.sin(u)).normalize();
    const eye = pos.clone().addScaledVector(radial, r);
    const look = pos.clone().addScaledVector(lookDir, 3.6);

    // Camera
    const cam = Q.camera;
    if (cam.fov !== S.fov){ cam.fov=S.fov; cam.updateProjectionMatrix(); }
    if (cam.near !== 0.01){ cam.near=0.01; cam.updateProjectionMatrix(); }
    cam.position.lerp(eye, 0.5);
    const up = radial.clone().cross(T).normalize();
    const m = new THREE.Matrix4().lookAt(eye, look, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, 0.28);
    Q.controls && (Q.controls.target.copy(look), Q.controls.update?.());
  }

  // Enter/Exit FPV
  function toggleFPV(on){
    if (on===isFPV) return;
    isFPV=!!on;
    if (isFPV){
      if (!Q) Q = window.QUANTUMI;
      // stop orbit/autorotate
      if (Q.controls){ Q.controls.enabled=false; if ('autoRotate' in Q.controls) Q.controls.autoRotate=false; }
      if (!buildCurveAndTube()){ console.warn('FPV: no path'); isFPV=false; return; }
      t=0; u=Math.PI; yaw=0; pitch=0; sm.fwd=sm.strafe=0;

      const stage=$('stagePanel'); stage?.requestFullscreen?.().catch(()=>{});
      if (!isTouch) enablePointerLock(stage);
      buildHUD();
    } else {
      if (Q.controls){ Q.controls.enabled=true; Q.controls.update?.(); }
      document.exitFullscreen?.();
      destroyHUD();
      inp.fwd=inp.strafe=inp.run=0; yaw=0; pitch=0;
    }
  }

  // Settings application (quality preset + UI coupling)
  function applyQuality(){
    const q = S.quality;
    const AA = (q!=='performance');
    const cap = q==='performance' ? 96 : q==='balanced' ? 160 : 320;
    S.antialias = AA;
    S.maxDensity = cap;
    // reflect to UI caps if those inputs exist
    const dens = $('density'); if (dens){ dens.max = String(cap); if (+dens.value > cap) dens.value = String(cap); }
    const pt = $('pointSize'); if (pt){ pt.value = String(S.pointSize); }
    emitSettingsChanged();
  }

  // UI wiring (new controls inside existing rail if IDs present)
  function wireUI(){
    $('play-fp') && ($('play-fp').onclick = ()=> toggleFPV(!isFPV));
    $('toggle-path') && ($('toggle-path').onclick = ()=> setPathVisible(!pathVisible));

    // Live-bind existing sliders if present
    $('pointSize') && $('pointSize').addEventListener('input', e=>{ S.pointSize=parseFloat(e.target.value); window.QUANTUMI?.dotClouds?.forEach(c=>{ if(c.material.size) c.material.size=S.pointSize; }); saveSettings(S); });
    $('density') && $('density').addEventListener('input', e=>{ if (+e.target.value > S.maxDensity) e.target.value = S.maxDensity; saveSettings(S); });

    // Inject a compact “Gameplay” block if not present
    if (!document.getElementById('gameplay-block')){
      const rail = document.querySelector('.controls');
      const div = document.createElement('div'); div.className='ctrl'; div.id='gameplay-block';
      div.innerHTML = `
        <label style="width:100%">Gameplay (FPV)</label>
        <label>FOV</label><input id="cfg-fov" type="range" min="60" max="100" value="${S.fov}"/>
        <label>Sensitivity</label><input id="cfg-sens" type="range" min="0.05" max="0.6" step="0.01" value="${S.sens/100}"/>
        <label>Invert Y</label><select id="cfg-invert"><option value="false"${S.invertY?'':' selected'}>Off</option><option value="true"${S.invertY?' selected':''}>On</option></select>
        <label>Move Speed</label><input id="cfg-move" type="range" min="2.0" max="7.0" step="0.1" value="${S.moveSpeed}"/>
        <label>Run Mult</label><input id="cfg-run" type="range" min="1.1" max="2.2" step="0.05" value="${S.runMult}"/>
        <label>Strafe</label><input id="cfg-strafe" type="range" min="1.0" max="4.0" step="0.1" value="${S.strafeSpeed}"/>
        <label>Path Radius</label>
        <div class="seg" style="margin-bottom:6px">
          <button id="cfg-rad-auto" class="btn" aria-pressed="${S.pathRadiusMode==='auto'}">Auto</button>
          <button id="cfg-rad-fixed" class="btn" aria-pressed="${S.pathRadiusMode==='fixed'}">Fixed</button>
        </div>
        <input id="cfg-rad" type="range" min="0.08" max="0.6" step="0.01" value="${S.pathRadiusFixed}"/>
        <label>HUD Scale</label><input id="cfg-hud" type="range" min="0.8" max="1.4" step="0.05" value="${S.hudScale}"/>
        <label>Quality</label>
        <select id="cfg-quality">
          <option value="performance"${S.quality==='performance'?' selected':''}>Performance</option>
          <option value="balanced"${S.quality==='balanced'?' selected':''}>Balanced</option>
          <option value="quality"${S.quality==='quality'?' selected':''}>Quality</option>
        </select>
        <button class="btn" id="cfg-save">Save</button>
      `;
      rail?.appendChild(div);
      // Wire handlers
      $('#cfg-fov').oninput      = e=>{ S.fov = +e.target.value; saveSettings(S); };
      $('#cfg-sens').oninput     = e=>{ S.sens = +e.target.value * 100; saveSettings(S); };
      $('#cfg-invert').onchange  = e=>{ S.invertY = (e.target.value==='true'); saveSettings(S); };
      $('#cfg-move').oninput     = e=>{ S.moveSpeed = +e.target.value; saveSettings(S); };
      $('#cfg-run').oninput      = e=>{ S.runMult = +e.target.value; saveSettings(S); };
      $('#cfg-strafe').oninput   = e=>{ S.strafeSpeed = +e.target.value; saveSettings(S); };
      $('#cfg-rad-auto').onclick = ()=>{ S.pathRadiusMode='auto'; saveSettings(S); buildCurveAndTube(); };
      $('#cfg-rad-fixed').onclick= ()=>{ S.pathRadiusMode='fixed'; saveSettings(S); buildCurveAndTube(); };
      $('#cfg-rad').oninput      = e=>{ S.pathRadiusFixed = +e.target.value; if (S.pathRadiusMode==='fixed') buildCurveAndTube(); saveSettings(S); };
      $('#cfg-hud').oninput      = e=>{ S.hudScale = +e.target.value; document.documentElement.style.setProperty('--hud-scale', S.hudScale); saveSettings(S); };
      $('#cfg-quality').onchange = e=>{ S.quality = e.target.value; applyQuality(); saveSettings(S); };
      $('#cfg-save').onclick     = ()=>{ saveSettings(S); };
    }
  }

  // Command palette (Ctrl/Cmd+K)
  function bindCommandPalette(){
    function run(cmd){
      switch(cmd){
        case 'toggle-path': setPathVisible(!pathVisible); break;
        case 'enter-explore': toggleFPV(true); break;
        case 'exit-explore': toggleFPV(false); break;
        case 'reset-view': Q?.controls && (Q.controls.reset?.(), Q.controls.update?.()); break;
        case 'preset-performance': S.quality='performance'; applyQuality(); saveSettings(S); break;
        case 'preset-balanced': S.quality='balanced'; applyQuality(); saveSettings(S); break;
        case 'preset-quality': S.quality='quality'; applyQuality(); saveSettings(S); break;
        case 'photo-mode': document.getElementById('metrics').style.display='none'; document.getElementById('btc-legend').style.display='none'; break;
        case 'show-metrics': document.getElementById('metrics').style.display='flex'; document.getElementById('btc-legend').style.display='flex'; break;
      }
    }
    window.QUANTUMI = window.QUANTUMI || {};
    window.QUANTUMI.commands = {
      run,
      list: [
        ['Toggle Path','toggle-path'],
        ['Enter Explore','enter-explore'],
        ['Exit Explore','exit-explore'],
        ['Reset View','reset-view'],
        ['Preset: Performance','preset-performance'],
        ['Preset: Balanced','preset-balanced'],
        ['Preset: Quality','preset-quality'],
        ['Photo Mode','photo-mode'],
        ['Show Metrics','show-metrics']
      ]
    };
    document.addEventListener('keydown', (e)=>{
      if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
        e.preventDefault();
        const names = window.QUANTUMI.commands.list.map(([n])=>n).join('\n');
        const pick = prompt('Command Palette:\n' + names + '\n\nType exact name:');
        const found = window.QUANTUMI.commands.list.find(([n])=>n.toLowerCase()===String(pick||'').toLowerCase());
        if (found) run(found[1]);
      }
    });
  }

  // Lifecycle
  function start(){
    if (!window.QUANTUMI?.scene){ return setTimeout(start,60); }
    Q = window.QUANTUMI;

    // Rebuild when data cloud changes
    document.addEventListener('quantumi:cloud', ()=>{
      const vis = pathVisible;
      buildCurveAndTube();
      setPathVisible(vis);
    });

    // Per-frame updates
    document.addEventListener('quantumi:tick', (e)=> update(e.detail.dt || 0.016));

    // Wire UI + inputs
    wireUI();
    bindKeys();
    bindCommandPalette();
    bindSettingsBus();
    applyQuality();

    // Expose config API
    window.QUANTUMI.config = {
      get: ()=> ({...S}),
      set: (patch)=>{ S = { ...S, ...patch }; saveSettings(S); if (patch.pathRadiusMode!==undefined || patch.pathRadiusFixed!==undefined) buildCurveAndTube(); },
      reset: ()=> { S = { ...DEFAULTS }; saveSettings(S); buildCurveAndTube(); emitSettingsChanged(); }
    };
    window.QUANTUMI.save = ()=> saveSettings(S);
    window.QUANTUMI.load = ()=> (S = loadSettings());
  }
  start();
})();

