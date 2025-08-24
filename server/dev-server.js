/* Tiny WS relay (if you already had one, keep it) + /api/mapgen.
   If OPENAI_API_KEY is provided, we call OpenAI Responses API (JSON schema).
   Otherwise we emit a deterministic stub so the client always works.
*/
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const server = http.createServer(async (req,res)=>{
  const { pathname } = url.parse(req.url, true);
  if (pathname==='/health'){ res.writeHead(200); res.end('ok'); return; }

  if (pathname==='/api/mapgen' && req.method==='POST'){
    let body=''; for await (const c of req) body+=c;
    let payload = {}; try{ payload = JSON.parse(body||'{}'); }catch{}
    const seed = String(payload.seed || 'btc');
    const prompt = String(payload.prompt || 'grass cliffs neon city');
    const cols = Math.max(2, Math.min(64, parseInt(payload.cols||6,10)));
    const rows = Math.max(2, Math.min(64, parseInt(payload.rows||6,10)));
    const size = Math.max(4, Math.min(64, parseFloat(payload.size||12)));

    if (OPENAI_API_KEY){
      // OpenAI Responses API with JSON Schema (best reliability)
      const schema = {
        name: "MapDescriptor",
        schema: {
          type: "object", additionalProperties: false,
          properties: {
            version: { type: "integer", const: 1 },
            seed: { type: "string" }, prompt: { type: "string" },
            grid: { type: "object", additionalProperties:false,
              properties: { cols:{type:"integer"}, rows:{type:"integer"}, size:{type:"number"} },
              required:["cols","rows","size"]
            },
            chunks: { type:"array", minItems: cols*rows, maxItems: cols*rows,
              items: { type:"object", additionalProperties:false,
                properties:{ i:{type:"integer"}, j:{type:"integer"},
                  biome:{type:"string", enum:["city","desert","ice","alien","grass","terrain"]},
                  elev:{type:"number"}, density:{type:"number"} },
                required:["i","j","biome","elev","density"]
              }
            },
            pois: { type:"array",
              items:{ type:"object", additionalProperties:false,
                properties:{ x:{type:"number"}, y:{type:"number"}, z:{type:"number"},
                  type:{type:"string", enum:["loot","jump","spawn","heal","objective"]} },
                required:["x","y","z","type"]
              }
            },
            materials:{ type:"object", additionalProperties:false,
              properties:{ ground:{type:"string"}, accent:{type:"string"}, emissive:{type:"string"} },
              required:["ground","accent","emissive"]
            }
          },
          required:["version","seed","prompt","grid","chunks","pois","materials"]
        }
      };

      const body = {
        model: "gpt-4.1-mini",
        input: [
          { role:"system", content:"You are a map designer. Output ONLY valid MapDescriptor JSON." },
          { role:"user", content:[{type:"text", text:
`seed=${seed}
prompt="${prompt}"
grid: ${cols}x${rows} chunks, chunk size=${size}
Rules:
- Fill all ${cols*rows} chunks with coherent biomes.
- elev ∈ [-1..1] (broad shape), density ∈ [0..1].
- Place 6–12 POIs spread out; types loot/jump/spawn/heal/objective.
- materials must match prompt aesthetics.`}]}
        ],
        response_format: { type:"json_schema", json_schema:schema }
      };

      try{
        const r = await fetch("https://api.openai.com/v1/responses", {
          method:"POST",
          headers:{ "Authorization": 'Bearer ' + OPENAI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!r.ok){ throw new Error(await r.text()); }
        const data = await r.json();
        const desc = data.output?.[0]?.content?.[0]?.json || data.output_parsed || data;
        // enforce request params
        desc.version = 1; desc.seed = seed; desc.prompt = prompt; desc.grid = { cols, rows, size };
        res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify(desc)); return;
      }catch(e){
        console.error("mapgen openai error:", e.message);
        // fallthrough to stub if AI fails
      }
    }

    // Deterministic stub (no key or AI failure)
    const chunks=[]; // simple noise
    const n = (i,j)=>{ const h=crypto.createHash('sha256').update(`${seed}|${i}|${j}`).digest(); return h[0]/255; };
    const classify=(p,x)=>/city|urban|mega/.test(p)?"city":/desert|dune|sand/.test(p)?"desert":/ice|snow|glacier/.test(p)?"ice":/alien|neon|crystal/.test(p)?"alien":/forest|grass|meadow|park/.test(p)?"grass":"terrain";
    for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){
      const base = n(i,j); const biome = classify(prompt, base);
      const elev = (n(i*3,j*3)-0.5)*2; const density = 0.5 + (n(i*7,j*7)-0.5);
      chunks.push({ i,j, biome, elev, density });
    }
    const pois=[]; const cx=(cols*size)/2, cz=(rows*size)/2, R=Math.min(cx,cz)*0.7;
    for (let k=0;k<8;k++){ const a= (k/8)*Math.PI*2; pois.push({ x:cx+Math.cos(a)*R, y:0.3, z:cz+Math.sin(a)*R, type: (k%2?'loot':'jump') }); }
    const materials = { ground:'#2b3a2e', accent:'#4fd1c5', emissive:'#0b2f33' };
    const desc = { version:1, seed, prompt, grid:{cols,rows,size}, chunks, pois, materials };
    res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify(desc)); return;
  }

  // default reply
  res.writeHead(200); res.end('dev relay / mapgen');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws)=>{ ws.on('message',()=>{}); });
server.listen(PORT, ()=> console.log('Dev server on', PORT, ' (POST /api/mapgen)'));
