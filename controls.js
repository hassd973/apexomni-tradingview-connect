// First-person controls with walk/run/jump bounded by the point cloud AABB

export function setupFirstPersonControls({ camera, canvas, scene, collider }) {
  const controls = new THREE.PointerLockControls(camera, canvas);
  scene.add(controls.getObject());

  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const params = {
    moveForward: false, moveBackward: false, moveLeft: false, moveRight: false,
    run: false, onGround: false, gravity: 28, speed: 9, runMul: 1.8, jumpVel: 10
  };

  const onKeyDown = (e) => {
    switch(e.code) {
      case 'ArrowUp': case 'KeyW': params.moveForward = true; break;
      case 'ArrowLeft': case 'KeyA': params.moveLeft = true; break;
      case 'ArrowDown': case 'KeyS': params.moveBackward = true; break;
      case 'ArrowRight': case 'KeyD': params.moveRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': params.run = true; break;
      case 'Space': if (params.onGround) { velocity.y += params.jumpVel; params.onGround = false; } break;
    }
  };
  const onKeyUp = (e) => {
    switch(e.code) {
      case 'ArrowUp': case 'KeyW': params.moveForward = false; break;
      case 'ArrowLeft': case 'KeyA': params.moveLeft = false; break;
      case 'ArrowDown': case 'KeyS': params.moveBackward = false; break;
      case 'ArrowRight': case 'KeyD': params.moveRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': params.run = false; break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  controls.update = (dt) => {
    if (!controls.isLocked) return;

    velocity.x -= velocity.x * 8.0 * dt;
    velocity.z -= velocity.z * 8.0 * dt;
    velocity.y -= 28 * dt;

    direction.set(
      (params.moveRight?1:0) - (params.moveLeft?1:0),
      0,
      (params.moveBackward?1:0) - (params.moveForward?1:0)
    ).normalize();

    const speed = 9 * (params.run ? 1.8 : 1.0);
    if (direction.lengthSq() > 0) {
      const front = new THREE.Vector3();
      controls.getDirection(front);
      front.y = 0; front.normalize();
      const right = new THREE.Vector3().crossVectors(front, new THREE.Vector3(0,1,0)).negate();
      velocity.addScaledVector(front, -direction.z * speed * dt * 60);
      velocity.addScaledVector(right,  direction.x * speed * dt * 60);
    }

    controls.getObject().position.addScaledVector(velocity, dt);

    const pos = controls.getObject().position;
    const floorY = collider.min.y + 1.6;
    if (pos.y <= floorY) { velocity.y = 0; pos.y = floorY; params.onGround = true; } else { params.onGround = false; }

    pos.x = Math.max(collider.min.x - 2, Math.min(collider.max.x + 2, pos.x));
    pos.z = Math.max(collider.min.z - 2, Math.min(collider.max.z + 2, pos.z));
  };

  controls.onLock = () => {};
  controls.onUnlock = () => {};

  return controls;
}

export function enablePlayHUD() { document.getElementById('hud').classList.remove('hidden'); }
export function disablePlayHUD() { document.getElementById('hud').classList.add('hidden'); }
export function resetCamera(camera) { camera.position.set(0, 3, 8); camera.rotation.set(0, 0, 0); }
