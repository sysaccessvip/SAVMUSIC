/**
 * script.js — Plantilla de arranque (sin lógica del reproductor)
 * - Aquí puedes pegar tu código JS completamente distinto.
 * - Incluye utilidades: carga dinámica de scripts/estilos, bus simple y helpers SW.
 */

/* ========== UTILIDADES ========== */

// Namespace global para acceder desde consola
window._app = window._app || {};
const APP = window._app;

// Cargar script dinámicamente (útil para módulos grandes)
APP.loadScript = function(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    if (opts.module) s.type = 'module';
    if (opts.defer) s.defer = true;
    s.async = !!opts.async;
    s.onload = () => resolve(s);
    s.onerror = (e) => reject(e);
    document.body.appendChild(s);
  });
};

// Cargar CSS dinámicamente
APP.loadCSS = function(url) {
  return new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    l.onload = () => resolve(l);
    l.onerror = (e) => reject(e);
    document.head.appendChild(l);
  });
};

// Bus simple de eventos para desacoplar módulos
APP.bus = (function() {
  const map = new Map();
  return {
    on: (ev, fn) => { (map.get(ev) || map.set(ev,[])).get ? null : null; (map.get(ev) || map.set(ev,[])); map.get(ev).push(fn); },
    off: (ev, fn) => { const arr = map.get(ev) || []; map.set(ev, arr.filter(x=>x!==fn)); },
    emit: (ev, data) => { (map.get(ev) || []).slice().forEach(fn => { try{ fn(data); }catch(e){ console.warn('bus handler', e); } }); }
  };
})();

/* ========== SERVICE WORKER HELPERS ========== */

APP.sendToSW = async function(msg) {
  if(!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return null;
  return new Promise((resolve) => {
    const msgChan = new MessageChannel();
    msgChan.port1.onmessage = (ev) => resolve(ev.data);
    navigator.serviceWorker.controller.postMessage(msg, [msgChan.port2]);
  });
};

// Ejemplos:
// APP.sendToSW({type:'CACHE_URLS', payload:['/ruta1','/ruta2']});
// APP.sendToSW({type:'CLEAR_CACHES'});

/* ========== STORAGE SIMPLE ==========
   Útil para guardar configuración/localState de tu otro código.
*/
APP.storage = {
  get: (k, fallback=null) => {
    try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : fallback; } catch(e){ return fallback; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn('storage set', e); }
  },
  remove: (k) => { localStorage.removeItem(k); }
};


  
/* =====================
   Config + Storage
   ===================== */
/* --- REEMPLAZAR AQUI: bloque CONFIG completo --- */
const CONFIG = {
  YT_MAX_RESULTS: 7,
  API_KEYS: [
    // keys antiguas (conservadas)
    "AIzaSyCzu-Mqx22V83ktalXksUnC1AhtZwzyb-0",
    "AIzaSyBM-uvKMHe5GxNuMpWB45-RWVUGYOGwEyQ",
    "AIzaSyAd6JdvYn7YGMfSY9EaJtCEUGd11tKa6ZI",
    "AIzaSyBr2nxeKaN1q07fMV59zrLEOQx9dzYBsMI",
    "AIzaSyBbnepAY-irFm35H7Qu0NrwISzLCThkBKM",
    "AIzaSyAujlR4Gig8puLuzM-amckcwu5sbMRvIR0",
    "AIzaSyBiGJ9JeOdkrUI7x-qQHyrHpUJAxcwRTvI",
    "AIzaSyC_UCUc3zcffX5_IOPFpqbJyXmUYxKOg9U",
    // keys nuevas que nos diste (añadidas al final)
    "AIzaSyC7FYbsVmGA0LnepHG7t_xPOR0mEkQ1jiE",
    "AIzaSyBLTPa7EUAmnJZMq4sYBT97x4HY3--YHws",
    "AIzaSyDWAi-0_oqg5GHwEoE0_LnSLSV_nsfs1SI",
    "AIzaSyBJ6zZI3BFvBd02EcdsJFE7dLdZ-f7RV9c",
    "AIzaSyD_9Flh18VT4hJ0OkEIS3TCECJ4vIOcfC0",
    "AIzaSyC3_rIZ5deseDbte7auVOo7oUDjopEMaBg",
    "AIzaSyA9jC-p2NtbeppL8x0YKQqNkrdOggt3Q48"
  ],
  STORAGE_PREFIX: 'mp_'
};
/* --- FIN REEMPLAZO --- */


let STORAGE = {
  recent: JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'recent') || '[]'),
  favorites: JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'fav') || '[]'),
  playlists: JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'playlists') || '{}'),
  keyIndex: parseInt(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'key_index') || '0', 10) || 0
};
function saveStorage(){ localStorage.setItem(CONFIG.STORAGE_PREFIX + 'recent', JSON.stringify(STORAGE.recent)); localStorage.setItem(CONFIG.STORAGE_PREFIX + 'fav', JSON.stringify(STORAGE.favorites)); localStorage.setItem(CONFIG.STORAGE_PREFIX + 'playlists', JSON.stringify(STORAGE.playlists)); localStorage.setItem(CONFIG.STORAGE_PREFIX + 'key_index', STORAGE.keyIndex.toString()); }
function getCurrentKeyAndAdvance(advance=false){ const keys = CONFIG.API_KEYS; let idx = STORAGE.keyIndex % keys.length; const key = keys[idx]; if(advance){ STORAGE.keyIndex = (idx + 1) % keys.length; saveStorage(); } return {key, idx}; }

