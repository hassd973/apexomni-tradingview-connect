// QUANTUMI add-on: first-person Explore mode + generative style recoloring (non-destructive)
// Adds PointerLock + auto-fullscreen, and snaps player to latest BTC hash point-cloud height.
// No changes to your data flow: original mapping + hash layouts still render as before.

(function(){
  const wait = (cond, t=50) => new Promise(res=>{
    const tick=()=>cond()?res():setTimeout(tick,t); tick();
  });

  document.addEventListener('DOMContentLoaded', async ()=>{
    await wait(()=>window.QUANTUMI && window.THREE);

    const Q = window.QUANTUMI;
    const THREE_ = window.THREE;
    const stage = document.getElementById('stagePanel');
    const hud = document.getElementById('fp-hud');
    const playBtn = ensurePlayButton();
    const styleCtrl = ensureStyleControls();

    // ---------- Explore (First-person) ----------
    const controlsFP = new THREE_.PointerLockControls(Q.camera, Q.renderer.domElement);
    Q.scene.add(controlsFP.getObject());

    // movement state
    const v = new THREE_.Vector3();
    const dir = new THREE_.Vector3();
    const up = new THREE_.Vector3(0,1,0);
    const keys = { f:false,b:false,l:false,r:false,run:false,ground:false };
    const SPEED=9, RUN=1.8, GRAV=28, JUMP=10, HEIGHT=1.6;
    let active = false;

    // ---- Spatial index over latest cloud so we can "walk on the hash" ----
    // Grid hashmap: key = ix,iz; value = {yMax, count, yAvg}
    let grid=null, gridSize=0.6, yMin=-2, yMax=6, lastCloudCount=-1;

    function rebuildSpatialIndex(){
      grid = new Map();
      const clouds = Q.dotClouds || [];
      const latest = clouds[clouds.length-1];
      if (!latest || !latest.geometry) return;
      const pos = latest.geometry.getAttribute('position');
      if (!pos) return;

      yMin = +Infinity; yMax = -Infinity;
      for (let i=0;i<pos.count;i++){
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
        const ix = Math.floor(x / gridSize), iz = Math.floor(z / gridSize);
        const key = ix + ',' + iz;
        let cell = grid.get(key);
        if (!cell) { cell = { yMax: y, ySum: y, count: 1 }; grid.set(key, cell); }
        else { cell.yMax = Math.max(cell.yMax, y); cell.ySum += y; cell.count++; }
      }
      lastCloudCount = clouds.length;
    }

    function yAt(x, z){
      if (!grid || grid.size===0) return null;
      const ix = Math.floor(x / gridSize), iz = Math.floor(z / gridSize);
      // Look in 3x3 neighborhood for a cell
      let best = null;
      for (let dx=-1; dx<=1; dx++){
        for (let dz=-1; dz<=1; dz++){
          const cell = grid.get((ix+dx)+','+(iz+dz));
          if (!cell) continue;
          const h = cell.yMax; // choose max to favor "top" of cloud clusters
          best = (best==null) ? h : Math.max(best, h);
        }
      }
      return best;
    }

    function ensureIndexUpToDate(){
      const count = (Q.dotClouds||[]).length;
      if (grid==null || count !== lastCloudCount) rebuildSpatialIndex();
    }

    // update per frame
    document.addEventListener('quantumi:frame', ()=>{
      ensureIndexUpToDate();
      if (!active) return;

      // Integrate simple kinematics each frame (fixed small step)
      const dt = 1/60;
      v.x -= v.x * 8 * dt;
      v.z -= v.z * 8 * dt;
      v.y -= GRAV * dt;

      dir.set((keys.r?1:0)-(keys.l?1:0), 0, (keys.b?1:0)-(keys.f?1:0)).normalize();
      if (dir.lengthSq() > 0) {
        const forward = new THREE_.Vector3();
        controlsFP.getDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE_.Vector3().crossVectors(forward, up).negate();
        const mul = SPEED * (keys.run?RUN:1);
        v.addScaledVector(forward, -dir.z * mul * dt * 60);
        v.addScaledVector(right,   dir.x * mul * dt * 60);
      }

      const obj = controlsFP.getObject();
      obj.position.addScaledVector(v, dt);

      // Snap to BTC hash surface height (walk/climb on cloud)
      const h = yAt(obj.position.x, obj.position.z);
      const floorY = (h!=null ? h : yMin) + HEIGHT;

      if (obj.position.y <= floorY){ v.y = 0; obj.position.y = floorY; keys.ground = true; }
      else { keys.ground = false; }

      // gentle climb assist: if we're slightly above target, ease down
      const diff = obj.position.y - floorY;
      if (diff > 0 && diff < 0.5){ obj.position.y -= Math.min(diff, 0.02); }

      // Clamp horizontal wandering to the cloud's rough bounds
      const bb = latestBounds();
      obj.position.x = Math.max(bb.min.x-2, Math.min(bb.max.x+2, obj.position.x));
      obj.position.z = Math.max(bb.min.z-2, Math.min(bb.max.z+2, obj.position.z));
    });

    function latestBounds(){
      const clouds = Q.dotClouds || [];
      const latest = clouds[clouds.length-1];
      const box = new THREE_.Box3(new THREE_.Vector3(-12,-2,-12), new THREE_.Vector3(12,6,12));
      if (latest && latest.geometry){
        latest.geometry.computeBoundingBox?.();
        if (latest.geometry.boundingBox) return latest.geometry.boundingBox.clone().expandByScalar(2);
      }
      return box;
    }

    // key handlers only while pointer-locked
    function onKeyDown(e){
      switch(e.code){
        case 'KeyW': case 'ArrowUp': keys.f = true; break;
        case 'KeyS': case 'ArrowDown': keys.b = true; break;
        case 'KeyA': case 'ArrowLeft': keys.l = true; break;
        case 'KeyD': case 'ArrowRight': keys.r = true; break;
        case 'ShiftLeft': case 'ShiftRight': keys.run = true; break;
        case 'Space': if (keys.ground) { keys.ground=false; v.y += JUMP; } break;
        case 'KeyF': toggleFullscreen(); break; // convenience
      }
    }
    function onKeyUp(e){
      switch(e.code){
        case 'KeyW': case 'ArrowUp': keys.f = false; break;
        case 'KeyS': case 'ArrowDown': keys.b = false; break;
        case 'KeyA': case 'ArrowLeft': keys.l = false; break;
        case 'KeyD': case 'ArrowRight': keys.r = false; break;
        case 'ShiftLeft': case 'ShiftRight': keys.run = false; break;
      }
    }

    async function enterFP(){
      // Ensure latest clouds present & index ready (but do not change normal loading)
      ensureIndexUpToDate();
      // Auto-enter fullscreen focused on the stage
      await enterFullscreen();
      // disable Orbit while exploring; pointer lock last so click grants both FS + lock
      Q.controls.enabled = false;
      controlsFP.lock();
    }
    function exitFP(){
      controlsFP.unlock();
    }

    controlsFP.addEventListener('lock', ()=>{
      active = true;
      hud?.classList.add('on');
      // place camera at surface if below
      const bb = latestBounds();
      const y = (yAt(Q.camera.position.x, Q.camera.position.z) ?? bb.min.y) + HEIGHT;
      if (Q.camera.position.y < y) Q.camera.position.y = y;
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
    });
    controlsFP.addEventListener('unlock', ()=>{
      active = false;
      hud?.classList.remove('on');
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      Q.controls.enabled = true;
      // keep fullscreen until user presses Esc again; optional: exit FS here if desired
    });

    playBtn?.addEventListener('click', enterFP);

    // ---------- Generative Style Mapping (prompt → live recolor) ----------
    styleCtrl?.apply.addEventListener('click', ()=>{
      const prompt = (styleCtrl.input.value || '').trim();
      if (!prompt) return;
      recolorAllClouds(prompt);
    });

    function recolorAllClouds(prompt){
      const cfg = inferStyle(prompt);
      const rng = mulberry32(hash32(prompt));
      for (const cloud of (Q.dotClouds||[])){
        if (!cloud || !cloud.isPoints || !cloud.geometry) continue;
        const g = cloud.geometry;
        const pos = g.getAttribute('position');
        let col = g.getAttribute('color');
        if (!col || col.count !== pos.count){
          col = new THREE_.BufferAttribute(new Float32Array(pos.count*3), 3);
          g.setAttribute('color', col);
        }
        for (let i=0;i<pos.count;i++){
          const y = pos.getY(i);
          const t = cfg.mode==='noise'
            ? (rng() * 0.4 + 0.6*Math.max(0,Math.min(1,(y - cfg.yMin)/(cfg.yMax-cfg.yMin+1e-6))))
            : Math.max(0,Math.min(1,(y - cfg.yMin)/(cfg.yMax-cfg.yMin+1e-6)));
          const r = cfg.a.r + (cfg.b.r - cfg.a.r)*t;
          const g1= cfg.a.g + (cfg.b.g - cfg.a.g)*t;
          const b = cfg.a.b + (cfg.b.b - cfg.a.b)*t;
          col.setX(i, r); col.setY(i, g1); col.setZ(i, b);
        }
        col.needsUpdate = true;
        cloud.material.vertexColors = true;
      }
      const chip = document.getElementById('m-mode');
      if (chip) chip.textContent = `Mode — ${cfg.label}`;
      // after recolor, refresh index bounds in case Y range was updated upstream
      ensureIndexUpToDate();
    }

    function inferStyle(p){
      const s = p.toLowerCase();
      const C = (hex)=>new THREE_.Color(hex);
      const A = C('#6bdc7a'), B = C('#1e6a37');        // grass
      const R1= C('#8d8d93'), R2=C('#333338');         // rock
      const W1= C('#56a7e6'), W2=C('#0a2749');         // water
      const F1= C('#fb6aa9'), F2=C('#f6e85a');         // flower
      const N1= C('#a6c8ff'), N2=C('#1b3f66');         // neon
      const toRGB=(c)=>({r:c.r,g:c.g,b:c.b});
      let label='Custom', a=N1, b=N2, mode='gradient';
      if (/(grass|meadow|field|forest|green)/.test(s)){ label='Grass'; a=A; b=B; }
      else if (/(rock|stone|canyon|mountain|desert)/.test(s)){ label='Rock'; a=R1; b=R2; }
      else if (/(water|ocean|sea|lake|wave|river)/.test(s)){ label='Water'; a=W1; b=W2; }
      else if (/(flower|bloom|garden|petal)/.test(s)){ label='Floral'; a=F1; b=F2; }
      else if (/(city|neon|cyber|tower|building)/.test(s)){ label='Neon'; a=N1; b=N2; }
      if (/noise|grain|speck|sparkle/.test(s)) mode='noise';
      const bb = latestBounds();
      yMin = bb.min.y; yMax = bb.max.y;
      return { label, a:toRGB(a), b:toRGB(b), yMin, yMax, mode };
    }

    function hash32(str){
      let h=2166136261>>>0;
      for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
      return h>>>0;
    }
    function mulberry32(a){ return function(){ let t = (a += 0x6D2B79F5); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    // ---------- UI helpers (all additive, no HTML rewrite required) ----------
    function ensurePlayButton(){
      let btn = document.getElementById('play-fp');
      if (!btn){
        const right = document.querySelector('.brand .right');
        if (right){
          btn = document.createElement('button');
          btn.className='btn'; btn.id='play-fp'; btn.title='Enter first-person explore';
          btn.textContent='▶ Explore';
          const fs = document.getElementById('toggle-fs');
          fs?.insertAdjacentElement('afterend', btn) || right.appendChild(btn);
        }
      }
      return btn;
    }

    function ensureStyleControls(){
      const panel = document.querySelector('#controls-rail .controls');
      if (!panel) return null;
      if (document.getElementById('stylePrompt')) {
        return { input: document.getElementById('stylePrompt'), apply: document.getElementById('applyStyle') };
      }
      const wrap = document.createElement('div');
      wrap.className='ctrl'; wrap.title='Live recolor point clouds by prompt (e.g., "lush grass", "neon city", "rocky canyon")';
      wrap.innerHTML = `
        <label>Style Prompt</label>
        <input id="stylePrompt" type="text" placeholder="e.g. lush grass, neon city, rocky canyon" autocomplete="off">
        <button class="btn" id="applyStyle" type="button">Apply</button>
      `;
      panel.appendChild(wrap);
      return { input: wrap.querySelector('#stylePrompt'), apply: wrap.querySelector('#applyStyle') };
    }

    // --- Fullscreen helpers (independent of page's internal FS code) ---
    async function enterFullscreen(){
      try{
        if (stage.requestFullscreen){ await stage.requestFullscreen({ navigationUI: 'hide' }); }
        else if (stage.webkitRequestFullscreen){ stage.webkitRequestFullscreen(); }
      }catch(e){ /* ignore; pointer lock will still work */ }
    }
    function toggleFullscreen(){
      if (document.fullscreenElement || document.webkitFullscreenElement){
        try{ document.exitFullscreen?.(); document.webkitExitFullscreen?.(); }catch{}
      } else {
        enterFullscreen();
      }
    }

    // ESC exits explore (PointerLock handles most, but ensure UI toggles)
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && controlsFP.isLocked) { exitFP(); }
    });
  });
})();

