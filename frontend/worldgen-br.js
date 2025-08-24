/* Add a new entry-point that accepts a MapDescriptor.
   Keep your existing point-cloud based builder as fallback.
*/
const THREE = window.THREE;

export function buildWorldFromDescriptor(scene, desc){
  // Remove old
  scene.getObjectByName('BRWorld')?.removeFromParent();
  const group = new THREE.Group(); group.name='BRWorld';

  const { cols, rows, size } = desc.grid;
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(desc.materials?.ground||'#2b3a2e'), roughness:0.95, metalness:0.02
  });

  // Floor tiles + per-chunk instancing
  for (let j=0;j<rows;j++){
    for (let i=0;i<cols;i++){
      const c = desc.chunks.find(x=>x.i===i && x.j===j);
      const baseY = (c?.elev||0) * 1.2;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(size, 0.12, size), groundMat);
      tile.position.set(i*size + size/2, baseY, j*size + size/2);
      tile.receiveShadow = true; group.add(tile);

      const { mesh, colorize } = instForBiome(c?.biome || 'terrain', Math.floor(60 * Math.max(0.1,(c?.density||0.5))));
      const dummy = new THREE.Object3D(); const col = new THREE.Color();
      for (let k=0;k<mesh.count;k++){
        dummy.position.set(
          tile.position.x + (Math.random()-0.5)*(size*0.9),
          baseY + (Math.random()-0.5)*0.6,
          tile.position.z + (Math.random()-0.5)*(size*0.9)
        );
        dummy.rotation.y = Math.random()*Math.PI*2;
        dummy.scale.setScalar(0.6 + Math.random()*0.9);
        dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
        col.setHex(colorize()); mesh.setColorAt(k, col);
      }
      mesh.instanceMatrix.needsUpdate=true; mesh.instanceColor.needsUpdate=true;
      group.add(mesh);
    }
  }

  // POIs
  (desc.pois||[]).forEach(p=>{
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.1,16),
      new THREE.MeshStandardMaterial({ color: p.type==='loot'?0xffd54f:0x80eaff, emissive:0x112233 }));
    m.position.set(p.x, p.y, p.z); group.add(m);
  });

  scene.add(group);
  return group;

  function instForBiome(biome, count){
    const mat = (opts)=> new THREE.MeshStandardMaterial({ roughness:opts.r||0.6, metalness:opts.m||0.2, vertexColors:true, emissive:opts.e||0x000000 });
    if (biome==='city')   return { mesh:new THREE.InstancedMesh(new THREE.BoxGeometry(0.24,1,0.24),   mat({r:.55,m:.2}), count), colorize:()=> new THREE.Color().setHSL(0.58+Math.random()*0.03,0.12,0.68-Math.random()*0.22).getHex() };
    if (biome==='desert') return { mesh:new THREE.InstancedMesh(new THREE.ConeGeometry(0.32,0.6,5),   mat({r:.8,m:.05}), count), colorize:()=> new THREE.Color().setHSL(0.10+Math.random()*0.02,0.55,0.65).getHex() };
    if (biome==='ice')    return { mesh:new THREE.InstancedMesh(new THREE.BoxGeometry(0.3,0.3,0.3),   mat({r:.15,m:.6}), count), colorize:()=> new THREE.Color().setHSL(0.56+Math.random()*0.05,0.35,0.85).getHex() };
    if (biome==='alien')  return { mesh:new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22,0),mat({r:.25,m:.6,e:0x0b2f33}), count), colorize:()=> new THREE.Color().setHSL(0.52+Math.random()*0.15,0.85,0.55).getHex() };
    if (biome==='grass')  return { mesh:new THREE.InstancedMesh(new THREE.ConeGeometry(0.06,0.25,6),  mat({r:.85,m:0}), count), colorize:()=> new THREE.Color().setHSL(0.36+Math.random()*0.05,0.8,0.45+Math.random()*0.1).getHex() };
    return                 { mesh:new THREE.InstancedMesh(new THREE.BoxGeometry(0.24,0.24,0.24),      mat({r:.9,m:.05}), count), colorize:()=> new THREE.Color().setHSL(0.08+Math.random()*0.03,0.65,0.42+Math.random()*0.08).getHex() };
  }
}

export function buildWorld(opts){
  // Back-compat: if a MapDescriptor is passed, use it; else, keep your current code path.
  if (opts.mapDesc) return buildWorldFromDescriptor(opts.scene, opts.mapDesc);
  // … keep your existing point-cloud builder here unchanged …
}