/* =====================
   UI helpers
   ===================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const modalRoot = $('#modalRoot');
const toastRoot = $('#toastRoot');

/* showModal mejorado: en pantallas pequeñas aparece como bottom-sheet */
function showModal({title='', html='', buttons=[]}){
  modalRoot.innerHTML = `<div class="modal-bg"><div class="modal"><div style="font-weight:700;margin-bottom:8px">${title}</div><div id="modalBody">${html}</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px" id="modalBtns"></div></div></div>`;
  modalRoot.classList.remove('hidden');
  const btnArea = document.getElementById('modalBtns');
  buttons.forEach(btn=>{
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.textContent = btn.label;
    b.style.padding = '8px 12px';
    b.addEventListener('click', ()=>{
      if(btn.onClick) btn.onClick();
      if(btn.close !== false) closeModal();
    });
    btnArea.appendChild(b);
  });

  // Si la pantalla es angosta, transformar modal en bottom-sheet para mejor UX en móvil
  const modalBg = modalRoot.querySelector('.modal-bg');
  const modalEl = modalRoot.querySelector('.modal');
  if(window.innerWidth <= 480){
    modalEl.style.maxWidth = '100%';
    modalEl.style.minWidth = '100%';
    modalEl.style.height = '60vh';
    modalEl.style.borderRadius = '12px 12px 0 0';
    modalEl.style.margin = '0';
    modalBg.style.alignItems = 'flex-end';
  } else {
    modalEl.style.maxWidth = '';
    modalEl.style.minWidth = '';
    modalEl.style.height = '';
    modalEl.style.borderRadius = '';
    modalBg.style.alignItems = 'center';
  }

  // allow clicking overlay to close
  modalBg.addEventListener('click', (ev)=>{
    if(ev.target === modalBg) closeModal();
  });
}
function closeModal(){ modalRoot.classList.add('hidden'); modalRoot.innerHTML = ''; }

function showToast(msg, ms=1800){
  toastRoot.innerHTML = `<div class="toast">${msg}</div>`;
  toastRoot.classList.remove('hidden');
  setTimeout(()=>{ toastRoot.classList.add('hidden'); toastRoot.innerHTML=''; }, ms);
}

/* =====================
   YouTube search with rotation
   ===================== */
