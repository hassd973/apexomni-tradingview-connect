/* global THREE */
let controls;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let isRunning = false;
let clusters = [];
let fadeEl = null;
let respawning = false;
const speed = 50;

function onKeyDown(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump) {
        velocity.y += 35;
        canJump = false;
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isRunning = true;
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isRunning = false;
      break;
  }
}

function startWalkMode(camera, renderer) {
  clusters = (window.QUANTUMI?.clusters || []).slice();
  fadeEl = document.getElementById('fall-fade');
  controls = new THREE.PointerLockControls(camera, renderer.domElement);
  renderer.domElement.addEventListener('click', () => controls.lock());
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  if (clusters.length) {
    const c = clusters[0];
    camera.position.set(c.center.x, c.center.y + c.radius + 2, c.center.z);
  }
}

function groundHeight(pos){
  let nearest=null, dmin=Infinity;
  for(const c of clusters){
    const d = pos.distanceTo(c.center);
    if(d<dmin){ dmin=d; nearest=c; }
  }
  return nearest ? nearest.center.y + nearest.radius : 1;
}

function update(delta) {
  if (!controls || !controls.isLocked) return;
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  velocity.y -= 9.8 * 10 * delta;

  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  const currentSpeed = isRunning ? speed * 2 : speed;
  if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  camera.position.y += velocity.y * delta;
  const g = groundHeight(camera.position);
  if (camera.position.y < g) {
    velocity.y = 0;
    camera.position.y = g;
    canJump = true;
  }
  if (camera.position.y < g - 30 && !respawning) {
    respawning = true;
    fadeEl && fadeEl.classList.add('on');
    setTimeout(() => {
      const first = clusters[0];
      if (first) {
        camera.position.set(first.center.x, first.center.y + first.radius + 2, first.center.z);
      } else {
        camera.position.set(0, 1, 0);
      }
      velocity.set(0, 0, 0);
      canJump = true;
      fadeEl && setTimeout(() => fadeEl.classList.remove('on'), 200);
      respawning = false;
    }, 800);
  }
}

window.walkMode = { startWalkMode, update };
