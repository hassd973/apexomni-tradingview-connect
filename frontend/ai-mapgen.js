export class AIMapGen {
  constructor({ baseURL }){
    // Use relative path by default; works on same host (no :8787 surprise)
    this.baseURL = baseURL || '';
  }
  async generate({ seed='btc', prompt='grass cliffs neon city', cols=6, rows=6, size=12 }){
    try{
      const r = await fetch(this.baseURL + '/api/mapgen', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ seed, prompt, cols, rows, size })
      });
      if (!r.ok) throw new Error('mapgen ' + r.status);
      return await r.json();
    }catch(e){
      // Fallback descriptor so UI remains responsive
      console.warn('AI mapgen failed, using local fallback:', e.message);
      const chunks=[]; for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){
        const n = Math.sin((i*97+j*131+seed.length)*0.137)%1;
        const biome = /city|urban/.test(prompt)?'city':/desert|sand/.test(prompt)?'desert':/ice|snow/.test(prompt)?'ice':/alien|neon/.test(prompt)?'alien':/forest|grass/.test(prompt)?'grass':'terrain';
        chunks.push({ i,j, biome, elev:(Math.sin((i*3+j*5)*0.6)-0.5)*2, density:0.5+(n-0.5) });
      }
      return { version:1, seed, prompt, grid:{cols,rows,size}, chunks, pois:[{x:(cols*size)/2,y:0.3,z:(rows*size)/2,type:'spawn'}], materials:{ ground:'#2b3a2e', accent:'#4fd1c5', emissive:'#0b2f33' } };
    }
  }
}
export function descLabel(d){ const g=d.grid; return `Map v${d.version} \u2022 ${g.cols}x${g.rows}@${g.size} \u2022 ${d.seed} \u2022 \u201c${d.prompt}\u201d`; }
