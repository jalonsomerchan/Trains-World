const GAME_KEY = 'railway-save-v1';
const CACHE_KEY = 'railway-cache-v1';
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export const loadGame = fallback => read(GAME_KEY, fallback);
export const saveGame = game => write(GAME_KEY, game);
export const loadCache = () => read(CACHE_KEY, {});
export const saveCache = cache => write(CACHE_KEY, cache);
