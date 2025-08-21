/* collider-lite.js — spatial hash of AABB cubes + capsule collision (r128) */
export class SpatialHash {
  constructor(cell = 1.0){ this.cell = cell; this.map = new Map(); }
  _key(ix,iy,iz){ return `${ix}|${iy}|${iz}`; }
  insertAABB(min, max){
    const c=this.cell;
    const ix0=Math.floor(min.x/c), iy0=Math.floor(min.y/c), iz0=Math.floor(min.z/c);
    const ix1=Math.floor(max.x/c), iy1=Math.floor(max.y/c), iz1=Math.floor(max.z/c);
    for(let ix=ix0;ix<=ix1;ix++) for(let iy=iy0;iy<=iy1;iy++) for(let iz=iz0;iz<=iz1;iz++){
      const k=this._key(ix,iy,iz);
      if(!this.map.has(k)) this.map.set(k,[]);
      this.map.get(k).push({min:max.clone().set(min.x,min.y,min.z), max:max.clone()});
    }
  }
  query(pos, radius){
    const c=this.cell;
    const ix0=Math.floor((pos.x-radius)/c), iy0=Math.floor((pos.y-radius)/c), iz0=Math.floor((pos.z-radius)/c);
    const ix1=Math.floor((pos.x+radius)/c), iy1=Math.floor((pos.y+radius)/c), iz1=Math.floor((pos.z+radius)/c);
    const out=[];
    for(let ix=ix0;ix<=ix1;ix++) for(let iy=iy0;iy<=iy1;iy++) for(let iz=iz0;iz<=iz1;iz++){
      const v=this.map.get(`${ix}|${iy}|${iz}`); if(v) out.push(...v);
    }
    return out;
  }
}

export class CapsuleController {
  constructor({pos, radius=0.22, height=0.8}){
    this.pos = pos.clone();            // center at feet
    this.radius = radius;              // horizontal radius
    this.height = height;              // vertical capsule height (feet->head)
    this.vel = new THREE.Vector3();    // velocity
    this.onGround = false;
  }
  _aabbOverlap(a, bMin, bMax){
    // push out horizontally & vertically in simplest way (capsule as sphere stack)
    const r = this.radius;
    // feet sphere
    const spheres = [
      {c: new THREE.Vector3(this.pos.x, this.pos.y + r, this.pos.z), r},
      {c: new THREE.Vector3(this.pos.x, this.pos.y + this.height - r, this.pos.z), r}
    ];
    let correction = new THREE.Vector3();
    let grounded = false;

    for(const s of spheres){
      const p = s.c.clone().clamp(bMin, bMax); // closest point on box
      const d = s.c.clone().sub(p);
      const dist = d.length();
      if (dist < s.r && dist > 1e-6){
        const push = d.normalize().multiplyScalar(s.r - dist);
        correction.add(push);
        if (push.y > 0.001) grounded = true;
      } else if (dist < 1e-6) {
        // sphere center inside box corner; push up minimally
        correction.y += (s.r * 0.5);
        grounded = true;
      }
    }
    if (correction.lengthSq() > 0){
      this.pos.add(correction);
    }
    this.onGround = grounded;
  }
  integrate(dt, gravity, hash){
    // gravity
    this.vel.y -= gravity * dt;
    // integrate
    this.pos.addScaledVector(this.vel, dt);
    // collide against nearby aabbs
    const queryCenter = new THREE.Vector3(this.pos.x, this.pos.y + this.height*0.5, this.pos.z);
    const candidates = hash.query(queryCenter, Math.max(this.radius, this.height*0.5)+1.0);
    this.onGround = false;
    for(const h of candidates){
      this._aabbOverlap(null, h.min, h.max);
    }
    // friction on ground
    if (this.onGround) { this.vel.y = Math.max(0, this.vel.y); this.vel.x *= 0.85; this.vel.z *= 0.85; }
  }
}