async function youtubeSearch(query, maxResults=CONFIG.YT_MAX_RESULTS){
  if(!query || !query.trim()) return [];
  const q = encodeURIComponent(query);
  for(let i=0;i<CONFIG.API_KEYS.length;i++){
    const {key, idx} = getCurrentKeyAndAdvance(i>0);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${q}&key=${key}`;
    try{
      const res = await fetch(url);
      if(!res.ok) { continue; }
      const data = await res.json();
      STORAGE.keyIndex = idx; saveStorage();
      return (data.items || []).map(it=>({
        videoId: it.id.videoId,
        title: it.snippet.title,
        channel: it.snippet.channelTitle,
        thumb: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url
      }));
    }catch(err){ continue; }
  }
  showToast('No fue posible conectar con YouTube');
  return [];
}

/* =====================
   Player & state
   ===================== */
let visiblePlayer = null;
let hiddenPlayer = null;
let playersReady = false;
let pendingPlay = null; // {videoId, autoplay}
let queue = [];
let currentIndex = -1;
let currentTrack = null;
let isPlaying = false;
let repeatMode = 'none';
let shuffle = false;
let progressTimer = null;
let videoShown = true;
let transferInProgress = false; // evita transferencias concurrentes entre visible <-> hidden


(function loadYT(){ const t = document.createElement('script'); t.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(t); })();

window.onYouTubeIframeAPIReady = function(){
  visiblePlayer = new YT.Player('ytVisible', {
    width:'100%', height:'100%',
    playerVars:{autoplay:0,controls:1,rel:0,modestbranding:1,playsinline:1},
    events:{onReady:onVisibleReady, onStateChange:onStateChange, onError:onPlayerError}
  });
  const holder = document.createElement('div'); holder.id = 'ytHiddenHolder'; holder.style.display='none'; document.getElementById('ytApiHolder').appendChild(holder);
  hiddenPlayer = new YT.Player(holder.id, {
    width:0, height:0,
    playerVars:{autoplay:0,controls:0,rel:0,modestbranding:1,playsinline:1},
    events:{onReady:onHiddenReady, onStateChange:onStateChange, onError:onPlayerError}
  });
};

function onVisibleReady(){ checkPlayersReady(); }
function onHiddenReady(){ checkPlayersReady(); }
function checkPlayersReady(){
  if(visiblePlayer && hiddenPlayer){ playersReady = true;
    if(pendingPlay){ try{ loadAndPlayById(pendingPlay.videoId, pendingPlay.autoplay); }catch(e){} pendingPlay = null; }
  }
}

function onStateChange(e){
  const s = e.data;
  if(s === YT.PlayerState.PLAYING){ isPlaying = true; setPlayIcon(true); startProgressTimer(); showMini(true); spinVinyl(true); }
  else if(s === YT.PlayerState.PAUSED){ isPlaying = false; setPlayIcon(false); stopProgressTimer(); spinVinyl(false); }
  else if(s === YT.PlayerState.ENDED){ if(repeatMode === 'one'){ playCurrent(); } else { playNext(); } }
}
function onPlayerError(e){ console.warn('YT error', e); showToast('Error reproductor'); }

/* robust loading: if players not ready, set pendingPlay */
function loadAndPlayById(videoId, autoplay=true, setQueue=true, indexOverride=null){
  if(!videoId) return;
  if(setQueue && indexOverride!==null) currentIndex = indexOverride;
  currentTrack = queue[currentIndex] || {videoId, title:'', channel:'', thumb:''};
  updateNowCard(currentTrack);
  if(!playersReady){
    pendingPlay = {videoId, autoplay};
    showToast('Cargando reproductor...');
    return;
  }
  try{
    const useVisible = videoShown && visiblePlayer && typeof visiblePlayer.loadVideoById === 'function';
    if(useVisible){
      visiblePlayer.loadVideoById({videoId, startSeconds:0});
      if(autoplay) visiblePlayer.playVideo();
    } else {
      hiddenPlayer.loadVideoById({videoId, startSeconds:0});
      if(autoplay) hiddenPlayer.playVideo();
    }
  }catch(e){
    console.warn('loadAndPlay error', e);
    showToast('Error iniciar reproducción');
  }
  addRecent(currentTrack);
  saveStorage();
}

function playCurrent(){ if(currentIndex<0 || currentIndex>=queue.length) return; loadAndPlayById(queue[currentIndex].videoId, true, true, currentIndex); }
function playNext(){
  if(queue.length===0) return;
  if(shuffle) currentIndex = Math.floor(Math.random()*queue.length); else currentIndex++;
  if(currentIndex >= queue.length){
    if(repeatMode === 'all') currentIndex = 0;
    else { currentIndex = queue.length -1; stopPlayback(); return; }
  }
  playCurrent();
}
function playPrev(){
  try{
    const p = (videoShown && visiblePlayer && visiblePlayer.getCurrentTime) ? visiblePlayer : hiddenPlayer;
    if(p && p.getCurrentTime && p.seekTo){
      const cur = p.getCurrentTime();
      if(cur > 3){ p.seekTo(0, true); return; }
    }
  }catch(e){}
  currentIndex--;
  if(currentIndex < 0){
    if(repeatMode === 'all') currentIndex = queue.length - 1;
    else currentIndex = 0;
  }
  playCurrent();
}
function stopPlayback(){
  try{ visiblePlayer && visiblePlayer.stopVideo && visiblePlayer.stopVideo(); }catch(e){}
  try{ hiddenPlayer && hiddenPlayer.stopVideo && hiddenPlayer.stopVideo(); }catch(e){}
  isPlaying = false; setPlayIcon(false); stopProgressTimer(); spinVinyl(false);
}
function togglePlayPause(){ const p = (videoShown && visiblePlayer && visiblePlayer.getPlayerState) ? visiblePlayer : hiddenPlayer; if(!p || typeof p.getPlayerState !== 'function') return; const s = p.getPlayerState(); if(s === YT.PlayerState.PLAYING) p.pauseVideo(); else p.playVideo(); }
function setPlayIcon(playing){
  $('#playIcon').innerHTML = playing ? `<path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z" fill="#1b0a00"></path>` : `<path d="M5 3v18l15-9L5 3z" fill="#1b0a00"></path>`;
  const miniSvg = $('#miniPlayIcon');
  if(miniSvg) miniSvg.innerHTML = playing ? `<path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z" fill="#111"></path>` : `<path d="M5 3v18l15-9L5 3z" fill="#111"></path>`;
}
function startProgressTimer(){ stopProgressTimer(); progressTimer = setInterval(()=>{ try{ const p = (videoShown && visiblePlayer && visiblePlayer.getCurrentTime) ? visiblePlayer : hiddenPlayer; if(!p || !p.getDuration) return; const dur = p.getDuration() || 0; const cur = p.getCurrentTime() || 0; const pct = dur > 0 ? (cur/dur)*100 : 0; $('#progressBar').style.width = pct + '%'; }catch(e){} }, 400); }
function stopProgressTimer(){ if(progressTimer) clearInterval(progressTimer); progressTimer=null; }

/* vinyl spin */
let vinylInterval = null;
function spinVinyl(on){
  const el = $('#vinylCover');
  if(!el) return;
  if(on){
    let angle = 0;
    if(vinylInterval) clearInterval(vinylInterval);
    vinylInterval = setInterval(()=>{ angle = (angle+0.9)%360; el.style.transform = `rotate(${angle}deg)`; }, 30);
  } else { if(vinylInterval) clearInterval(vinylInterval); vinylInterval=null; el.style.transform='rotate(0deg)'; }
}

/* update UI */
function updateNowCard(track){
  if(!track) return;
  $('#nowTitle').textContent = track.title || 'No se reproduce';
  $('#nowArtist').textContent = track.channel || '—';
  if(track.thumb) $('#vinylCover').style.backgroundImage = `url('${track.thumb}')`;
  $('#miniThumb').style.backgroundImage = `url('${track.thumb || 'https://dummyimage.com/600x600/222/fff'}')`;
  $('#miniTitle').textContent = track.title || 'No se reproduce';
  $('#miniArtist').textContent = track.channel || '—';
  $('#miniPlayer').classList.remove('hidden');
}

/* =====================
   Rendering results & lists
   ===================== */
function renderResults(list){
  const area = $('#listArea');
  area.innerHTML = '';
  if(!list || list.length===0){ area.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">Sin resultados</div>`; return; }
  list.forEach((tr,i)=>{
    const el = document.createElement('div'); el.className='song';
    const favState = STORAGE.favorites.find(f=>f.videoId===tr.videoId) ? '♥' : '♡';
    el.innerHTML = `
      <div class="thumb" style="background-image:url('${tr.thumb}')"></div>
      <div class="meta"><div class="name">${escapeHtml(tr.title)}</div><div class="sub">${escapeHtml(tr.channel)}</div></div>
      <div class="btns">
        <button class="icon-btn btn-add" title="Añadir a playlist" data-vid="${tr.videoId}"> 
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
        </button>
        <button class="icon-btn btn-fav local" title="Favorito">${favState}</button>
        <button class="icon-btn btn-play" title="Reproducir" data-vid="${tr.videoId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 3v18l15-9L5 3z" fill="currentColor"></path></svg>
        </button>
      </div>`;
    // play when clicking row (but ignore clicks on the small buttons)
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.btn-add') || ev.target.closest('.btn-play') || ev.target.closest('.btn-fav')) return;
      queue = list.slice(); currentIndex = i; currentTrack = queue[currentIndex];
      loadAndPlayById(currentTrack.videoId, true, true, currentIndex);
    });
    // individual play button
    el.querySelector('.btn-play').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      queue = list.slice(); currentIndex = i; currentTrack = queue[currentIndex];
      loadAndPlayById(currentTrack.videoId, true, true, currentIndex);
    });
    // add to playlist
    el.querySelector('.btn-add').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      openAddToPlaylistModal(tr);
    });
    // favorite toggle for result rows
    el.querySelector('.btn-fav').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      toggleFavorite(tr);
      const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
      if(activeTab === 'tab-list'){ renderResults(lastResults); }
      else if(activeTab === 'tab-favorites'){ renderFavorites(); }
      else if(activeTab === 'tab-recientes'){ renderRecents(); }
    });
    area.appendChild(el);
  });
}
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c=>({'&':'&','<':'<','>':'>','"':'"',"'":"'"}[c])); }

