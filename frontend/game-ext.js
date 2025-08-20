// QUANTUMI game extensions: runner and world builder
// This module hooks into studio.html via window.QUANTUMI and custom events.

(function(){
  const q = window.QUANTUMI;
  if(!q) return;
  const scene = q.scene;
  const camera = q.camera;
  const controls = q.controls;

  // --- Runner ---------------------------------------------------------------
  const runnerToggle = document.getElementById('runner-toggle');
  const runnerAttach = document.getElementById('runner-attach');
  const runnerFPV = document.getElementById('runner-fpv');
  const runnerSpeedEl = document.getElementById('runner-speed');
  let runnerSpeed = parseFloat(runnerSpeedEl?.value || '1.2');
  let runner, runnerCurve = null, runnerDist = 0;
  let runnerActive = false, chaseCam = false, fpv = false;

  runnerSpeedEl?.addEventListener('input', e=>{ runnerSpeed = parseFloat(e.target.value); });

  function buildCurve(){
    const pts = q.path || [];
    if(pts.length<2) return null;
    runnerCurve = new THREE.CatmullRomCurve3(pts);
    runnerDist = 0;
    return runnerCurve;
  }

  function startRunner(){
    if(runnerActive) return;
    if(!buildCurve()) return;
    const geom = new THREE.SphereGeometry(0.35,16,16);
    const mat = new THREE.MeshStandardMaterial({ color:0xffaa00, emissive:0x331100 });
    runner = new THREE.Mesh(geom,mat);
    scene.add(runner);
    runnerActive = true;
    runnerToggle.textContent = 'Stop Runner';
    runnerToggle.setAttribute('aria-pressed','true');
  }
  function stopRunner(){
    if(!runnerActive) return;
    scene.remove(runner);
    runner = null;
    runnerActive = false;
    runnerToggle.textContent = 'Start Runner';
    runnerToggle.setAttribute('aria-pressed','false');
    detachCam();
  }
  function toggleRunner(){ runnerActive ? stopRunner() : startRunner(); }

  function toggleAttach(){
    chaseCam = !chaseCam;
    runnerAttach.setAttribute('aria-pressed', String(chaseCam));
    if(!chaseCam) fpv=false;
    runnerFPV.setAttribute('aria-pressed', String(fpv));
    controls.enabled = !fpv;
  }
  function toggleFPV(){
    fpv = !fpv; if(fpv) chaseCam=true; runnerFPV.setAttribute('aria-pressed', String(fpv));
    runnerAttach.setAttribute('aria-pressed', String(chaseCam));
    controls.enabled = !fpv;
  }
  function detachCam(){ chaseCam=false; fpv=false; runnerAttach.setAttribute('aria-pressed','false'); runnerFPV.setAttribute('aria-pressed','false'); controls.enabled=true; }

  runnerToggle?.addEventListener('click', toggleRunner);
  runnerAttach?.addEventListener('click', toggleAttach);
  runnerFPV?.addEventListener('click', toggleFPV);

  document.addEventListener('keydown', e=>{
    if(e.target && ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if(k==='r') toggleRunner();
    if(k==='c') toggleAttach();
    if(k==='f') toggleFPV();
  });

  document.addEventListener('quantumi:cloud', ()=>{ if(runnerActive) buildCurve(); });

  document.addEventListener('quantumi:tick', e=>{
    const dt = e.detail.dt;
    if(!runnerActive || !runnerCurve || !runner) return;
    runnerDist += runnerSpeed * dt;
    const len = runnerCurve.getLength();
    let t = runnerDist / len;
    if(t>1){ t=1; runnerActive=false; }
    const pos = runnerCurve.getPoint(t);
    const tan = runnerCurve.getTangent(t);
    runner.position.copy(pos);
    runner.lookAt(pos.clone().add(tan));
    if(chaseCam){
      if(fpv){
        camera.position.copy(pos.clone().add(new THREE.Vector3(0,0.2,0)));
        camera.lookAt(pos.clone().add(tan));
      }else{
        const behind = pos.clone().add(tan.clone().normalize().multiplyScalar(-3)).add(new THREE.Vector3(0,1,0));
        camera.position.lerp(behind,0.1);
        controls.target.copy(pos);
        controls.update();
      }
    }
  });

  // --- World Builder -------------------------------------------------------
  const promptEl = document.getElementById('worldPrompt');
  const buildBtn = document.getElementById('build-world');
  const resetBtn = document.getElementById('reset-world');
  const modeChip = document.querySelectorAll('#m-mode')[1] || document.getElementById('m-mode');
  const worldObjects = [];

  function clearWorld(){
    while(worldObjects.length){ scene.remove(worldObjects.pop()); }
    modeChip && (modeChip.textContent = 'Mode — World(none)');
  }

  function buildWorld(){
    const prompt = (promptEl.value||'').toLowerCase();
    clearWorld();
    if(!prompt) return;
    if(prompt.includes('neon')){
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshBasicMaterial({color:0x050505}));
      plane.rotation.x = -Math.PI/2; scene.add(plane); worldObjects.push(plane);
      for(let i=0;i<60;i++){
        const h = Math.random()*4+1;
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.5,h,0.5), new THREE.MeshStandardMaterial({color:0x111111, emissive:new THREE.Color(`hsl(${Math.random()*360},80%,60%)`)}));
        box.position.set((Math.random()-0.5)*30, h/2, (Math.random()-0.5)*30);
        scene.add(box); worldObjects.push(box);
      }
    }else if(prompt.includes('grass')){
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(40,40,32,32), new THREE.MeshLambertMaterial({color:0x228b22}));
      plane.rotation.x = -Math.PI/2; scene.add(plane); worldObjects.push(plane);
    }else if(prompt.includes('mountain')){
      const geo = new THREE.PlaneGeometry(40,40,64,64);
      geo.rotateX(-Math.PI/2);
      for(let i=0;i<geo.attributes.position.count;i++){
        const y = Math.random()*6; geo.attributes.position.setY(i, y);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0x888888}));
      scene.add(mesh); worldObjects.push(mesh);
    }else if(prompt.includes('alien') || prompt.includes('crystal')){
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshBasicMaterial({color:0x000}));
      plane.rotation.x = -Math.PI/2; scene.add(plane); worldObjects.push(plane);
      for(let i=0;i<30;i++){
        const h = Math.random()*3+2;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5,h,6), new THREE.MeshStandardMaterial({color:new THREE.Color(`hsl(${Math.random()*360},70%,70%)`), emissive:0x222222, transparent:true, opacity:0.85}));
        crystal.position.set((Math.random()-0.5)*30, h/2, (Math.random()-0.5)*30);
        scene.add(crystal); worldObjects.push(crystal);
      }
    }
    modeChip && (modeChip.textContent = `Mode — World(${prompt||'none'})`);
  }

  buildBtn?.addEventListener('click', buildWorld);
  resetBtn?.addEventListener('click', clearWorld);
})();
