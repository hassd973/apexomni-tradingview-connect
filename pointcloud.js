// GPU-instanced sprites + shader morphing seeded by BTC hash data

export function createPointCloud(btcData, { scene }) {
  const count = btcData.positions.length / 3;

  const geometry = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  geometry.index = base.index;
  geometry.attributes.position = base.attributes.position;
  geometry.attributes.uv = base.attributes.uv;

  geometry.instanceCount = count;
  geometry.setAttribute('iOffset', new THREE.InstancedBufferAttribute(btcData.positions, 3));
  const sizes = new Float32Array(count); sizes.fill(1.0);
  geometry.setAttribute('iSize', new THREE.InstancedBufferAttribute(sizes, 1));
  geometry.setAttribute('iSeed', new THREE.InstancedBufferAttribute(new Float32Array(btcData.seeds), 1));

  const material = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 1.2 },
      uDensity: { value: 1.0 },
      uColorA: { value: new THREE.Color(0x67ffb7) },
      uColorB: { value: new THREE.Color(0x3ea1ff) },
      uTheme: { value: 0 },
      uPromptHash: { value: new THREE.Vector4(0,0,0,0) },
      uSpriteSoft: { value: 0.7 },
      projectionMatrix: { value: null }, viewMatrix: { value: null }, modelMatrix: { value: null }
    },
    vertexShader: `
      precision highp float;
      uniform mat4 projectionMatrix, viewMatrix, modelMatrix;
      uniform float uTime, uSize, uDensity;
      uniform int uTheme;
      uniform vec4 uPromptHash;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec3 iOffset;
      attribute float iSize;
      attribute float iSeed;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }
      vec3 hash31(float p) {
        return vec3(hash11(p), hash11(p+17.1), hash11(p+31.7));
      }
      float noise3(vec3 x){
        vec3 i = floor(x), f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = dot(i, vec3(1.0, 57.0, 113.0));
        float res = mix(
          mix(mix(hash11(n+0.0), hash11(n+1.0), f.x),
              mix(hash11(n+57.0), hash11(n+58.0), f.x), f.y),
          mix(mix(hash11(n+113.0), hash11(n+114.0), f.x),
              mix(hash11(n+170.0), hash11(n+171.0), f.x), f.y), f.z);
        return res;
      }

      vec3 themeDisplace(int theme, vec3 p, float seed) {
        float t = uTime * 0.3 + seed*3.1;
        if (theme == 1) { float h = noise3(p*0.035 + t*0.2); return vec3(0.0, h*0.6, 0.0); }
        if (theme == 2) { float h = noise3(p*0.07) * 2.0 - 0.6; return vec3(0.0, h, 0.0); }
        if (theme == 3) { vec3 g = floor((p + uPromptHash.xyz*20.0) / 4.0) * 4.0;
                          float h = noise3(g*0.12 + seed) * 8.0; return vec3(0.0, h, 0.0); }
        if (theme == 4) { float w = sin(p.x*0.08 + t)*0.5 + cos(p.z*0.08 - t*1.2)*0.5; return vec3(0.0, w*0.7, 0.0); }
        if (theme == 5) { float h = max(0.0, noise3(p*0.05 + t*0.4) - 0.5) * 1.4; return vec3(0.0, h, 0.0); }
        if (theme == 6) { vec3 dir = normalize(uPromptHash.xyz*2.0 - 1.0 + 1e-5);
                          float m = noise3(p*0.06 + uPromptHash.xyz*2.0 + t*0.3) * 1.2; return dir * m; }
        return vec3(0.0);
      }

      void main() {
        if (fract(iSeed*0.618) > uDensity) { gl_Position = vec4(2.0,2.0,2.0,1.0); return; }
        vec3 world = iOffset + themeDisplace(uTheme, iOffset, iSeed);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float size = iSize * uSize;
        vec3 pos = world + (right * (position.x * size)) + (up * (position.y * size));
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColorA, uColorB;
      uniform int uTheme;
      uniform float uSpriteSoft;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        float r = length(p);
        float alpha = smoothstep(0.9, uSpriteSoft, 1.0 - r);
        vec3 color = mix(uColorA, uColorB, r);
        if (uTheme == 1) color = mix(vec3(0.42,0.86,0.47), vec3(0.2,0.6,0.3), r);
        if (uTheme == 2) color = mix(vec3(0.55,0.55,0.58), vec3(0.33,0.33,0.36), r);
        if (uTheme == 3) color = mix(vec3(0.65,0.80,1.0), vec3(0.15,0.35,0.6), r);
        if (uTheme == 4) color = mix(vec3(0.2,0.6,0.9), vec3(0.03,0.15,0.35), r);
        if (uTheme == 5) color = mix(vec3(0.98,0.42,0.67), vec3(0.98,0.89,0.35), r*r);
        gl_FragColor = vec4(color, alpha);
        if (gl_FragColor.a < 0.02) discard;
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const collider = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(btcData.positions, 3)).expandByScalar(10);

  (function animateTime(){
    material.uniforms.uTime.value = performance.now() / 1000;
    requestAnimationFrame(animateTime);
  })();

  return { mesh, material, geometry, collider, userDensity: 1.0 };
}

export function updatePointSize(pc, size) {
  pc.material.uniforms.uSize.value = size;
}
export function updateDensity(pc, density) {
  pc.userDensity = density;
  pc.material.uniforms.uDensity.value = density;
}
export function applyGenerativeMapping(pc, prompt) {
  const theme = inferTheme(prompt);
  pc.material.uniforms.uTheme.value = theme.code;
  pc.material.uniforms.uColorA.value.set(theme.colorA);
  pc.material.uniforms.uColorB.value.set(theme.colorB);
  pc.material.uniforms.uPromptHash.value.set(...hashPrompt4(prompt));
}

function inferTheme(prompt='') {
  const p = prompt.toLowerCase();
  const t = (code, colorA, colorB)=>({ code, colorA, colorB });
  if (/(grass|meadow|field|forest|green)/.test(p)) return t(1,0x6bdc7a,0x1e6a37);
  if (/(rock|stone|canyon|mountain)/.test(p))     return t(2,0x8d8d93,0x333338);
  if (/(city|neon|cyber|building|tower)/.test(p)) return t(3,0xa6c8ff,0x1b3f66);
  if (/(water|ocean|sea|lake|wave)/.test(p))      return t(4,0x56a7e6,0x0a2749);
  if (/(flower|bloom|garden)/.test(p))            return t(5,0xfb6aa9,0xf6e85a);
  if (!p) return t(0,0x67ffb7,0x3ea1ff);
  return t(6,0xd2b2ff,0x7be3ff);
}

function hashPrompt4(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i=0;i<str.length;i++) {
    const k = str.charCodeAt(i);
    h1 = (h2 ^ Math.imul(h1 ^ k, 597399067)) >>> 0;
    h2 = (h3 ^ Math.imul(h2 ^ k, 2869860233)) >>> 0;
    h3 = (h4 ^ Math.imul(h3 ^ k, 951274213)) >>> 0;
    h4 = (h1 ^ Math.imul(h4 ^ k, 2716044179)) >>> 0;
  }
  return [h1/2**32, h2/2**32, h3/2**32, h4/2**32];
}
