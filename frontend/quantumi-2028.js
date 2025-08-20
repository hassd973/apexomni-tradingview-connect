/* quantumi-2028.js — FPV Hash Explorer + World Builder (r128 compatible) */
const THREE = window.THREE;

(() => {
  const $ = (id) => document.getElementById(id);

  let Q; // QUANTUMI bridge
  let pathCurve = null; // CatmullRomCurve3 from lastPathPoints
  let pathTube = null; // Visual tube for the hash path
  let curveLen = 1; // approx length for speed normalization

  // FPV state
  const state = {
    mode: 'ORBIT', // ORBIT | AUTO_FPV | MANUAL_FPV
    runnerT: 0, // spline progress [0..1)
    autoSpeed: 1.7, // m/s normalized to curve length
    // manual FPV (pointer lock + touch joystick)
    velocity: new THREE.Vector3(),
    move: { f: 0, b: 0, l: 0, r: 0, up: 0, down: 0, run: 0 },
    gravity: 0, // 0 for fly-cam; set ~9.8 for gravity
    maxSpeed: 6,
    friction: 6,
    lookEnabled: false,
  };

  // HUD
  let hud, hudHint;

  // Joystick (mobile)
  let joy = null;
  function buildJoystick() {
    if (joy) return joy;
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.bottom = '16px';
    root.style.left = '16px';
    root.style.width = '120px';
    root.style.height = '120px';
    root.style.border = '1px solid rgba(255,255,255,.12)';
    root.style.borderRadius = '999px';
    root.style.background = 'rgba(255,255,255,.06)';
    root.style.touchAction = 'none';
    root.style.userSelect = 'none';
    root.style.zIndex = '30';
    root.id = 'joy';
    const knob = document.createElement('div');
    knob.style.width = '56px';
    knob.style.height = '56px';
    knob.style.borderRadius = '999px';
    knob.style.background = 'rgba(255,255,255,.22)';
    knob.style.position = 'absolute';
    knob.style.left = '32px';
    knob.style.top = '32px';
    root.appendChild(knob);
    $('stagePanel')?.appendChild(root);

    let touching = false,
      cx = 60,
      cy = 60;
    function setKnob(x, y) {
      knob.style.left = x - 28 + 'px';
      knob.style.top = y - 28 + 'px';
    }
    root.addEventListener('pointerdown', (e) => {
      touching = true;
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointerup', (e) => {
      touching = false;
      state.move.f = state.move.b = state.move.l = state.move.r = 0;
      setKnob(cx, cy);
    });
    root.addEventListener('pointermove', (e) => {
      if (!touching) return;
      const r = root.getBoundingClientRect();
      const x = Math.max(0, Math.min(120, e.clientX - r.left));
      const y = Math.max(0, Math.min(120, e.clientY - r.top));
      setKnob(x, y);
      const dx = (x - cx) / 60,
        dy = (y - cy) / 60;
      state.move.f = -dy > 0 ? -dy : 0;
      state.move.b = dy > 0 ? dy : 0;
      state.move.r = dx > 0 ? dx : 0;
      state.move.l = -dx > 0 ? -dx : 0;
    });
    joy = { root, knob };
    return joy;
  }

  // Helper: get ordered path points from host
  function getPathPoints() {
    const pts = (window.QUANTUMI && window.QUANTUMI.path) || [];
    return pts && pts.length >= 3 ? pts : [];
  }

  function rebuildCurveAndTube() {
    const pts = getPathPoints();
    if (pts.length < 3) return;

    pathCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.25);

    if (pathTube) {
      Q.scene.remove(pathTube);
      pathTube.geometry.dispose();
      pathTube.material.dispose();
    }

    // Tube visual
    const segs = Math.min(1600, pts.length * 6);
    const tubeGeo = new THREE.TubeGeometry(pathCurve, segs, 0.06, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff7f,
      emissive: 0x003311,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75,
    });
    pathTube = new THREE.Mesh(tubeGeo, tubeMat);
    Q.scene.add(pathTube);
    curveLen = pathCurve.getLength();
  }

  function setMode(m) {
    if (!Q) return;
    if (state.mode === m) return;
    state.mode = m;
    if (m === 'ORBIT') {
      Q.controls.enabled = true;
      document.exitPointerLock?.();
      joy && joy.root.remove();
      joy = null;
    } else {
      Q.controls.enabled = false;
      if ('ontouchstart' in window) buildJoystick();
      if (m === 'MANUAL_FPV') {
        hudHint && (hudHint.textContent = 'WASD/joystick to move, M to auto');
        canvas().requestPointerLock?.();
      } else {
        hudHint && (hudHint.textContent = 'Auto FPV — press M for manual');
      }
    }
    hud && (hud.textContent = 'Mode: ' + state.mode);
  }

  function toggleFPV() {
    if (state.mode === 'ORBIT') setMode('AUTO_FPV');
    else if (state.mode === 'AUTO_FPV') setMode('MANUAL_FPV');
    else setMode('ORBIT');
  }

  // Manual FPV controls ----------------------------------------------------
  const keyMap = {
    w: 'f',
    s: 'b',
    a: 'l',
    d: 'r',
    q: 'down',
    e: 'up',
    shift: 'run',
  };
  function onKey(e, down) {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'm' && down) {
      if (state.mode === 'AUTO_FPV') setMode('MANUAL_FPV');
      else if (state.mode === 'MANUAL_FPV') setMode('AUTO_FPV');
    } else if (k === 'o' && down) {
      setMode('ORBIT');
    }
    const m = keyMap[k];
    if (m) {
      state.move[m] = down ? 1 : 0;
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', (e) => onKey(e, true));
  document.addEventListener('keyup', (e) => onKey(e, false));

  function canvas() {
    return Q && Q.renderer ? Q.renderer.domElement : document.body;
  }

  function onPointerMove(e) {
    if (!state.lookEnabled) return;
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
    Q.camera.rotation.order = 'YXZ';
    Q.camera.rotation.y -= movementX * 0.002;
    Q.camera.rotation.x -= movementY * 0.002;
    Q.camera.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, Q.camera.rotation.x),
    );
  }

  function initPointerLock() {
    canvas().addEventListener('click', () => {
      if (state.mode === 'MANUAL_FPV') canvas().requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      state.lookEnabled = document.pointerLockElement === canvas();
    });
    document.addEventListener('mousemove', onPointerMove);
  }

  function updateAuto(dt) {
    if (!pathCurve) return;
    state.runnerT = (state.runnerT + (state.autoSpeed * dt) / curveLen) % 1;
    const pos = pathCurve.getPoint(state.runnerT);
    const tan = pathCurve.getTangent(state.runnerT);
    Q.camera.position.copy(pos);
    Q.camera.lookAt(pos.clone().add(tan));
  }

  function updateManual(dt) {
    const dir = new THREE.Vector3();
    if (state.move.f) dir.z -= state.move.f;
    if (state.move.b) dir.z += state.move.b;
    if (state.move.l) dir.x -= state.move.l;
    if (state.move.r) dir.x += state.move.r;
    if (state.move.up) dir.y += state.move.up;
    if (state.move.down) dir.y -= state.move.down;
    if (dir.lengthSq() > 0) dir.normalize();
    dir.applyEuler(Q.camera.rotation);
    const speed = state.maxSpeed * (state.move.run ? 1.8 : 1);
    dir.multiplyScalar(speed);
    state.velocity.addScaledVector(dir, dt);
    // friction
    const decay = Math.exp(-state.friction * dt);
    state.velocity.multiplyScalar(decay);
    // gravity
    if (state.gravity) state.velocity.y -= state.gravity * dt;
    Q.camera.position.addScaledVector(state.velocity, dt);
  }

  function tick(e) {
    const dt = e.detail.dt;
    if (state.mode === 'AUTO_FPV') updateAuto(dt);
    else if (state.mode === 'MANUAL_FPV') updateManual(dt);
  }

  // --- World Builder -------------------------------------------------------
  const worldObjects = [];
  let promptEl, buildBtn, resetBtn, modeChip;
  function clearWorld() {
    while (worldObjects.length) Q.scene.remove(worldObjects.pop());
    modeChip && (modeChip.textContent = 'Mode — World(none)');
  }
  function buildWorld() {
    const prompt = (promptEl.value || '').toLowerCase();
    clearWorld();
    if (!prompt) return;
    if (prompt.includes('neon')) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshBasicMaterial({ color: 0x050505 }),
      );
      plane.rotation.x = -Math.PI / 2;
      Q.scene.add(plane);
      worldObjects.push(plane);
      for (let i = 0; i < 60; i++) {
        const h = Math.random() * 4 + 1;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, h, 0.5),
          new THREE.MeshStandardMaterial({
            color: 0x111111,
            emissive: new THREE.Color(
              `hsl(${Math.random() * 360},80%,60%)`,
            ),
          }),
        );
        box.position.set(
          (Math.random() - 0.5) * 30,
          h / 2,
          (Math.random() - 0.5) * 30,
        );
        Q.scene.add(box);
        worldObjects.push(box);
      }
    } else if (prompt.includes('grass')) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40, 32, 32),
        new THREE.MeshLambertMaterial({ color: 0x228b22 }),
      );
      plane.rotation.x = -Math.PI / 2;
      Q.scene.add(plane);
      worldObjects.push(plane);
    } else if (prompt.includes('mountain')) {
      const geo = new THREE.PlaneGeometry(40, 40, 64, 64);
      geo.rotateX(-Math.PI / 2);
      for (let i = 0; i < geo.attributes.position.count; i++) {
        const y = Math.random() * 6;
        geo.attributes.position.setY(i, y);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0x888888 }),
      );
      Q.scene.add(mesh);
      worldObjects.push(mesh);
    } else if (prompt.includes('alien') || prompt.includes('crystal')) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshBasicMaterial({ color: 0x000 }),
      );
      plane.rotation.x = -Math.PI / 2;
      Q.scene.add(plane);
      worldObjects.push(plane);
      for (let i = 0; i < 30; i++) {
        const h = Math.random() * 3 + 2;
        const crystal = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, h, 6),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${Math.random() * 360},70%,70%)`),
            emissive: 0x222222,
            transparent: true,
            opacity: 0.85,
          }),
        );
        crystal.position.set(
          (Math.random() - 0.5) * 30,
          h / 2,
          (Math.random() - 0.5) * 30,
        );
        Q.scene.add(crystal);
        worldObjects.push(crystal);
      }
    }
    modeChip && (modeChip.textContent = `Mode — World(${prompt || 'none'})`);
  }

  // -----------------------------------------------------------------------
  function initHud() {
    hud = $('hud');
    hudHint = $('hudHint');
    promptEl = $('worldPrompt');
    buildBtn = $('build-world');
    resetBtn = $('reset-world');
    modeChip = document.querySelectorAll('#m-mode')[1] || $('m-mode');
    buildBtn?.addEventListener('click', buildWorld);
    resetBtn?.addEventListener('click', clearWorld);
  }

  function init() {
    Q = window.QUANTUMI;
    if (!Q) return;
    initHud();
    initPointerLock();
    rebuildCurveAndTube();
    document.addEventListener('quantumi:tick', tick);
    document.addEventListener('quantumi:cloud', () => rebuildCurveAndTube());
    hudHint && (hudHint.textContent = 'Press J for FPV');
    const fpvBtn = $('fpv-toggle');
    fpvBtn?.addEventListener('click', toggleFPV);
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'j') toggleFPV();
    });
  }

  if (window.QUANTUMI) init();
  else document.addEventListener('quantumi:init', init);
})();
