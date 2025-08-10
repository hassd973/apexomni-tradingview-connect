(function(){
  const canvas = document.getElementById('pointCloudCanvas');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(width, height);

  const particles = new THREE.BufferGeometry();
  const particleCount = 500;
  const positions = [];
  for (let i = 0; i < particleCount; i++) {
    positions.push((Math.random() - 0.5) * 10);
    positions.push((Math.random() - 0.5) * 10);
    positions.push((Math.random() - 0.5) * 10);
  }
  particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: 0x00fff2, size: 0.05 });
  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);

  camera.position.z = 5;

  function triggerVibration(){
    if (navigator.vibrate) navigator.vibrate(100);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads){
      if (pad && pad.vibrationActuator){
        pad.vibrationActuator.playEffect('dual-rumble', {
          duration: 100,
          strongMagnitude: 0.5,
          weakMagnitude: 0.5
        });
      }
    }
  }

  canvas.addEventListener('pointerdown', triggerVibration);
  canvas.addEventListener('touchstart', triggerVibration);

  let gpIndex = null;
  let aPressed = false;
  window.addEventListener('gamepadconnected', e => { gpIndex = e.gamepad.index; });

  function pollGamepad(){
    if (gpIndex !== null){
      const gp = navigator.getGamepads()[gpIndex];
      if (gp){
        const pressed = gp.buttons[0] && gp.buttons[0].pressed;
        if (pressed && !aPressed) triggerVibration();
        aPressed = pressed;
      }
    }
    requestAnimationFrame(pollGamepad);
  }
  pollGamepad();

  function animate(){
    requestAnimationFrame(animate);
    particleSystem.rotation.y += 0.001;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
})();
