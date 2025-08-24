export class AIMapGen {
  constructor({ baseURL }){
    this.baseURL = baseURL || (location.origin.replace(/^http/,'http') + ':8787');
  }
  async generate({ seed='btc', prompt='grass cliffs neon city', cols=6, rows=6, size=12 }){
    const r = await fetch(this.baseURL + '/api/mapgen', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ seed, prompt, cols, rows, size })
    });
    if (!r.ok) throw new Error('mapgen failed ' + r.status);
    return r.json();
  }
}
export function descLabel(d){ const g=d.grid; return `Map v${d.version} • ${g.cols}x${g.rows}@${g.size} • ${d.seed} • “${d.prompt}”`; }