/* =====================
   Recents / favorites / playlists
   ===================== */

   
function addRecent(track){
  if(!track || !track.videoId) return;
  STORAGE.recent = STORAGE.recent.filter(t=>t.videoId !== track.videoId);
  STORAGE.recent.push(track);
  if(STORAGE.recent.length > 40) STORAGE.recent = STORAGE.recent.slice(-40);
  saveStorage();
}
function toggleFavorite(track){
  if(!track || !track.videoId) return;
  const ex = STORAGE.favorites.find(t=>t.videoId===track.videoId);
  if(ex) STORAGE.favorites = STORAGE.favorites.filter(t=>t.videoId!==track.videoId);
  else STORAGE.favorites.push(track);
  saveStorage(); showToast(ex ? 'Quitado de favoritos':'Añadido a favoritos');
}
function renderRecents(){
  const area = $('#listArea'); area.innerHTML='';
  if(!STORAGE.recent.length){
    area.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No hay recientes</div>`;
    return;
  }

  // mostramos en orden invertido para mantener la misma UI (más reciente primero)
  const recList = STORAGE.recent.slice().reverse();

  recList.forEach((tr, idx)=>{
    const el = document.createElement('div'); el.className='song';
    const thumb = (typeof getThumb === 'function') ? getThumb(tr) : (tr.thumb || 'https://dummyimage.com/600x600/ddd/222');
    el.innerHTML = `<div class="thumb" style="background-image:url('${thumb}')"></div>
       <div class="meta"><div class="name">${escapeHtml(tr.title)}</div><div class="sub">${escapeHtml(tr.channel)}</div></div>
       <div class="btns">
         <button class="icon-btn btn-add" title="Añadir a playlist"> 
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
         </button>
         <button class="icon-btn btn-fav local">${STORAGE.favorites.find(f=>f.videoId===tr.videoId) ? '♥' : '♡'}</button>
         <button class="icon-btn btn-remove" title="Eliminar de recientes">🗑</button>
       </div>`;

    // Click en la fila -> reproducir LA LISTA de Recientes empezando por este índice
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.btn-add')||ev.target.closest('.btn-fav')||ev.target.closest('.btn-remove')) return;
      queue = recList.slice();
      currentIndex = idx;
      currentTrack = queue[currentIndex];
      playCurrent();
    });

    // add to playlist
    el.querySelector('.btn-add').addEventListener('click', (ev)=>{ ev.stopPropagation(); openAddToPlaylistModal(tr); });

    // fav toggle
    el.querySelector('.btn-fav').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      toggleFavorite(tr);
      renderRecents(); // re-render para actualizar el icono ♥/♡
    });

    // remove from recents
    el.querySelector('.btn-remove').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      STORAGE.recent = STORAGE.recent.filter(r=>r.videoId !== tr.videoId);
      saveStorage();
      renderRecents();
      showToast('Eliminado de recientes');
    });

    area.appendChild(el);
  });
}

function renderFavorites(){
  const area = $('#listArea'); area.innerHTML='';
  if(!STORAGE.favorites.length){
    area.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No hay favoritos</div>`;
    return;
  }

  // Mostramos la lista en orden inverso (más reciente primero), igual que antes
  const favList = STORAGE.favorites.slice().reverse();

  favList.forEach((tr, idx)=>{
    const el = document.createElement('div'); el.className='song';
    const thumb = (typeof getThumb === 'function') ? getThumb(tr) : (tr.thumb || 'https://dummyimage.com/600x600/ddd/222');
    el.innerHTML = `<div class="thumb" style="background-image:url('${thumb}')"></div>
       <div class="meta"><div class="name">${escapeHtml(tr.title)}</div><div class="sub">${escapeHtml(tr.channel)}</div></div>
       <div class="btns">
         <button class="icon-btn btn-add" title="Añadir a playlist"> 
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
         </button>
         <button class="icon-btn btn-fav local">♥</button>
         <button class="icon-btn btn-remove" title="Eliminar de favoritos">🗑</button>
       </div>`;

    // Al hacer click en la fila: reproducir LA LISTA de Favoritos, empezando en este índice
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.btn-add')||ev.target.closest('.btn-fav')||ev.target.closest('.btn-remove')) return;
      // establecemos queue como la lista completa de favoritos (en el mismo orden que se muestra)
      queue = favList.slice();
      currentIndex = idx;
      currentTrack = queue[currentIndex];
      playCurrent();
    });

    // botón añadir a playlist
    el.querySelector('.btn-add').addEventListener('click', (ev)=>{ ev.stopPropagation(); openAddToPlaylistModal(tr); });

    // toggle favorito (quita si ya era favorito)
    el.querySelector('.btn-fav').addEventListener('click', (ev)=>{ 
      ev.stopPropagation();
      toggleFavorite(tr); 
      // re-render para reflejar cambio
      renderFavorites();
    });

    // eliminar de favoritos (por videoId para evitar errores de índice)
    el.querySelector('.btn-remove').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      STORAGE.favorites = STORAGE.favorites.filter(r=>r.videoId !== tr.videoId);
      saveStorage();
      renderFavorites();
      showToast('Eliminado de favoritos');
    });

    area.appendChild(el);
  });
}

