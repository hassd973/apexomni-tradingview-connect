// QUANTUMI add-on: first-person Explore mode + generative style recoloring (non-destructive)
// Works with three r128. Depends on window.QUANTUMI (exposed by the patch) and PointerLockControls.

(function(){
  const wait = (cond, t=50) => new Promise(res=>{
    const tick=()=>cond()?res():setTimeout(tick,t);
    tick();
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
    let bounds = computeBounds();
    let pathPoints = []; let lastPathLen = 0;
    let active = false;
    const canvas = Q.renderer.domElement;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const canPointerLock = !!canvas.requestPointerLock && !isMobile;
    let lookTouchId = -1, moveTouchId = -1;
    let lookX = 0, lookY = 0, moveSX = 0, moveSY = 0;

    // update bounds whenever a new cloud is added (we can hook into your frame loop cheaply)
    let frameCount = 0;
    document.addEventListener('quantumi:frame', ()=>{
      if (++frameCount % 180 === 0) { bounds = computeBounds(); }
      if (active && pathPoints.length !== lastPathLen){
        const obj = controlsFP.getObject();
        const p = pathPoints[pathPoints.length-1];
        if (p){ obj.position.set(p.x, p.y + HEIGHT, p.z); }
        lastPathLen = pathPoints.length;
      }
      if (!active) return;

      // Integrate simple kinematics each frame
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

      const groundY = getGroundHeight(obj.position.x, obj.position.z) + HEIGHT;
      if (obj.position.y <= groundY){ v.y = 0; obj.position.y = groundY; keys.ground = true; } else { keys.ground = false; }

      obj.position.x = Math.max(bounds.min.x-2, Math.min(bounds.max.x+2, obj.position.x));
      obj.position.z = Math.max(bounds.min.z-2, Math.min(bounds.max.z+2, obj.position.z));
    });

    document.addEventListener('quantumi:cloud', ()=>{
      bounds = computeBounds();
      lastPathLen = pathPoints.length;
      if (active){
        const obj = controlsFP.getObject();
        const p = pathPoints[pathPoints.length-1];
        if (p){ obj.position.set(p.x, p.y + HEIGHT, p.z); }
      }
    });

    function computeBounds(){
      const clouds = Q.dotClouds || [];
      const latest = clouds[clouds.length-1];
      const box = new THREE_.Box3(new THREE_.Vector3(-12,-2,-12), new THREE_.Vector3(12,6,12));
      pathPoints = [];
      if (latest && latest.geometry){
        const pos = latest.geometry.getAttribute('position');
        if (pos){
          for (let i=0;i<pos.count;i++){
            const p = new THREE_.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            pathPoints.push(p);
            box.expandByPoint(p);
          }
        }
        return box.expandByScalar(2);
      }
      return box;
    }

    function getGroundHeight(x,z){
      if (!pathPoints.length) return bounds.min.y;
      let min=Infinity, y=bounds.min.y;
      for (const p of pathPoints){
        const dx=p.x-x, dz=p.z-z; const d=dx*dx+dz*dz;
        if (d<min){ min=d; y=p.y; }
      }
      return y;
    }

    // key handlers only while pointer-locked
    function onKeyDown(e){
      switch(e.code){
        case 'KeyW': case 'ArrowUp': keys.f = true; break;
        case 'KeyS': case 'ArrowDown': keys.b = true; break;
        case 'KeyA': case 'ArrowLeft': keys.l = true; break;
        case 'KeyD': case 'ArrowRight': keys.r = true; break;
        case 'ShiftLeft': case 'ShiftRight': keys.run = true; break;
        case 'Space': if (keys.ground) { v.y += JUMP; keys.ground = false; } break;
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

    function onTouchStart(e){
      e.preventDefault();
      for (const t of e.changedTouches){
        if (t.clientX < window.innerWidth / 2 && moveTouchId === -1){
          moveTouchId = t.identifier;
          moveSX = t.clientX;
          moveSY = t.clientY;
        } else if (lookTouchId === -1){
          lookTouchId = t.identifier;
          lookX = t.clientX;
          lookY = t.clientY;
        }
      }
    }
    function onTouchMove(e){
      e.preventDefault();
      for (const t of e.changedTouches){
        if (t.identifier === moveTouchId){
          const dx = t.clientX - moveSX;
          const dy = t.clientY - moveSY;
          keys.f = dy < -10; keys.b = dy > 10;
          keys.l = dx < -10; keys.r = dx > 10;
        } else if (t.identifier === lookTouchId){
          const dx = t.clientX - lookX;
          const dy = t.clientY - lookY;
          lookX = t.clientX; lookY = t.clientY;
          const yaw = controlsFP.getObject();
          const pitch = yaw.children[0];
          yaw.rotation.y -= dx * 0.002;
          if (pitch){
            pitch.rotation.x -= dy * 0.002;
            pitch.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch.rotation.x));
          }
        }
      }
    }
    function onTouchEnd(e){
      for (const t of e.changedTouches){
        if (t.identifier === moveTouchId){
          moveTouchId = -1;
          keys.f = keys.b = keys.l = keys.r = false;
        }
        if (t.identifier === lookTouchId){
          lookTouchId = -1;
        }
      }
    }

    async function ensureFullscreen(){
      if (document.fullscreenElement) return;
      try{
        const mod = await import('../fullscreen.js');
        await mod.toggleFullscreen(stage);
      }catch(e){ console.warn('FS request failed', e); }
    }
    async function enterFP(){
      ensureFullscreen();
      bounds = computeBounds();
      lastPathLen = pathPoints.length;
      const p = pathPoints[pathPoints.length-1];
      if (p){
        const obj = controlsFP.getObject();
        obj.position.set(p.x, p.y + HEIGHT, p.z);
        const look = pathPoints[pathPoints.length-2] || new THREE_.Vector3();
        obj.lookAt(look.x, look.y + HEIGHT, look.z);
      }
      if (canPointerLock){
        Q.controls.enabled = false;
        controlsFP.lock();
      } else {
        Q.controls.enabled = false;
        active = true;
        hud?.classList.add('on');
        setPlayState(true);
        document.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchcancel', onTouchEnd);
      }
    }
    function exitFP(){
      if (canPointerLock){
        controlsFP.unlock();
      } else {
        active = false;
        hud?.classList.remove('on');
        setPlayState(false);
        Q.controls.enabled = true;
        keys.f = keys.b = keys.l = keys.r = false;
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
      }
      if (document.fullscreenElement) document.exitFullscreen?.();
    }

    window.enterFP = enterFP;

    function setPlayState(on){
      if (!playBtn) return;
      playBtn.textContent = on ? '■ Exit' : '▶ Explore';
      playBtn.title = on ? 'Exit explore' : 'Enter first-person explore';
    }

    controlsFP.addEventListener('lock', ()=>{
      active = true;
      hud?.classList.add('on');
      setPlayState(true);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
    });
    controlsFP.addEventListener('unlock', ()=>{
      active = false;
      hud?.classList.remove('on');
      setPlayState(false);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      Q.controls.enabled = true;
    });

    playBtn?.addEventListener('click', ()=>{ active ? exitFP() : enterFP(); });
    document.getElementById('mobile-fs-toggle')?.addEventListener('click', ()=>{ /* mobile FS already handled by page */ });

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
      // let theme chip reflect style
      const chip = document.getElementById('m-mode');
      if (chip) chip.textContent = `Mode — ${cfg.label}`;
    }

    function inferStyle(p){
      const s = p.toLowerCase();
      // palettes (r,g,b in 0..1)
      const C = (hex)=>new THREE_.Color(hex);
      const A = C('#6bdc7a'), B = C('#1e6a37');        // grass
      const R1= C('#8d8d93'), R2=C('#333338');         // rock
      const W1= C('#56a7e6'), W2=C('#0a2749');         // water
      const F1= C('#fb6aa9'), F2=C('#f6e85a');         // flower
      const N1= C('#a6c8ff'), N2=C('#1b3f66');         // neon city/sky
      const toRGB=(c)=>({r:c.r,g:c.g,b:c.b});
      let label='Custom', a=N1, b=N2, mode='gradient';
      if (/(grass|meadow|field|forest|green)/.test(s)){ label='Grass'; a=A; b=B; }
      else if (/(rock|stone|canyon|mountain|desert)/.test(s)){ label='Rock'; a=R1; b=R2; }
      else if (/(water|ocean|sea|lake|wave|river)/.test(s)){ label='Water'; a=W1; b=W2; }
      else if (/(flower|bloom|garden|petal)/.test(s)){ label='Floral'; a=F1; b=F2; }
      else if (/(city|neon|cyber|tower|building)/.test(s)){ label='Neon'; a=N1; b=N2; }
      if (/noise|grain|speck|sparkle/.test(s)) mode='noise';
      // scan current cloud bounds to set y-range
      const bb = computeBounds();
      return { label, a:toRGB(a), b:toRGB(b), yMin:bb.min.y, yMax:bb.max.y, mode };
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
        // Fallback: inject if missing
        const right = document.querySelector('.brand .right');
        if (right){
          btn = document.createElement('button');
          btn.className='btn'; btn.id='play-fp'; btn.title='Enter first-person explore';
          btn.textContent='▶ Explore';
          // insert after fullscreen button if present
          const fs = document.getElementById('toggle-fs');
          fs?.insertAdjacentElement('afterend', btn) || right.appendChild(btn);
        }
      }
      return btn;
    }

    function ensureStyleControls(){
      const panel = document.querySelector('#controls-rail .controls');
      if (!panel) return null;
      // Only add once
      if (document.getElementById('stylePrompt')) {
        return { input: document.getElementById('stylePrompt'), apply: document.getElementById('applyStyle') };
      }
      const wrap = document.createElement('div');
      wrap.className='ctrl'; wrap.title='Live recolor point clouds by prompt (e.g., "lush grass", "rocky canyon", "neon city")';
      wrap.innerHTML = `
        <label>Style Prompt</label>
        <input id="stylePrompt" type="text" placeholder="e.g. lush grass, neon city, rocky canyon" autocomplete="off">
        <button class="btn" id="applyStyle" type="button">Apply</button>
      `;
      panel.appendChild(wrap);
      return { input: wrap.querySelector('#stylePrompt'), apply: wrap.querySelector('#applyStyle') };
    }

    // ESC exits explore (PointerLock handles most, but ensure UI toggles)
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && (controlsFP.isLocked || active)) { exitFP(); }
    });
  });
})();
