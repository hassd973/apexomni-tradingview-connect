import { AIMapGen, descLabel } from './ai-mapgen.js';
import { buildWorld } from './worldgen-br.js';

export function attachAIMapUI(){
  const Q = window.QUANTUMI;
  let panel = document.getElementById('ai-panel');
  if (!panel){
    panel = document.createElement('div');
    panel.id='ai-panel';
    panel.style.cssText='position:absolute;left:10px;bottom:10px;z-index:41;background:rgba(0,0,0,.45);color:#fff;padding:10px;border-radius:10px;font:12px system-ui;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
    panel.innerHTML = `
      <input id="ai-seed" placeholder="seed" value="btc" style="width:90px">
      <input id="ai-prompt" placeholder="world prompt" value="grass cliffs neon city" style="width:200px">
      <select id="ai-size">
        <option value="6x6x12" selected>6x6 @12</option>
        <option value="8x8x10">8x8 @10</option>
        <option value="10x10x8">10x10 @8</option>
      </select>
      <button id="ai-gen">Generate</button>
      <span id="ai-status"></span>
    `;
    document.body.appendChild(panel);
  }
  const $=(id)=>document.getElementById(id);

  async function generate(){
    const [cols,rows,size] = $('#ai-size').value.split('x').map(Number);
    const gen = new AIMapGen({});
    $('#ai-status').textContent = 'Generating…';
    try{
      const desc = await gen.generate({
        seed: $('#ai-seed').value.trim() || 'btc',
        prompt: $('#ai-prompt').value.trim() || 'terrain',
        cols, rows, size
      });
      buildWorld({ scene: Q.scene, mapDesc: desc });
      window.QUANTUMI.lastMap = desc;
      $('#ai-status').textContent = descLabel(desc);
    }catch(e){
      // Shouldn’t land here often; ai-mapgen has its own fallback.
      $('#ai-status').textContent = 'Error: ' + e.message;
      console.error(e);
    }
  }
  $('#ai-gen').onclick = generate;

  // command hook
  window.QUANTUMI = window.QUANTUMI || {};
  window.QUANTUMI.commands = window.QUANTUMI.commands || { list:[], run:(c)=>{} };
  const run0 = window.QUANTUMI.commands.run.bind(window.QUANTUMI.commands);
  window.QUANTUMI.commands.run = (cmd,arg)=> cmd==='ai-generate' ? generate() : run0(cmd,arg);
  window.QUANTUMI.commands.list.push(['AI: Generate Map','ai-generate']);
}