function renderPlaylistsUI(){
  const area = $('#listArea'); area.innerHTML='';
  const keys = Object.keys(STORAGE.playlists || {});
  if(keys.length===0){ area.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No hay playlists</div>`; return; }
  keys.forEach(name=>{
    const pl = STORAGE.playlists[name];
    const el = document.createElement('div'); el.className='song';
    el.innerHTML = `<div class="thumb" style="background-image:url('${pl[0]?.thumb || 'https://dummyimage.com/600x600/ddd/222'}')"></div>
      <div class="meta"><div class="name">${escapeHtml(name)}</div><div class="sub">${pl.length} canciones</div></div>
      <div class="btns"><button class="icon-btn btn-open">Abrir</button><button class="icon-btn btn-delete" title="Eliminar playlist">🗑</button></div>`;
    el.querySelector('.btn-open').addEventListener('click', (ev)=>{ ev.stopPropagation(); openPlaylistView(name); });
    el.querySelector('.btn-delete').addEventListener('click', (ev)=>{ ev.stopPropagation(); showModal({title:'Confirmar', html:`<div>Eliminar playlist <b>${escapeHtml(name)}</b>?</div>`, buttons:[{label:'Cancelar'},{label:'Eliminar', onClick: ()=>{ delete STORAGE.playlists[name]; STORAGE.playlists = STORAGE.playlists || {}; saveStorage(); renderPlaylistsUI(); showToast('Eliminada'); }}]}); });
    area.appendChild(el);
  });
}

/* add to playlist */
function openAddToPlaylistModal(track){
  const names = Object.keys(STORAGE.playlists || {});
  const html = `<div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-weight:700">${escapeHtml(track.title)}</div>
    <div class="sub">${escapeHtml(track.channel)}</div>
    <select id="plSelect" style="padding:8px;border-radius:8px;background:#f6f9ff;border:1px solid rgba(16,24,40,0.04)">
      ${names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
    </select>
    <input id="newPlName" placeholder="O crear nueva playlist..." style="padding:8px;border-radius:8px;border:1px solid rgba(16,24,40,0.04)"/>
  </div>`;
  showModal({
    title:'Añadir a playlist',
    html,
    buttons:[
      {label:'Cancelar'},
      {label:'Añadir', onClick: ()=>{
        const newName = document.getElementById('newPlName').value.trim();
        const sel = document.getElementById('plSelect')?.value;
        const name = newName || sel;
        if(!name){ showToast('Escribe o selecciona un nombre'); return; }
        if(!STORAGE.playlists[name]) STORAGE.playlists[name] = [];
        STORAGE.playlists[name].push(track); saveStorage(); showToast('Añadido a '+name);
      }}
    ]
  });
}

/* playlist view (modal) */
function openPlaylistView(name){
  const list = STORAGE.playlists[name] || [];
  const html = `<div style="max-height:320px;overflow:auto">
    ${list.map((t, i)=>`
      <div data-i="${i}" class="pl-row" style="display:flex;gap:8px;padding:8px;align-items:center;cursor:pointer">
        <div class="pl-thumb" style="background-image:url('${t.thumb}');background-size:cover"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${escapeHtml(t.title)}</div>
          <div class="sub">${escapeHtml(t.channel)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="icon-btn btn-play-pl" data-i="${i}" title="Reproducir">▶</button>
          <button class="icon-btn btn-remove-pl" data-i="${i}" title="Eliminar">🗑</button>
        </div>
      </div>`).join('')}
  </div>`;
  showModal({
    title:'Playlist: '+name,
    html,
    buttons:[
      {label:'Cerrar'},
      {label:'Eliminar', onClick: ()=>{
        showModal({title:'Confirmar', html:`<div>Eliminar playlist <b>${escapeHtml(name)}</b>?</div>`, buttons:[
          {label:'Cancelar'}, {label:'Eliminar', onClick: ()=>{ delete STORAGE.playlists[name]; STORAGE.playlists = STORAGE.playlists || {}; saveStorage(); renderPlaylistsUI(); showToast('Eliminada'); }}
        ]});
      }}
    ]
  });
  // attach click handlers
  setTimeout(()=>{
    document.querySelectorAll('.pl-row').forEach((r)=>{
      r.addEventListener('click', ()=>{
        const i = parseInt(r.dataset.i, 10);
        queue = STORAGE.playlists[name].slice();
        currentIndex = i;
        currentTrack = queue[currentIndex];
        playCurrent();
        closeModal();
      });
    });
    document.querySelectorAll('.btn-play-pl').forEach(b=>{
      b.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i = parseInt(b.dataset.i,10); queue = STORAGE.playlists[name].slice(); currentIndex = i; currentTrack = queue[currentIndex]; playCurrent(); closeModal(); });
    });
    document.querySelectorAll('.btn-remove-pl').forEach(b=>{
      b.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i = parseInt(b.dataset.i,10); STORAGE.playlists[name].splice(i,1); saveStorage(); openPlaylistView(name); showToast('Canción eliminada'); });
    });
  }, 60);
}

/* create playlist */
$('#btnCreatePL').addEventListener('click', ()=>{
  showModal({
    title:'Crear playlist',
    html:`<input id="plNameInput" placeholder="Nombre playlist" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(16,24,40,0.04)"/>`,
    buttons:[
      {label:'Cancelar'},
      {label:'Crear', onClick: ()=>{ const nm = $('#plNameInput').value.trim(); if(!nm){ showToast('Nombre requerido'); return; } if(STORAGE.playlists[nm]){ showToast('Ya existe'); return; } STORAGE.playlists[nm]=[]; saveStorage(); renderPlaylistsUI(); showToast('Creada'); }}
    ]
  });
});


/* ==========================
   Mini-player: mandar al fondo / traer al frente
   ========================== */
function miniToBack(){
  const m = document.getElementById('miniPlayer');
  if(m) m.classList.add('behind');
}
function miniToFront(){
  const m = document.getElementById('miniPlayer');
  if(m) m.classList.remove('behind');
}

/* activar el mini al fondo mientras el usuario escribe en el buscador */
$('#searchBtn').addEventListener('click', onSearch);


/* ==========================
   Autocomplete + debounce
   ========================== */

function debounce(fn, wait){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}

const suggestionsContainer = document.getElementById('suggestions');
let suggestionList = [];
let suggestionIndex = -1; // índice resaltado

