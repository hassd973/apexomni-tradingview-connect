(function(){
  const Q_LAYOUT = [
    { row: 0, cols: [1, 2, 3, 4] },
    { row: 1, cols: [0, 5] },
    { row: 2, cols: [0, 5] },
    { row: 3, cols: [0, 5] },
    { row: 4, cols: [0, 5] },
    { row: 5, cols: [1, 2, 3] },
    { row: 6, cols: [4] }
  ];
  const LAYER = { spacing: 0.3, radius: 0.14 }; // Layer III
  const ROWS = 7;
  const COLS = 6;

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  function drawLogo(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    const spacing = LAYER.spacing;
    const cellSize = Math.min(w/(COLS+2), h/(ROWS+2));
    const offsetX = (w - COLS*cellSize)/2;
    const offsetY = (h - ROWS*cellSize)/2;
    const dotWidth = cellSize*0.5;
    const dotHeight = cellSize*0.3;
    const dotRadius = cellSize*0.15;
    ctx.fillStyle = '#e3e3e3';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6;
    for (let item of Q_LAYOUT) {
      let y = item.row;
      for (let x of item.cols) {
        const baseX = offsetX + x*cellSize + cellSize/2;
        const baseY = offsetY + y*cellSize + cellSize/2;
        const count = Math.floor(1/spacing);
        for (let i=0;i<=count;i++){
          const dx = (i - count/2)*spacing*cellSize;
          drawRoundedRect(ctx,
            baseX + dx - dotWidth/2,
            baseY - dotHeight/2,
            dotWidth,
            dotHeight,
            dotRadius);
        }
      }
    }
  }

  function render(canvas){
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    drawLogo(ctx, canvas.width, canvas.height);
  }

  function triggerVibration(){
    const vibrate =
      navigator.vibrate ||
      navigator.webkitVibrate ||
      navigator.mozVibrate ||
      navigator.msVibrate;
    if (vibrate) vibrate.call(navigator, 100);
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

  function init(){
    document.querySelectorAll('canvas.quantumi-logo').forEach(canvas => {
      render(canvas);
      canvas.addEventListener('pointerdown', triggerVibration);
      canvas.addEventListener('touchstart', triggerVibration);
      canvas.addEventListener('click', triggerVibration);
    });
  }

  window.addEventListener('resize', init);
  document.addEventListener('DOMContentLoaded', init);
})();
