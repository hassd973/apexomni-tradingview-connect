// Swap this with your real BTC point cloud source. Keep the return shape.

export async function parseBTCPointData() {
  // Expected return shape: { positions: Float32Array[n*3], seeds: Uint32Array[n] }
  // For now, generate a deterministic mock cloud (stable seed) so the app runs.
  const n = 150_000;
  const positions = new Float32Array(n * 3);
  const seeds = new Uint32Array(n);

  let s = 0xdeadbeef;
  const rand = () => (s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0, s / 0xffffffff);

  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 32.0;
    const r = 40 + 30 * rand();
    const x = Math.cos(t) * r + (rand() - 0.5) * 6;
    const z = Math.sin(t) * r + (rand() - 0.5) * 6;
    const y = (rand() - 0.5) * 8 + Math.sin(i*0.001) * 1.2;
    positions[i*3+0] = x;
    positions[i*3+1] = y;
    positions[i*3+2] = z;
    seeds[i] = (rand() * 0xffffffff) >>> 0;
  }
  return { positions, seeds };
}