// render suggestions into the dropdown
function renderSuggestions(list){
  if(!suggestionsContainer) return;
  suggestionsContainer.innerHTML = '';
  if(!list || list.length === 0){
    suggestionsContainer.style.display = 'none';
    suggestionList = [];
    suggestionIndex = -1;
    return;
  }
  list.forEach((it, i)=>{
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.setAttribute('role','option');
    div.dataset.i = i;
    div.innerHTML = `
      <div class="suggestion-thumb" style="background-image:url('${it.thumb || 'https://dummyimage.com/600x600/ddd/222'}')"></div>
      <div class="suggestion-body">
        <div class="suggestion-title">${escapeHtml(it.title)}</div>
        <div class="suggestion-sub">${escapeHtml(it.channel)}</div>
      </div>
    `;
    // mousedown en vez de click para evitar que el blur del input limpie antes
    div.addEventListener('mousedown', (ev)=>{
      ev.preventDefault();
      selectSuggestionByIndex(i);
    });
    div.addEventListener('mouseover', ()=> setSuggestionIndex(i));
    suggestionsContainer.appendChild(div);
  });
  suggestionList = list.slice();
  suggestionIndex = -1;
  highlightSuggestion();
  suggestionsContainer.style.display = 'block';
}

function clearSuggestions(){
  if(!suggestionsContainer) return;
  suggestionsContainer.innerHTML = '';
  suggestionsContainer.style.display = 'none';
  suggestionList = [];
  suggestionIndex = -1;
}

function setSuggestionIndex(i){
  suggestionIndex = i;
  highlightSuggestion();
}

function moveSuggestion(delta){
  if(!suggestionList.length) return;
  suggestionIndex = ( (suggestionIndex + delta) + suggestionList.length ) % suggestionList.length;
  highlightSuggestion();
  // scroll into view for the highlighted element
  const el = suggestionsContainer.children[suggestionIndex];
  if(el) el.scrollIntoView({block:'nearest'});
}

function highlightSuggestion(){
  const items = suggestionsContainer.children;
  for(let j=0;j<items.length;j++){
    items[j].classList.toggle('active', j === suggestionIndex);
  }
}

function selectSuggestionByIndex(i){
  const item = suggestionList[i];
  if(!item) return;
  // Rellena el input con el título y ejecuta búsqueda, limpiando el input después
  $('#searchInput').value = item.title || '';
  clearSuggestions();
  // llamamos con clearInput = true para que al terminar la búsqueda se borre el input
  onSearch(true);
}

/* debounce wrapper that queries youtube for suggestions */
const doSuggest = debounce(async (q)=>{
  if(!q) { clearSuggestions(); return; }
  try{
    const res = await youtubeSearch(q, Math.min(5, CONFIG.YT_MAX_RESULTS));
    renderSuggestions(res || []);
  }catch(err){
    console.warn('suggest error', err);
    clearSuggestions();
  }
}, 300);

/* --- attach enhanced listeners to search input --- */
const searchInputEl = document.getElementById('searchInput');
if(searchInputEl){
  // input -> suggestions (debounced), y UI overlay / mini control (ya tenías esto)
  searchInputEl.addEventListener('input', (e)=>{
    const v = e.target.value || '';
    if(v.trim()){
      document.getElementById('rightPanel').classList.add('search-active');
      miniToBack();
    } else {
      document.getElementById('rightPanel').classList.remove('search-active');
      miniToFront();
      clearSuggestions();
    }
    doSuggest(v.trim());
  });

  // key navigation
// reemplaza el listener antiguo por este
searchInputEl.addEventListener('keydown', (e)=>{
  // if suggestions visible, handle up/down/enter/esc
  const visible = suggestionList && suggestionList.length > 0;
  if(visible){
    if(e.key === 'ArrowDown'){ e.preventDefault(); moveSuggestion(1); return; }
    if(e.key === 'ArrowUp'){ e.preventDefault(); moveSuggestion(-1); return; }
    if(e.key === 'Enter'){
      e.preventDefault();
      if(suggestionIndex >= 0){
        // selectSuggestionByIndex ya llama onSearch(true)
        selectSuggestionByIndex(suggestionIndex);
      } else {
        // presionó Enter sin seleccionar sugerencia -> busca y limpia input
        onSearch(true);
      }
      return;
    }
    if(e.key === 'Escape'){ clearSuggestions(); return; }
  } else {
    // sin sugerencias: Enter hace búsqueda normal y limpia input
    if(e.key === 'Enter'){
      e.preventDefault();
      onSearch(true);
      return;
    }
  }
});


  // blur: esperar un momento para permitir clicks en sugerencias (mousedown handled above)
  searchInputEl.addEventListener('blur', ()=>{
    setTimeout(()=>{
      document.getElementById('rightPanel').classList.remove('search-active');
      miniToFront();
      clearSuggestions();
    }, 180);
  });
}

// keep the search button binding (should already exist)
if(!$('#searchBtn').onclick) $('#searchBtn').addEventListener('click', onSearch);



/* =====================
   Events & behaviors
   ===================== */
$('#searchBtn').addEventListener('click', onSearch);
$('#playBtn').addEventListener('click', togglePlayPause);
$('#miniPlay').addEventListener('click', togglePlayPause);
$('#prevBtn').addEventListener('click', playPrev);
$('#nextBtn').addEventListener('click', playNext);
$('#miniPrev').addEventListener('click', playPrev);
$('#miniNext').addEventListener('click', playNext);

/* ===== UI updates for repeat/shuffle (replace old handlers that used inline opacity) ===== */

