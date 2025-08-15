// Minimal logo renderer for <canvas class="quantumi-logo"> elements.
// Draws a pulsing neon "Q" so the metrics overlay has a live accent.

(function initQuantumiLogo(){
  const canvases = Array.from(document.querySelectorAll('canvas.quantumi-logo'));
  if (!canvases.length) return;

  const ctxs = canvases.map(cv => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 48, h = cv.clientHeight || 48;
    cv.width = Math.max(1, Math.floor(w * dpr));
    cv.height = Math.max(1, Math.floor(h * dpr));
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { cv, ctx };
  });

  function draw(t){
    for (const { cv, ctx } of ctxs){
      const w = cv.clientWidth || 48, h = cv.clientHeight || 48;
      ctx.clearRect(0,0,w,h);

      // Background glow
      const g = ctx.createRadialGradient(w/2,h/2,4, w/2,h/2, Math.max(w,h)/2);
      g.addColorStop(0, 'rgba(0,255,127,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      // Pulse
      const pulse = 0.5 + 0.5 * Math.sin(t/500);
      ctx.lineWidth = 2 + 2 * pulse;
      ctx.strokeStyle = '#00ff7f';
      ctx.beginPath();
      // Draw "Q"
      ctx.arc(w/2, h/2, Math.min(w,h)/3, 0, Math.PI*2);
      ctx.moveTo(w/2 + Math.min(w,h)/5, h/2 + Math.min(w,h)/5);
      ctx.lineTo(w/2 + Math.min(w,h)/3, h/2 + Math.min(w,h)/3);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
