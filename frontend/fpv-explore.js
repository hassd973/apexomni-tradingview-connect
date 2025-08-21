/* fpv-explore.js — Explore always fullscreen + FPV. Joystick on mobile. Tube hidden by default. */
const THREE = window.THREE;

(() => {
  const $ = (id)=>document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  let Q, curve=null, tube=null, curveLen=1;
  let isFPV=false;
  let runnerT=0, playerY=0, velY=0;

  const moveRaw = {f:0,b:0,l:0,r:0, run:0};
  const moveSm  = {fwd:0, lat:0};

  const cfg = {
    tubeRadius: 0.065,
    baseSpeed: 2.2,
    runBoost: 1.7,
    strafeSpeed: 1.2,
    eyeHeight: 0.12,
    lookAhead: 2.6,
    jumpVel: 3.0,
    gravity: 9.0,
    easeIn: 8.0, easeOut: 6.0,
    camPosLerp: 0.45, camRotSlerp: 0.35,
  };

  let hud=null, pathBtn=null, joy=null;

  function buildHUD() {
    if (hud) return;
    const root = document.createElement('div');
    root.id = 'fpv-hud';
    Object.assign(root.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:30});

    // Path toggle
    const btn = document.createElement('button');
    btn.textContent = 'Path';
    Object.assign(btn.style,{
      position:'absolute',top:'12px',left:'12px',pointerEvents:'auto',
      padding:'6px 10px',borderRadius:'10px',
      background:'rgba(0,0,0,.35)',color:'#fff',border:'1px solid rgba(255,255,255,.15)'
    });
    btn.onclick = ()=>{ if(tube){ tube.visible=!tube.visible; } };
    root.appendChild(btn); pathBtn=btn;

    if (isTouch){
      // Joystick
      const joyRoot=document.createElement('div');
      Object.assign(joyRoot.style,{position:'absolute',bottom:'20px',left:'18px',width:'120px',height:'120px',
        borderRadius:'999px',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',
        touchAction:'none',pointerEvents:'auto'});
      const knob=document.createElement('div');
      Object.assign(knob.style,{position:'absolute',width:'56px',height:'56px',borderRadius:'999px',left:'32px',top:'32px',
        background:'rgba(255,255,255,.22)'});
      joyRoot.appendChild(knob); root.appendChild(joyRoot);
      joy={root:joyRoot,knob};
      let touching=false,cx=60,cy=60;
      joyRoot.addEventListener('pointerdown',e=>{touching=true;joyRoot.setPointerCapture(e.pointerId);});
      joyRoot.addEventListener('pointerup',e=>{touching=false;moveRaw.f=moveRaw.b=moveRaw.l=moveRaw.r=0;knob.style.left='32px';knob.style.top='32px';});
      joyRoot.addEventListener('pointermove',e=>{
        if(!touching)return;
        const r=joyRoot.getBoundingClientRect();
        const x=Math.max(0,Math.min(120,e.clientX-r.left));
        const y=Math.max(0,Math.min(120,e.clientY-r.top));
        knob.style.left=(x-28)+'px';knob.style.top=(y-28)+'px';
        const dx=(x-cx)/60,dy=(y-cy)/60;
        moveRaw.f=(-dy>0?-dy:0); moveRaw.b=(dy>0?dy:0);
        moveRaw.r=(dx>0?dx:0);  moveRaw.l=(-dx>0?-dx:0);
      });
      // Jump + Exit
      const jump=document.createElement('button');
      jump.textContent='⤒'; Object.assign(jump.style,{position:'absolute',bottom:'42px',right:'22px',
        width:'64px',height:'64px',borderRadius:'999px',background:'rgba(255,255,255,.14)',color:'white',
        border:'1px solid rgba(255,255,255,.2)',fontSize:'28px',pointerEvents:'auto'});
      jump.onclick=()=>{ if(Math.abs(playerY)<0.02) velY=cfg.jumpVel; };
      root.appendChild(jump);
      const exit=document.createElement('button');
      exit.textContent='✕'; Object.assign(exit.style,{position:'absolute',top:'14px',right:'14px',
        width:'44px',height:'44px',borderRadius:'12px',background:'rgba(0,0,0,.35)',color:'white',
        border:'1px solid rgba(255,255,255,.15)',pointerEvents:'auto'});
      exit.onclick=()=>toggleFPV(false); root.appendChild(exit);
    }
    $('stagePanel')?.appendChild(root); hud=root;
  }
  function destroyHUD(){ hud?.remove(); hud=null; pathBtn=null; joy=null; }

  function getPathPoints(){ return (window.QUANTUMI?.path)||[]; }
  function rebuildCurveAndTube(){
    const pts=getPathPoints(); if(pts.length<3) return false;
    curve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.25);
    const tmp=curve.getPoints(800); let L=0; for(let i=1;i<tmp.length;i++) L+=tmp[i-1].distanceTo(tmp[i]);
    curveLen=Math.max(1e-3,L);
    if(tube){ Q.scene.remove(tube); tube.geometry.dispose(); tube.material.dispose(); }
    const geo=new THREE.TubeGeometry(curve,Math.min(1600,pts.length*6),cfg.tubeRadius,10,false);
    const mat=new THREE.MeshStandardMaterial({color:0x00ff7f,emissive:0x00331c,transparent:true,opacity:0.85});
    tube=new THREE.Mesh(geo,mat); tube.visible=false; Q.scene.add(tube);
    return true;
  }

  function ease(cur,target,dt){const diff=target-cur;const rate=(Math.abs(target)>Math.abs(cur))?cfg.easeIn:cfg.easeOut;return cur+diff*Math.min(1,rate*dt);}

  function tick(dt){
    if(!isFPV||!curve) return;
    moveSm.fwd=ease(moveSm.fwd,(moveRaw.f-moveRaw.b),dt);
    moveSm.lat=ease(moveSm.lat,(moveRaw.r-moveRaw.l),dt);
    const speed=cfg.baseSpeed*(moveRaw.run?cfg.runBoost:1);
    runnerT=(runnerT+(moveSm.fwd*speed*dt)/curveLen+1)%1;
    velY-=cfg.gravity*dt; playerY+=velY*dt; if(playerY<0){playerY=0;velY=0;}
    const pos=curve.getPointAt(runnerT),tan=curve.getTangentAt(runnerT).normalize();
    const up=new THREE.Vector3(0,1,0),side=new THREE.Vector3().crossVectors(tan,up).normalize();
    const eye=pos.clone().add(up.clone().multiplyScalar(cfg.eyeHeight+playerY)).add(side.multiplyScalar(moveSm.lat*cfg.strafeSpeed*0.4));
    const look=curve.getPointAt((runnerT+(cfg.lookAhead/curveLen))%1);
    const cam=Q.camera; cam.position.lerp(eye,cfg.camPosLerp);
    const m=new THREE.Matrix4().lookAt(eye,look,up),q=new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q,cfg.camRotSlerp); Q.controls&&(Q.controls.target.copy(look),Q.controls.update?.());
  }

  function toggleFPV(on){
    if(on===isFPV) return; isFPV=!!on;
    if(isFPV){
      if(!Q) Q=window.QUANTUMI; if(!rebuildCurveAndTube()){isFPV=false;return;}
      runnerT=0;playerY=0;velY=0; Q.controls&&(Q.controls.enabled=false);
      $('stagePanel')?.requestFullscreen?.().catch(()=>{}); // always fullscreen
      buildHUD();
    } else {
      Q&&Q.controls&&(Q.controls.enabled=true,Q.controls.update?.()); destroyHUD();
      document.exitFullscreen?.(); Object.assign(moveRaw,{f:0,b:0,l:0,r:0,run:0}); Object.assign(moveSm,{fwd:0,lat:0});
    }
  }

  function bindKeys(){
    window.addEventListener('keydown',e=>{if(!isFPV)return;
      const k=e.key.toLowerCase();
      if(k==='w') moveRaw.f=1; if(k==='s') moveRaw.b=1; if(k==='a') moveRaw.l=1; if(k==='d') moveRaw.r=1;
      if(k==='shift') moveRaw.run=1; if(k===' ') { if(Math.abs(playerY)<0.02) velY=cfg.jumpVel; }
      if(k==='escape') toggleFPV(false);
    });
    window.addEventListener('keyup',e=>{if(!isFPV)return; const k=e.key.toLowerCase();
      if(k==='w') moveRaw.f=0; if(k==='s') moveRaw.b=0; if(k==='a') moveRaw.l=0; if(k==='d') moveRaw.r=0; if(k==='shift') moveRaw.run=0; });
  }

  function bindUI(){
    const explore=$('play-fp'); if(explore){ explore.onclick=()=>toggleFPV(!isFPV); explore.title='Explore BTC hash (fullscreen + FPV)'; }
    document.addEventListener('quantumi:cloud',()=>rebuildCurveAndTube());
    document.addEventListener('visibilitychange',()=>{if(document.hidden) toggleFPV(false);});
  }

  function start(){
    if(!window.QUANTUMI?.scene) return setTimeout(start,60);
    Q=window.QUANTUMI;
    document.addEventListener('quantumi:tick',e=>tick(e.detail.dt));
    document.addEventListener('quantumi:frame',e=>{const dt=(e?.detail?.dt)??0.016;tick(dt);});
    bindKeys(); bindUI();
  }

  start();
})();