function updateShuffleButtonUI(){
  const btn = $('#shuffleBtn');
  if(!btn) return;
  // quitar clases previas
  btn.classList.remove('toggle','active','inactive','shuffle-active');
  btn.classList.add('toggle');
  if(shuffle){
    // si quieres verde para shuffle, usar 'active' en vez de 'shuffle-active'
    btn.classList.add('shuffle-active'); // o 'active' para verde
    btn.classList.remove('inactive');
    btn.setAttribute('aria-pressed', 'true');
  } else {
    btn.classList.remove('shuffle-active');
    btn.classList.add('inactive');
    btn.setAttribute('aria-pressed', 'false');
  }
  btn.title = 'Aleatorio: ' + (shuffle ? 'ON' : 'OFF');
}

function updateRepeatButtonUI(){
  const btn = $('#repeatBtn');
  if(!btn) return;
  btn.classList.remove('toggle','repeat-none','repeat-all','repeat-one','inactive');
  btn.classList.add('toggle');

  if(repeatMode === 'none'){
    btn.classList.add('repeat-none');
    btn.classList.add('inactive');
    btn.setAttribute('aria-pressed', 'false');
  } else if(repeatMode === 'all'){
    btn.classList.add('repeat-all'); // usará el estilo activo (verde)
    btn.setAttribute('aria-pressed', 'true');
  } else if(repeatMode === 'one'){
    btn.classList.add('repeat-one'); // estilo activo + badge '1'
    btn.setAttribute('aria-pressed', 'true');
  }
  btn.title = 'Repetir: ' + repeatMode;
}

/* Reemplazamos los handlers por llamadas a las funciones que actualizan UI */
$('#shuffleBtn').addEventListener('click', ()=>{ 
  shuffle = !shuffle; 
  updateShuffleButtonUI(); 
  showToast('Aleatorio: '+(shuffle?'ON':'OFF')); 
});

$('#repeatBtn').addEventListener('click', ()=>{
  repeatMode = repeatMode === 'none' ? 'all' : (repeatMode === 'all' ? 'one' : 'none');
  updateRepeatButtonUI();
  showToast('Repetir: '+repeatMode);
});

/* minimize */
function minimize(){ $('#leftCard').classList.add('hidden'); $('#miniPlayer').classList.remove('hidden'); showToast('Minimizado — reproducción continúa'); }

$('#btnMinimize').addEventListener('click', minimize);
$('#miniPlayer').addEventListener('click', ()=>{ $('#leftCard').classList.remove('hidden'); $('#miniPlayer').classList.add('hidden'); });

/* queue modal - build with clickable rows that close on click */
$('#btnQueue').addEventListener('click', ()=>{
  if(!queue || !queue.length) return showToast('Cola vacía');
  const html = `<div style="max-height:380px;overflow:auto">${queue.map((t,i)=>`<div data-i="${i}" class="queue-row" style="display:flex;gap:8px;padding:8px;align-items:center;cursor:pointer"><div style="width:44px;height:44px;background-image:url('${t.thumb}');background-size:cover;border-radius:8px"></div><div style="flex:1"><div style="font-weight:700">${escapeHtml(t.title)}</div><div class="sub">${escapeHtml(t.channel)}</div></div><div style="width:48px;text-align:center">${i===currentIndex?'<small>▶</small>':''}</div></div>`).join('')}</div>`;
  showModal({title:'Cola', html, buttons:[{label:'Cerrar'}]});
  setTimeout(()=>{
    document.querySelectorAll('.queue-row').forEach(r=>{
      r.addEventListener('click', ()=>{
        const i = parseInt(r.dataset.i, 10);
        currentIndex = i;
        playCurrent();
        closeModal();
      });
    });
  }, 60);
});

/* video toggle */
$('#btnVideoToggle').addEventListener('click', ()=>{
  videoShown = !videoShown;
  $('#videoBox').style.display = videoShown ? 'block' : 'none';
  if(currentTrack){
    try{
      const cur = (visiblePlayer && visiblePlayer.getCurrentTime) ? visiblePlayer.getCurrentTime() : 0;
      if(!videoShown && hiddenPlayer && hiddenPlayer.loadVideoById){ hiddenPlayer.loadVideoById({videoId: currentTrack.videoId, startSeconds: cur}); hiddenPlayer.playVideo(); visiblePlayer && visiblePlayer.stopVideo && visiblePlayer.stopVideo(); }
      if(videoShown && visiblePlayer && visiblePlayer.loadVideoById){ visiblePlayer.loadVideoById({videoId: currentTrack.videoId, startSeconds: cur}); visiblePlayer.playVideo(); hiddenPlayer && hiddenPlayer.stopVideo && hiddenPlayer.stopVideo(); }
    }catch(e){}
  }
});

/* fullscreen: try iframe, fallback to open youtube */
$('#btnFullScreen').addEventListener('click', ()=>{
  try{
    let iframe = null;
    if(visiblePlayer && typeof visiblePlayer.getIframe === 'function') iframe = visiblePlayer.getIframe();
    if(iframe){
      if(iframe.requestFullscreen) iframe.requestFullscreen();
      else if(iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
      else window.open('https://www.youtube.com/watch?v=' + (currentTrack?.videoId || ''), '_blank');
    }else{
      if(currentTrack && currentTrack.videoId) window.open('https://www.youtube.com/watch?v=' + currentTrack.videoId, '_blank');
    }
  }catch(e){
    if(currentTrack && currentTrack.videoId) window.open('https://www.youtube.com/watch?v=' + currentTrack.videoId, '_blank');
  }
});


let lastResults = [];
/**
 * onSearch(clearInput = false)
 * Si clearInput === true -> borra y desenfoca el input al final (útil cuando se presiona Enter).
 */
async function onSearch(clearInput = false){
  const q = $('#searchInput').value.trim();
  if(!q){ showToast('Escribe para buscar'); return; }

  try{
    const res = await youtubeSearch(q, CONFIG.YT_MAX_RESULTS);
    lastResults = res || [];
    if(res && res.length > 0){
      renderResults(res);
    } else {
      $('#listArea').innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No se encontraron resultados</div>`;
    }
  }catch(e){
    console.warn('search error', e);
    $('#listArea').innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">Error buscando</div>`;
  } finally {
    // mantener el texto en el input (normalmente) y normalizar UI: quitar overlay y traer mini adelante
    document.getElementById('rightPanel').classList.remove('search-active');
    miniToFront();
    clearSuggestions();

    // si nos pidieron limpiar el input (por ejemplo al presionar Enter), lo hacemos aquí
    if(clearInput){
      try{
        const inp = $('#searchInput');
        if(inp){
          inp.value = '';
          inp.blur();
        }
      }catch(e){}
    }
  }
}



/* tabs */
$$('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    $$('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const id = t.dataset.tab;
    if(id === 'tab-list'){ renderResults(lastResults.length ? lastResults : []); }
    else if(id === 'tab-recientes'){ renderRecents(); }
    else if(id === 'tab-favorites'){ renderFavorites(); }
    else if(id === 'tab-playlists'){ renderPlaylistsUI(); }
  });
});

