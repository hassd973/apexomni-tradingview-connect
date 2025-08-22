/* game-settings.js — unified config + persistence + events */
export const DEFAULTS = {
  version: 4,
  // Camera / feel
  fov: 85,
  sens: 0.18,          // mouse/RS sensitivity (deg per pixel * 100)
  invertY: false,
  // Movement
  moveSpeed: 3.8,
  runMult: 1.6,
  strafeSpeed: 2.2,
  // Hash path visuals
  pathRadiusMode: "auto", // "auto" | "fixed"
  pathRadiusFixed: 0.22,  // when mode=fixed
  rideHeight: 0.04,
  // Visual quality
  quality: "balanced",    // "performance" | "balanced" | "quality"
  maxDensity: 160,        // cap UI density
  antialias: true,
  pointSize: 0.02,
  // HUD / UI
  hudScale: 1.0
};

const KEY = "quantumi-settings-v4";
export function loadSettings(){
  try{ const s = JSON.parse(localStorage.getItem(KEY)||"{}"); return { ...DEFAULTS, ...s }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch{} }

export function bindSettingsBus(){
  window.addEventListener("storage", (e)=>{ if (e.key===KEY) document.dispatchEvent(new CustomEvent("settings:changed")); });
}
export function emitSettingsChanged(){ document.dispatchEvent(new CustomEvent("settings:changed")); }
