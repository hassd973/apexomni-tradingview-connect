(function(){
  const RAW_Q_GRID = [
    [0,1,1,1,1,1,1,1,0],
    [1,1,0,0,0,0,0,1,1],
    [1,0,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,1,0,1],
    [1,0,1,0,0,0,1,0,1],
    [1,0,1,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,0,1],
    [1,1,0,0,0,1,0,1,1],
    [0,1,1,1,1,0,1,1,0],
    [0,0,0,0,1,1,1,0,0],
    [0,0,0,0,0,1,0,0,0]
  ];
  const Q_GRID = RAW_Q_GRID.map(r => r.slice().reverse());
  const GRID_COLS = Q_GRID[0].length, GRID_ROWS = Q_GRID.length;
  const config = {subX:4, subY:3, dotRadius:0.092};
  function drawLogo(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    const margin = 1.4;
    const cell = Math.min(w/(GRID_COLS+margin*2), h/(GRID_ROWS+margin*2));
    const X0 = (w - GRID_COLS*cell)/2;
    const Y0 = (h - GRID_ROWS*cell)/2;
    for(let y=0;y<GRID_ROWS;y++) for(let x=0;x<GRID_COLS;x++) if(Q_GRID[y][x]){
      for(let iy=0; iy<config.subY; iy++) for(let ix=0; ix<config.subX; ix++){
        const offsetX = (ix - (config.subX-1)/2)/config.subX;
        const offsetY = (iy - (config.subY-1)/2)/config.subY;
        let cx = X0 + (x+0.5+offsetX)*cell;
        let cy = Y0 + (y+0.5+offsetY)*cell;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cell*config.dotRadius, 0, 2*Math.PI);
        ctx.fillStyle = '#e3e3e3';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.restore();
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
  function init(){
    document.querySelectorAll('canvas.quantumi-logo').forEach(render);
  }
  window.addEventListener('resize', init);
  document.addEventListener('DOMContentLoaded', init);
})();