/* initial renders */
function renderAll(){ renderRecents(); renderPlaylistsUI(); }
renderAll();
// Añade esto justo después para sincronizar botones con el estado actual:
updateShuffleButtonUI();
updateRepeatButtonUI();

/* small click outside to remove blur state */
document.addEventListener('click', (e)=>{ if(!e.target.closest('.search-box')) $('#rightPanel').classList.remove('search-active'); });

/* initial toast */
showToast('Listo — busca y toca una fila para reproducir');

/* expose for debugging si quieres */
window._mp = {STORAGE, saveStorage, queue};

/* =====================
   Visibility handling: transfer to hidden player when page hidden
   ===================== */
/* =========================
   Visibility handling - robust transfer (no pause on background/foreground)
   ========================= */

function waitForPlayerState(player, expectedState, timeoutMs = 2500, pollInterval = 150){
  return new Promise((resolve)=>{
    if(!player || typeof player.getPlayerState !== 'function'){ return resolve(false); }
    const start = Date.now();
    const iv = setInterval(()=>{
      try{
        const st = player.getPlayerState();
        if(st === expectedState){ clearInterval(iv); return resolve(true); }
      }catch(e){}
      if(Date.now() - start > timeoutMs){ clearInterval(iv); return resolve(false); }
    }, pollInterval);
  });
}

document.addEventListener('visibilitychange', async ()=>{
  if(!playersReady) return; // si reproductores aun no listos, nothing to do

  // Evitar reentradas
  if(transferInProgress) return;
  transferInProgress = true;

  try{
    // cuando la página se oculta -> intentar asegurar que el player "oculto" reproduzca antes de detener el visible
    if(document.hidden){
      try{
        // solo transferir si visiblePlayer está reproduciendo actualmente
        if(visiblePlayer && typeof visiblePlayer.getPlayerState === 'function' &&
           visiblePlayer.getPlayerState() === YT.PlayerState.PLAYING && currentTrack && currentTrack.videoId){
          const cur = (visiblePlayer && visiblePlayer.getCurrentTime) ? visiblePlayer.getCurrentTime() : 0;
          // carga en hidden
          hiddenPlayer.loadVideoById({videoId: currentTrack.videoId, startSeconds: cur});
          // intenta reproducir inmediatamente
          try{ hiddenPlayer.playVideo && hiddenPlayer.playVideo(); }catch(e){}
          // espera a que hidden realmente entre en PLAYING
          const ok = await waitForPlayerState(hiddenPlayer, YT.PlayerState.PLAYING, 3000);
          if(ok){
            // detener visible solo si hidden ya está reproduciendo
            try{ visiblePlayer.stopVideo && visiblePlayer.stopVideo(); }catch(e){}
          } else {
            // si no pudo arrancar hidden, dejamos visible reproduciendo para evitar pause audible
            try{ /* no hacemos stop en visible */ }catch(e){}
          }
        }
      }catch(err){ console.warn('visibility -> hidden transfer error', err); }
    } else {
      // cuando la página vuelve visible -> transferir de hidden a visible sin cortar audio
      try{
        if(hiddenPlayer && typeof hiddenPlayer.getPlayerState === 'function' &&
           hiddenPlayer.getPlayerState() === YT.PlayerState.PLAYING && currentTrack && currentTrack.videoId){
          const cur = (hiddenPlayer && hiddenPlayer.getCurrentTime) ? hiddenPlayer.getCurrentTime() : 0;
          visiblePlayer.loadVideoById({videoId: currentTrack.videoId, startSeconds: cur});
          try{ visiblePlayer.playVideo && visiblePlayer.playVideo(); }catch(e){}
          const ok = await waitForPlayerState(visiblePlayer, YT.PlayerState.PLAYING, 3000);
          if(ok){
            try{ hiddenPlayer.stopVideo && hiddenPlayer.stopVideo(); }catch(e){}
          } else {
            // si visible no arrancó, mantenemos hidden para no cortar
          }
        }
      }catch(err){ console.warn('visibility -> visible transfer error', err); }
    }
  }finally{
    // permitir futuros transfers
    transferInProgress = false;
  }
});


/* small helper to show mini */
function showMini(show=true){ if(show) $('#miniPlayer').classList.remove('hidden'); else $('#miniPlayer').classList.add('hidden'); }


/**
 * Reemplaza/borra todo lo de abajo y pega aquí tu código JS.
 * Ejemplo mínimo de inicialización:
 */
document.addEventListener('DOMContentLoaded', function() {
  // Código de ejemplo — puedes borrar estas 4 líneas
  const root = document.getElementById('extrasRoot') || document.getElementById('app');
  if(root) {
    const p = document.createElement('p');
    p.textContent = 'Tu código JS puede inicializarse aquí (DOMContentLoaded).';
    p.style.textAlign = 'center';
    p.style.color = '#666';
    root.appendChild(p);
  }

  // Emite evento de arranque
  APP.bus.emit('app.ready', { ts: Date.now() });
});

/* --- FIN: PEGA TU CÓDIGO AQUÍ --- */

/* Exporta APP para debugging */
window._app = APP;
