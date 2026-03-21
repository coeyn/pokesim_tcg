import { CATEGORY_BY_LANG, GRID, K, REG, SUPPORTED_LANGS, gameI18n, mTypes, names } from "./game/constants.js";
import { cacheOfflinePack, registerOfflineServiceWorker } from "./offline/offline.js";
let firebaseApi = null;

const e = { fs: document.getElementById('fullscreenBtn'), deckSel: document.getElementById('gameDeckSelect'), loadDeck: document.getElementById('loadDeckBtn'), reset: document.getElementById('resetGameBtn'), handT: document.getElementById('handToggleBtn'), showHand: document.getElementById('showHandBtn'), draw: document.getElementById('drawBtn'), setupPrizes: document.getElementById('setupPrizesBtn'), prizeDraw: document.getElementById('prizeDrawBtn'), viewDeck: document.getElementById('viewDeckBtn'), shuffle: document.getElementById('shuffleDeckBtn'), deckMenu: document.getElementById('deckMenuBtn'), deckZone: document.getElementById('deckZone'), deckCount: document.getElementById('deckCount'), handCards: document.getElementById('handCards'), discardCount: document.getElementById('discardCount'), discardZone: document.getElementById('discardZone'), discardTop: document.getElementById('discardTopCard'), board: document.getElementById('boardCardsLayer'), cardModal: document.getElementById('cardModal'), closeCard: document.getElementById('closeCardModalBtn'), cardContent: document.getElementById('cardModalContent'), disModal: document.getElementById('discardModal'), closeDis: document.getElementById('closeDiscardModalBtn'), disList: document.getElementById('discardList'), deckModal: document.getElementById('deckModal'), closeDeck: document.getElementById('closeDeckModalBtn'), deckList: document.getElementById('deckList'), deckClosePrompt: document.getElementById('deckClosePromptModal'), deckClosePromptShuffle: document.getElementById('deckClosePromptShuffleBtn'), deckClosePromptNoShuffle: document.getElementById('deckClosePromptNoShuffleBtn'), deckActions: document.getElementById('deckActionsModal'), closeDeckActions: document.getElementById('closeDeckActionsModalBtn'), hint: document.getElementById('dragActionHint'), toast: document.getElementById('actionToast'), playmat: document.querySelector('.playmat'), markers: document.getElementById('markerLayer'), bag: document.getElementById('markerBagBtn'), bagModal: document.getElementById('markerBagModal'), closeBag: document.getElementById('closeMarkerBagModalBtn'), catalog: document.getElementById('markerCatalog'), startScreen: document.getElementById('gameStartScreen'), startDeckSel: document.getElementById('startDeckSelect'), startBtn: document.getElementById('startGameBtn'), resumeBtn: document.getElementById('resumeGameBtn'), offlineBtn: document.getElementById('offlineCacheBtnGame'), createRoomBtn: document.getElementById('createRoomBtn'), joinRoomBtn: document.getElementById('joinRoomBtn'), leaveRoomBtn: document.getElementById('leaveRoomBtn'), roomIdInput: document.getElementById('roomIdInput'), roomStatusBadge: document.getElementById('roomStatusBadge'), roomHelpText: document.getElementById('roomHelpText'), roomCodeLabel: document.getElementById('roomCodeLabel'), roomLiveBadge: document.getElementById('roomLiveBadge') };
let LANG = 'fr';
let S = { deck: [], hand: [], discard: [], placed: [], prizes: [], markers: [], nextPlaced: 1, nextMarker: 1, deckId: '', view: 'all', prizeDone: false, drag: null, mDrag: null, ghost: null, mGhost: null, hideEl: null, snap: null, snapPos: null, saveT: null, toastT: null, blockDis: 0, hydr: false };
let currentCloudUser = null;
let offlineReady = false;
const MP = { roomId: '', hostUid: '', unsub: null, actionId: '', lastRemoteActionId: '', applyingRemote: false, ready: false, roomGameState: null };

const rnd = n => Math.floor(Math.random() * n); const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]] } }; const inR = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
const inferKind = c => { const k = String(c?.kind || '').toLowerCase(); if (k === 'pokemon' || k === 'trainer' || k === 'energy') return k; const cat = String(c?.category || '').toLowerCase(); if (cat.includes('trainer') || cat.includes('dresseur') || cat.includes('entrenador')) return 'trainer'; if (cat.includes('energy') || cat.includes('energie') || cat.includes('energ')) return 'energy'; return 'pokemon' };
const layerRank = c => { const k = inferKind(c); if (k === 'pokemon') return 3; if (k === 'trainer') return 2; if (k === 'energy') return 1; return 2 };
const handHidden = () => document.body.classList.contains('hand-hidden');
const currentUid = () => currentCloudUser?.uid || '';
const uidShort = uid => String(uid || '').slice(0, 6);
const newActionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const emptyPrivateState = () => ({ deck: [], hand: [], discard: [], prizes: [], deckId: '', view: 'all', prizeDone: false, hidden: false });
const getPrivatePlayerState = () => ({ deck: S.deck, hand: S.hand, discard: S.discard, prizes: S.prizes, deckId: S.deckId, view: S.view, prizeDone: S.prizeDone, hidden: handHidden() });
const getSharedBoardState = () => ({ placed: S.placed, markers: S.markers, nextPlaced: S.nextPlaced, nextMarker: S.nextMarker });
const getGameState = () => ({ ...getPrivatePlayerState(), ...getSharedBoardState() });
function normalizeRoomGameState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.shared && raw.players && typeof raw.players === 'object') {
    return {
      version: 2,
      shared: {
        placed: Array.isArray(raw.shared.placed) ? raw.shared.placed : [],
        markers: Array.isArray(raw.shared.markers) ? raw.shared.markers : [],
        nextPlaced: Number(raw.shared.nextPlaced) || 1,
        nextMarker: Number(raw.shared.nextMarker) || 1,
      },
      players: raw.players,
    };
  }
  if (Array.isArray(raw.deck) && Array.isArray(raw.hand)) {
    const legacyUid = MP.hostUid || currentCloudUser?.uid || 'legacy';
    return {
      version: 2,
      shared: {
        placed: Array.isArray(raw.placed) ? raw.placed : [],
        markers: Array.isArray(raw.markers) ? raw.markers : [],
        nextPlaced: Number(raw.nextPlaced) || 1,
        nextMarker: Number(raw.nextMarker) || 1,
      },
      players: {
        [legacyUid]: {
          deck: raw.deck,
          hand: raw.hand,
          discard: Array.isArray(raw.discard) ? raw.discard : [],
          prizes: Array.isArray(raw.prizes) ? raw.prizes : [],
          deckId: typeof raw.deckId === 'string' ? raw.deckId : '',
          view: typeof raw.view === 'string' ? raw.view : 'all',
          prizeDone: Boolean(raw.prizeDone),
          hidden: Boolean(raw.hidden),
        },
      },
    };
  }
  return null;
}
function buildRoomGameState() {
  const uid = currentCloudUser?.uid;
  if (!uid) return null;
  const previousPlayers = MP.roomGameState && typeof MP.roomGameState.players === 'object' ? MP.roomGameState.players : {};
  return {
    version: 2,
    shared: getSharedBoardState(),
    players: {
      ...previousPlayers,
      [uid]: getPrivatePlayerState(),
    },
  };
}
function applyStateSnapshot(state, { silent = false } = {}) {
  if (!state || !Array.isArray(state.deck) || !Array.isArray(state.hand) || !Array.isArray(state.discard) || !Array.isArray(state.placed) || !Array.isArray(state.markers)) return false;
  S.hydr = true;
  S.deck = state.deck;
  S.hand = state.hand;
  S.discard = state.discard;
  S.placed = state.placed;
  S.prizes = Array.isArray(state.prizes) ? state.prizes : [];
  S.markers = state.markers;
  S.nextPlaced = Number(state.nextPlaced) || 1;
  S.nextMarker = Number(state.nextMarker) || 1;
  S.deckId = typeof state.deckId === 'string' ? state.deckId : '';
  S.view = typeof state.view === 'string' ? state.view : 'all';
  S.prizeDone = Boolean(state.prizeDone);
  renderDeckOptions(S.deckId);
  syncStartDeckOptions();
  renderAll();
  setHand(Boolean(state.hidden));
  S.hydr = false;
  if (!silent) toast(gt('toast.restored'));
  return true;
}
function applyRoomStateSnapshot(roomState) {
  const normalized = normalizeRoomGameState(roomState);
  if (!normalized) return false;
  MP.roomGameState = normalized;
  const playerState = currentCloudUser?.uid ? normalized.players?.[currentCloudUser.uid] : null;
  const fallbackHidden = handHidden();
  S.hydr = true;
  S.placed = normalized.shared.placed;
  S.markers = normalized.shared.markers;
  S.nextPlaced = normalized.shared.nextPlaced;
  S.nextMarker = normalized.shared.nextMarker;
  if (playerState) {
    S.deck = Array.isArray(playerState.deck) ? playerState.deck : [];
    S.hand = Array.isArray(playerState.hand) ? playerState.hand : [];
    S.discard = Array.isArray(playerState.discard) ? playerState.discard : [];
    S.prizes = Array.isArray(playerState.prizes) ? playerState.prizes : [];
    S.deckId = typeof playerState.deckId === 'string' ? playerState.deckId : '';
    S.view = typeof playerState.view === 'string' ? playerState.view : 'all';
    S.prizeDone = Boolean(playerState.prizeDone);
  }
  renderDeckOptions(S.deckId);
  syncStartDeckOptions();
  renderAll();
  setHand(playerState ? Boolean(playerState.hidden) : fallbackHidden);
  S.hydr = false;
  return true;
}
function ownsSharedItem(item) {
  if (!MP.roomId) return true;
  if (!item || !item.ownerUid) return true;
  return item.ownerUid === currentUid();
}
function getRoomRole() {
  if (!MP.roomId) return 'solo';
  return currentCloudUser && currentCloudUser.uid === MP.hostUid ? 'host' : 'guest';
}
function updateMultiplayerUi() {
  const role = getRoomRole();
  const firebaseReady = Boolean(firebaseApi && firebaseApi.isFirebaseEnabled && firebaseApi.isFirebaseEnabled());
  const signedIn = Boolean(currentCloudUser);
  const labelKey = role === 'host' ? 'ui.multiHost' : role === 'guest' ? 'ui.multiGuest' : firebaseReady ? 'ui.multiSolo' : 'ui.multiOffline';
  if (e.roomStatusBadge) e.roomStatusBadge.textContent = gt(labelKey);
  if (e.roomIdInput) {
    e.roomIdInput.placeholder = gt('ui.roomPlaceholder');
    e.roomIdInput.disabled = !firebaseReady || !signedIn || Boolean(MP.roomId);
  }
  if (e.createRoomBtn) e.createRoomBtn.disabled = !firebaseReady || !signedIn || Boolean(MP.roomId);
  if (e.joinRoomBtn) e.joinRoomBtn.disabled = !firebaseReady || !signedIn || Boolean(MP.roomId);
  if (e.leaveRoomBtn) e.leaveRoomBtn.hidden = !MP.roomId;
  if (e.roomCodeLabel) e.roomCodeLabel.textContent = MP.roomId ? `${gt('ui.roomCode')}: ${MP.roomId}` : '';
  if (e.roomHelpText) {
    if (!firebaseReady) e.roomHelpText.textContent = gt('ui.multiHelp');
    else if (!signedIn) e.roomHelpText.textContent = gt('toast.multiNeedAuth');
    else if (MP.roomId) e.roomHelpText.textContent = `${gt(MP.hostUid ? 'ui.multiConnected' : 'ui.multiWaiting')} • ${uidShort(MP.hostUid || currentCloudUser.uid)}`;
    else e.roomHelpText.textContent = gt('ui.multiHelp');
  }
  if (e.roomLiveBadge) {
    e.roomLiveBadge.hidden = !MP.roomId;
    e.roomLiveBadge.textContent = MP.roomId ? `${gt(labelKey)} • ${gt('ui.roomCode')}: ${MP.roomId}` : '';
  }
}
const saveNow = () => {
  if (S.hydr) return;
  const state = getGameState();
  localStorage.setItem(K.save, JSON.stringify(state));
  if (currentCloudUser && firebaseApi) {
    firebaseApi.saveUserData(currentCloudUser.uid, { gameState: state }).catch(() => {});
  }
  if (MP.roomId && currentCloudUser && firebaseApi && !MP.applyingRemote) {
    const roomGameState = buildRoomGameState();
    if (!roomGameState) return;
    MP.roomGameState = roomGameState;
    MP.actionId = newActionId();
    firebaseApi.updateRoom(MP.roomId, {
      gameState: roomGameState,
      deckId: S.deckId,
      lang: LANG,
      hostUid: MP.hostUid || currentCloudUser.uid,
      lastActionBy: currentCloudUser.uid,
      lastActionId: MP.actionId,
      status: 'active',
    }).catch(() => {});
  }
};
const saveSoon = () => { if (S.hydr) return; clearTimeout(S.saveT); S.saveT = setTimeout(saveNow, 100) };
const toast = t => { e.toast.textContent = t; e.toast.hidden = false; clearTimeout(S.toastT); S.toastT = setTimeout(() => e.toast.hidden = true, 1200) };
const imgUrl = c => { if (!c || !c.image) return null; if (typeof c.image === 'string') { if (c.image.startsWith('data:') || c.image.startsWith('blob:')) return c.image; if (/\.(webp|png|jpg|jpeg)$/i.test(c.image)) return c.image; return c.image + '/high.webp' } return c.image.high || c.image.low || c.image.small || null };
const cardFace = (c, cls) => {
  const a = document.createElement('article');
  a.className = cls;
  if (c?.faceDown) {
    const back = document.createElement('div');
    back.className = 'card-facedown';
    a.appendChild(back);
    return a;
  }
  const u = imgUrl(c);
  if (u) {
    const i = document.createElement('img');
    i.className = 'card-image';
    i.src = u;
    i.alt = c.name || 'Carte';
    i.draggable = false;
    i.loading = 'lazy';
    i.addEventListener('dragstart', ev => ev.preventDefault());
    a.appendChild(i);
  } else {
    const f = document.createElement('div');
    f.className = 'card-fallback';
    f.textContent = 'Carte';
    a.appendChild(f);
  }
  return a;
};
const actionBtn = (cls, t, k, v) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = t; b.dataset[k] = v; return b };
const gt = key => (gameI18n[LANG] && gameI18n[LANG][key]) || (gameI18n.fr && gameI18n.fr[key]) || key;
function applyGameTranslations() {
  document.querySelectorAll('[data-i18n-game]').forEach(el => {
    const key = el.getAttribute('data-i18n-game');
    if (!key) return;
    el.textContent = gt(key);
  });
  if (e.offlineBtn) e.offlineBtn.textContent = offlineReady ? gt('ui.offlineReady') : gt('ui.offlineMode');
  updFS();
  updHandUI();
  updateMultiplayerUi();
}

function renderDeckOptions(pref = '') { e.deckSel.innerHTML = ''; const o0 = document.createElement('option'); o0.value = ''; o0.textContent = gt('ui.deckAuto'); e.deckSel.appendChild(o0); let arr = []; try { arr = JSON.parse(localStorage.getItem(K.decks) || '[]') } catch { }; if (!Array.isArray(arr)) arr = []; arr.forEach(d => { const c = Array.isArray(d.cards) ? d.cards.length : 0; const o = document.createElement('option'); o.value = d.id || ''; o.textContent = `${d.name || 'Deck'} (${c}/60)`; o.disabled = c !== 60; e.deckSel.appendChild(o) }); if (pref && [...e.deckSel.options].some(o => o.value === pref && !o.disabled)) { e.deckSel.value = pref; S.deckId = pref } else { e.deckSel.value = ''; S.deckId = '' } }
function resolveLanguage() { const q = new URLSearchParams(location.search); const fromQuery = (q.get('lang') || '').toLowerCase(); if (SUPPORTED_LANGS.has(fromQuery)) { localStorage.setItem(K.lang, fromQuery); return fromQuery } const fromStorage = (localStorage.getItem(K.lang) || '').toLowerCase(); if (SUPPORTED_LANGS.has(fromStorage)) return fromStorage; return 'fr' }
function syncStartDeckOptions() { e.startDeckSel.innerHTML = ''; [...e.deckSel.options].forEach(src => { const o = document.createElement('option'); o.value = src.value; o.textContent = src.textContent; o.disabled = src.disabled; e.startDeckSel.appendChild(o) }); e.startDeckSel.value = e.deckSel.value || '' }
const hasSavedGame = () => { try { const st = JSON.parse(localStorage.getItem(K.save) || 'null'); return Boolean(st && Array.isArray(st.deck) && Array.isArray(st.hand) && Array.isArray(st.discard) && Array.isArray(st.placed) && Array.isArray(st.markers)) } catch { return false } };
const showStartScreen = () => { document.body.classList.add('pregame'); e.startScreen.hidden = false; e.resumeBtn.hidden = !hasSavedGame() };
const hideStartScreen = () => { document.body.classList.remove('pregame'); e.startScreen.hidden = true };
async function enterFullscreen() { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen() } catch { } updFS(); return Boolean(document.fullscreenElement) }
function updFS() { if (document.fullscreenElement) { document.body.classList.add('fullscreen-mode'); e.fs.textContent = gt('ui.exitFullscreen') } else { document.body.classList.remove('fullscreen-mode'); e.fs.textContent = gt('ui.fullscreen') } }
function relayout() { applyGridVars(); renderBoard(); sizeHand() }
function onFullscreenChange() { updFS(); if (!document.fullscreenElement) showStartScreen(); requestAnimationFrame(() => relayout()); setTimeout(() => relayout(), 120) }
function updHandUI() { const h = handHidden(); e.handT.textContent = h ? gt('ui.showHand') : gt('ui.hideHand'); e.showHand.hidden = !h }
function setHand(h) { document.body.classList.toggle('hand-hidden', h); updHandUI(); if (!h) requestAnimationFrame(sizeHand); saveSoon() }
function sizeHand() { const w = e.handCards.clientWidth || 400; const cw = Math.max(82, Math.min(126, Math.floor(w * 0.145))); e.handCards.style.setProperty('--hand-card-width', `${cw}px`) }
function gridMetrics() { const r = e.board.getBoundingClientRect(); const cell = Math.min(r.width / GRID.cols, r.height / GRID.rows); const gridW = cell * GRID.cols; const gridH = cell * GRID.rows; const offX = (r.width - gridW) / 2; const offY = (r.height - gridH) / 2; const cardRows = Math.round(GRID.cardCols * 7 / 5); const cardW = cell * GRID.cardCols; const cardH = cell * cardRows; return { r, cell, gridW, gridH, offX, offY, cardRows, cardW, cardH } }
function applyGridVars() { const m = gridMetrics(); e.board.style.setProperty('--grid-cols', String(GRID.cols)); e.board.style.setProperty('--grid-rows', String(GRID.rows)); e.board.style.setProperty('--grid-cell', `${m.cell}px`); e.board.style.setProperty('--grid-offset-x', `${m.offX}px`); e.board.style.setProperty('--grid-offset-y', `${m.offY}px`); e.board.style.setProperty('--grid-card-width', `${m.cardW}px`) }
function boardCellToPixel(pos, metrics = gridMetrics()) {
  if (typeof pos?.gx === 'number' && typeof pos?.gy === 'number') {
    return { x: metrics.offX + pos.gx * metrics.cell, y: metrics.offY + pos.gy * metrics.cell };
  }
  return { x: Number(pos?.x) || 0, y: Number(pos?.y) || 0 };
}
function markerLayerMetrics() {
  const rect = e.markers.getBoundingClientRect();
  return { rect, width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}
function markerPointToRelative(x, y) {
  const m = markerLayerMetrics();
  const rx = Math.max(0, Math.min(1, (x - m.rect.left) / m.width));
  const ry = Math.max(0, Math.min(1, (y - m.rect.top) / m.height));
  return { rx, ry };
}
function markerRelativeToPixel(marker) {
  const m = markerLayerMetrics();
  if (typeof marker?.rx === 'number' && typeof marker?.ry === 'number') {
    return { x: marker.rx * m.width, y: marker.ry * m.height };
  }
  return { x: Number(marker?.x) || 0, y: Number(marker?.y) || 0 };
}
function boardPointToCell(x, y) {
  const m = gridMetrics();
  const localX = x - m.r.left - m.cardW / 2;
  const localY = y - m.r.top - m.cardH / 2;
  const gx = Math.round((localX - m.offX) / m.cell);
  const gy = Math.round((localY - m.offY) / m.cell);
  return { gx, gy };
}
function counters() {
  e.deckCount.textContent = String(S.deck.length);
  e.discardCount.textContent = String(S.discard.length);
  e.draw.disabled = S.deck.length === 0;
  e.draw.textContent = S.deck.length === 0 ? gt('ui.deckEmpty') : gt('ui.draw');
  if (e.setupPrizes) e.setupPrizes.disabled = S.prizeDone || S.deck.length < 6;
  if (e.prizeDraw) {
    e.prizeDraw.disabled = S.prizes.length === 0;
    e.prizeDraw.textContent = `${gt('ui.drawPrize')} (${S.prizes.length})`;
  }
  saveSoon();
}
function renderHand() { e.handCards.innerHTML = ''; S.hand.forEach(c => { const el = cardFace(c, 'hand-card'); el.dataset.cardId = c.id; e.handCards.appendChild(el) }); sizeHand(); saveSoon() }
function renderBoard() { const m = gridMetrics(); const maxPlacedId = S.placed.reduce((mx, p) => Math.max(mx, Number(p.id) || 0), 0); e.board.style.setProperty('--grid-card-width', `${m.cardW}px`); e.board.innerHTML = ''; S.snap = null; S.placed.forEach(p => { const el = cardFace(p.card, 'placed-card board-card'); const coords = boardCellToPixel(p, m); el.dataset.placedId = String(p.id); el.classList.toggle('locked-shared-item', !ownsSharedItem(p)); el.style.left = `${coords.x}px`; el.style.top = `${coords.y}px`; el.style.width = `${m.cardW}px`; const ageOrder = maxPlacedId - (Number(p.id) || 0); el.style.zIndex = String(layerRank(p.card) * 100000 + ageOrder); e.board.appendChild(el) }); saveSoon() }
function renderDiscardTop() { e.discardTop.innerHTML = ''; const c = S.discard[S.discard.length - 1]; if (c) e.discardTop.appendChild(cardFace(c, 'placed-card')); saveSoon() }
function renderMarkers() { e.markers.innerHTML = ''; S.markers.forEach(m => { const d = mTypes[m.type] || ['?', '']; const p = markerRelativeToPixel(m); const b = document.createElement('button'); b.type = 'button'; b.className = `marker-item ${d[1]}`; b.textContent = d[0]; b.dataset.markerId = String(m.id); b.classList.toggle('locked-shared-item', !ownsSharedItem(m)); b.style.left = `${p.x}px`; b.style.top = `${p.y}px`; e.markers.appendChild(b) }); saveSoon() }
function renderAll() { renderHand(); renderBoard(); renderDiscardTop(); renderMarkers(); counters(); }

function fakeDeck() { const a = []; for (let i = 0; i < 60; i++)a.push({ id: `F-${i + 1}`, name: `${names[rnd(names.length)]} ${rnd(100)}`, kind: 'pokemon' }); sh(a); return a }
function fromSaved(cards) { return cards.map((c, i) => ({ id: `${c.id || 'S'}#${i + 1}`, name: c.name || `Carte ${i + 1}`, kind: inferKind(c), category: c.category || '', image: c.image || null })) }
async function apiDeck() {
  const cat = CATEGORY_BY_LANG[LANG] || CATEGORY_BY_LANG.fr;
  const fetchPool = async (category, kind) => {
    const q = new URLSearchParams({ regulationMark: REG.join(','), category });
    const r = await fetch(`https://api.tcgdex.net/v2/${LANG}/cards?${q.toString()}`);
    if (!r.ok) throw new Error('api');
    const arr = await r.json();
    return (Array.isArray(arr) ? arr : []).map((c, i) => ({ id: c.id || `A-${kind}-${i + 1}`, name: c.name || `Carte ${i + 1}`, kind, category, image: c.image || null }));
  };
  const [pPool, tPool, ePool] = await Promise.all([fetchPool(cat.pokemon, 'pokemon'), fetchPool(cat.trainer, 'trainer'), fetchPool(cat.energy, 'energy')]);
  if (!pPool.length && !tPool.length && !ePool.length) throw new Error('empty');
  sh(pPool); sh(tPool); sh(ePool);
  const deck = [...pPool.slice(0, 36), ...tPool.slice(0, 14), ...ePool.slice(0, 10)];
  sh(deck);
  if (deck.length >= 60) return deck.slice(0, 60);
  const refill = [...pPool, ...tPool, ...ePool];
  if (!refill.length) throw new Error('empty');
  return Array.from({ length: 60 }, (_, i) => ({ ...refill[i % refill.length], id: `${refill[i % refill.length].id}-X${i + 1}` }));
}
function savedCards(id) { if (!id) return null; let arr = []; try { arr = JSON.parse(localStorage.getItem(K.decks) || '[]') } catch { }; if (!Array.isArray(arr)) return null; const d = arr.find(x => x.id === id); return d && Array.isArray(d.cards) ? d.cards : null }
async function newGame(id = '', options = {}) {
  const resetShared = options.resetShared ?? !MP.roomId;
  const shared = resetShared
    ? { placed: [], markers: [], nextPlaced: 1, nextMarker: 1 }
    : { placed: S.placed, markers: S.markers, nextPlaced: S.nextPlaced, nextMarker: S.nextMarker };
  S.hydr = true;
  S = { ...S, deck: [], hand: [], discard: [], placed: shared.placed, prizes: [], markers: shared.markers, nextPlaced: shared.nextPlaced, nextMarker: shared.nextMarker, deckId: id || '', view: 'all', prizeDone: false, drag: null, mDrag: null, ghost: null, mGhost: null, hideEl: null, blockDis: 0 };
  const sv = savedCards(S.deckId);
  if (Array.isArray(sv) && sv.length === 60) {
    localStorage.setItem(K.active, S.deckId);
    S.deck = fromSaved(sv);
    sh(S.deck);
    renderAll();
    S.hydr = false;
    saveNow();
    toast(gt('toast.deckLoaded'));
    return;
  }
  localStorage.removeItem(K.active);
  toast(gt('toast.loadingCards'));
  try {
    S.deck = await apiDeck();
  } catch {
    S.deck = fakeDeck();
    toast(gt('toast.apiFallback'));
  }
  renderAll();
  S.hydr = false;
  saveNow();
}
function restore() { let st = null; try { st = JSON.parse(localStorage.getItem(K.save) || 'null') } catch { }; return applyStateSnapshot(st) }
function init() { LANG = resolveLanguage(); document.documentElement.lang = LANG; applyGameTranslations(); const q = new URLSearchParams(location.search); renderDeckOptions(q.get('deck') || localStorage.getItem(K.active) || ''); syncStartDeckOptions(); showStartScreen() }

function getOfflineGameImageUrls() {
  const collect = [];
  collect.push(...S.deck, ...S.hand, ...S.discard, ...S.prizes, ...S.placed.map(p => p.card));
  return collect.map(c => imgUrl(c)).filter(Boolean);
}

async function initOfflineSupport() {
  if (!e.offlineBtn) return;
  const reg = await registerOfflineServiceWorker();
  if (reg) {
    offlineReady = true;
    e.offlineBtn.textContent = gt('ui.offlineReady');
  }
  e.offlineBtn.addEventListener('click', async () => {
    e.offlineBtn.disabled = true;
    e.offlineBtn.textContent = gt('ui.offlineCaching');
    const res = await cacheOfflinePack(getOfflineGameImageUrls());
    if (res.ok) {
      offlineReady = true;
      e.offlineBtn.textContent = gt('ui.offlineReady');
      toast(gt('toast.offlineReady'));
    } else {
      e.offlineBtn.textContent = gt('ui.offlineMode');
      toast(gt('toast.offlineFailed'));
    }
    setTimeout(() => { e.offlineBtn.disabled = false; e.offlineBtn.textContent = offlineReady ? gt('ui.offlineReady') : gt('ui.offlineMode') }, 1200);
  });
}
function detachRoomSubscription() {
  if (typeof MP.unsub === 'function') MP.unsub();
  MP.unsub = null;
}
async function leaveCurrentRoom({ silent = false } = {}) {
  if (!MP.roomId) return;
  const roomId = MP.roomId;
  detachRoomSubscription();
  MP.roomId = '';
  MP.hostUid = '';
  MP.actionId = '';
  MP.lastRemoteActionId = '';
  MP.roomGameState = null;
  if (firebaseApi && currentCloudUser) {
    await firebaseApi.leaveRoom(roomId, currentCloudUser).catch(() => {});
  }
  updateMultiplayerUi();
  if (!silent) toast(gt('toast.multiRoomLeft'));
}
function subscribeToRoom(roomId) {
  detachRoomSubscription();
  MP.unsub = firebaseApi.subscribeRoom(roomId, room => {
    if (!room) {
      leaveCurrentRoom({ silent: true }).catch(() => {});
      return;
    }
    MP.roomId = room.id || room.roomId || roomId;
    MP.hostUid = room.hostUid || '';
    MP.lastRemoteActionId = room.lastActionId || '';
    MP.roomGameState = normalizeRoomGameState(room.gameState);
    if (room.lang && SUPPORTED_LANGS.has(room.lang) && room.lang !== LANG) {
      LANG = room.lang;
      localStorage.setItem(K.lang, LANG);
      applyGameTranslations();
    } else {
      updateMultiplayerUi();
    }
    if (MP.roomGameState && room.lastActionId !== MP.actionId) {
      MP.applyingRemote = true;
      const ownPrivate = currentCloudUser?.uid ? MP.roomGameState.players?.[currentCloudUser.uid] : null;
      if (ownPrivate) {
        localStorage.setItem(K.save, JSON.stringify({ ...ownPrivate, ...MP.roomGameState.shared }));
      }
      applyRoomStateSnapshot(MP.roomGameState);
      MP.applyingRemote = false;
    }
  });
}
async function createRoom() {
  if (!firebaseApi || !currentCloudUser) {
    toast(gt('toast.multiNeedAuth'));
    return;
  }
  const basePrivateState = hasSavedGame() ? JSON.parse(localStorage.getItem(K.save) || 'null') : getGameState();
  const gameState = {
    version: 2,
    shared: getSharedBoardState(),
    players: {
      [currentCloudUser.uid]: {
        ...emptyPrivateState(),
        ...(basePrivateState && typeof basePrivateState === 'object' ? {
          deck: Array.isArray(basePrivateState.deck) ? basePrivateState.deck : [],
          hand: Array.isArray(basePrivateState.hand) ? basePrivateState.hand : [],
          discard: Array.isArray(basePrivateState.discard) ? basePrivateState.discard : [],
          prizes: Array.isArray(basePrivateState.prizes) ? basePrivateState.prizes : [],
          deckId: typeof basePrivateState.deckId === 'string' ? basePrivateState.deckId : '',
          view: typeof basePrivateState.view === 'string' ? basePrivateState.view : 'all',
          prizeDone: Boolean(basePrivateState.prizeDone),
          hidden: Boolean(basePrivateState.hidden),
        } : {}),
      },
    },
  };
  const roomId = await firebaseApi.createRoom(currentCloudUser, { gameState, deckId: S.deckId || '', lang: LANG, actionId: newActionId() });
  MP.roomId = roomId;
  MP.hostUid = currentCloudUser.uid;
  MP.actionId = '';
  MP.roomGameState = gameState;
  subscribeToRoom(roomId);
  updateMultiplayerUi();
  if (e.roomIdInput) e.roomIdInput.value = roomId;
  toast(gt('toast.multiRoomCreated'));
}
async function joinRoom() {
  if (!firebaseApi || !currentCloudUser) {
    toast(gt('toast.multiNeedAuth'));
    return;
  }
  const roomId = String(e.roomIdInput?.value || '').trim().toUpperCase();
  if (!roomId) return;
  try {
    const joinedId = await firebaseApi.joinRoom(roomId, currentCloudUser);
    MP.roomId = joinedId;
    MP.hostUid = '';
    MP.actionId = '';
    subscribeToRoom(joinedId);
    updateMultiplayerUi();
    toast(gt('toast.multiRoomJoined'));
  } catch {
    toast(gt('toast.multiRoomMissing'));
  }
}
function dHint(t, x, y) { if (!t) { e.hint.hidden = true; return } e.hint.textContent = t; e.hint.hidden = false; const r = e.hint.getBoundingClientRect(); let l = x + 34, tp = y - r.height / 2; if (l + r.width > innerWidth - 10) l = x - r.width - 34; if (l < 10) l = 10; if (tp < 10) tp = 10; if (tp + r.height > innerHeight - 10) tp = innerHeight - r.height - 10; e.hint.style.left = `${l}px`; e.hint.style.top = `${tp}px`; e.hint.style.transform = 'none' }
function ghost(c) { const g = cardFace(c, 'drag-ghost hand-card'); g.style.pointerEvents = 'none'; document.body.appendChild(g); return g }
function boardPt(x, y) { const cell = boardPointToCell(x, y); return boardCellToPixel(cell) }
function ensureSnap() { if (S.snap) return S.snap; const d = document.createElement('div'); d.className = 'board-snap-preview'; d.hidden = true; e.board.appendChild(d); S.snap = d; return d }
function showSnap(x, y) { const d = ensureSnap(); const p = boardPointToCell(x, y); const pixel = boardCellToPixel(p); S.snapPos = p; d.style.left = `${pixel.x}px`; d.style.top = `${pixel.y}px`; d.hidden = false }
function hideSnap() { S.snapPos = null; if (S.snap) S.snap.hidden = true }
function dropSnap(x, y) { return S.snapPos || boardPointToCell(x, y) }
function overDis(x, y) { return inR(x, y, e.discardZone.getBoundingClientRect()) }
function overDeck(x, y) { return inR(x, y, e.deckZone.getBoundingClientRect()) }
function overBoard(x, y) { return inR(x, y, e.board.getBoundingClientRect()) }
function overHand(x, y) { if (!e.showHand.hidden) return inR(x, y, e.showHand.getBoundingClientRect()); const hr = document.querySelector('.hand-row'); return inR(x, y, hr.getBoundingClientRect()) }
function clearHi() { e.discardZone.classList.remove('drop-highlight'); e.deckZone.classList.remove('drop-highlight'); e.showHand.classList.remove('drop-highlight'); e.hint.hidden = true; hideSnap() }
function startDrag(s) {
  s.drag = true;
  if (s.src === 'hand' && !handHidden()) setHand(true);
  s.ghost = ghost(s.card);
  if (s.el) s.el.classList.add('drag-source');
}
function moveDrag(x, y) { if (!S.drag || !S.drag.ghost) return; S.drag.ghost.style.transform = `translate(${x - 35}px, ${y - 49}px)`; const od = overDis(x, y), ok = overDeck(x, y), om = overBoard(x, y), oh = S.drag.src === 'board' && overHand(x, y); e.discardZone.classList.toggle('drop-highlight', od); e.deckZone.classList.toggle('drop-highlight', ok); e.showHand.classList.toggle('drop-highlight', oh && !e.showHand.hidden); if (om && !ok) showSnap(x, y); else hideSnap(); if (od) dHint(gt('hint.toDiscard'), x, y); else if (ok) dHint(gt('hint.toDeck'), x, y); else if (oh) dHint(gt('hint.toHand'), x, y); else if (om) dHint(S.drag.src === 'hand' ? gt('hint.placeMat') : gt('hint.moveMat'), x, y); else dHint('', x, y) }
function endDrag(ev) { if (!S.drag) return; const d = S.drag; let sharedChanged = false; if (d.drag) { const od = overDis(ev.clientX, ev.clientY), ok = overDeck(ev.clientX, ev.clientY), om = overBoard(ev.clientX, ev.clientY), oh = d.src === 'board' && overHand(ev.clientX, ev.clientY); if (d.src === 'hand') { const i = S.hand.findIndex(c => c.id === d.cardId); if (i >= 0) { const [c] = S.hand.splice(i, 1); if (od) { S.discard.push(c); renderDiscardTop(); counters() } else if (ok) { S.deck.unshift(c); counters(); if (!e.deckModal.hidden) renderDeckList() } else if (om) { const p = dropSnap(ev.clientX, ev.clientY); S.placed.push({ id: S.nextPlaced++, card: c, gx: p.gx, gy: p.gy, ownerUid: currentUid() || undefined }); renderBoard(); counters(); sharedChanged = true } else S.hand.splice(i, 0, c); renderHand() } S.blockDis = Date.now() + 180 } else { const i = S.placed.findIndex(p => p.id === d.placedId); if (i >= 0) { const item = S.placed[i]; const c = item.card; if (od) { S.placed.splice(i, 1); S.discard.push(revealCard(c)); renderBoard(); renderDiscardTop(); counters(); S.blockDis = Date.now() + 180; sharedChanged = true } else if (ok) { S.placed.splice(i, 1); S.deck.unshift(c); renderBoard(); counters(); if (!e.deckModal.hidden) renderDeckList(); sharedChanged = true } else if (oh) { S.placed.splice(i, 1); S.hand.push(revealCard(c)); renderBoard(); renderHand(); counters(); sharedChanged = true } else if (om) { const p = dropSnap(ev.clientX, ev.clientY); item.gx = p.gx; item.gy = p.gy; delete item.x; delete item.y; renderBoard(); sharedChanged = true } } } } else openCard(d.card); if (sharedChanged) saveNow(); if (d.el) d.el.classList.remove('drag-source'); if (d.ghost) d.ghost.remove(); clearHi(); S.drag = null; removeEventListener('pointermove', onMove); removeEventListener('pointerup', endDrag); removeEventListener('pointercancel', endDrag) }
function onMove(ev) { if (!S.drag) return; const ds = Math.hypot(ev.clientX - S.drag.sx, ev.clientY - S.drag.sy); if (!S.drag.drag && ds > 8) startDrag(S.drag); if (S.drag.drag) moveDrag(ev.clientX, ev.clientY) }
function handDown(ev) { const t = ev.target; if (!(t instanceof HTMLElement) || ((ev.pointerType !== 'touch') && ev.button !== 0)) return; const c = t.closest('.hand-card'); if (!(c instanceof HTMLElement)) return; const id = c.dataset.cardId || ''; const card = S.hand.find(x => x.id === id); if (!card) return; S.drag = { src: 'hand', cardId: id, placedId: null, card, el: c, sx: ev.clientX, sy: ev.clientY, drag: false, ghost: null }; addEventListener('pointermove', onMove); addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag) }
function boardDown(ev) { const t = ev.target; if (!(t instanceof HTMLElement) || ((ev.pointerType !== 'touch') && ev.button !== 0)) return; const c = t.closest('.board-card'); if (!(c instanceof HTMLElement)) return; const id = Number(c.dataset.placedId || '-1'); const p = S.placed.find(x => x.id === id); if (!p) return; if (!ownsSharedItem(p)) { toast(gt('toast.multiLockedObject')); return; } S.drag = { src: 'board', cardId: p.card.id, placedId: id, card: p.card, el: c, sx: ev.clientX, sy: ev.clientY, drag: false, ghost: null }; addEventListener('pointermove', onMove); addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag) }
function openCard(c) { e.cardContent.innerHTML = ''; e.cardContent.appendChild(cardFace(c, 'hand-card modal-card')); e.cardModal.hidden = false }
function closeCard() { e.cardModal.hidden = true }
function renderDisList() { e.disList.innerHTML = ''; if (!S.discard.length) { const p = document.createElement('p'); p.className = 'discard-list-empty'; p.textContent = gt('ui.emptyDiscard'); e.disList.appendChild(p); return } for (let i = S.discard.length - 1; i >= 0; i--) { const c = S.discard[i], el = cardFace(c, 'hand-card discard-list-card'); el.dataset.discardTakeBackId = c.id; el.appendChild(actionBtn('discard-item-btn', gt('ui.retrieve'), 'discardTakeBackId', c.id)); e.disList.appendChild(el) } }
function openDis() { renderDisList(); e.disModal.hidden = false }
function closeDis() { e.disModal.hidden = true }
function renderDeckList() { e.deckList.innerHTML = ''; if (!S.deck.length) { const p = document.createElement('p'); p.className = 'discard-list-empty'; p.textContent = gt('ui.emptyDeck'); e.deckList.appendChild(p); return } [...S.deck].reverse().forEach(c => { const el = cardFace(c, 'hand-card deck-list-card'); el.dataset.deckTakeId = c.id; el.appendChild(actionBtn('deck-item-btn', gt('ui.retrieve'), 'deckTakeId', c.id)); e.deckList.appendChild(el) }) }
function revealCard(c) { if (c && c.faceDown) { c.faceDown = false; c.isPrize = false } return c }
function setupPrizes() {
  if (S.prizeDone || S.deck.length < 6) {
    toast(gt('toast.prizesUnavailable'));
    return;
  }
  S.prizes = [];
  for (let i = 0; i < 6; i += 1) {
    const card = S.deck.pop();
    if (!card) break;
    card.faceDown = true;
    card.isPrize = true;
    S.prizes.push(card);
  }
  S.prizeDone = true;
  counters();
  if (!e.deckModal.hidden) renderDeckList();
  toast(gt('toast.prizesPlaced'));
}
function drawPrize() {
  if (!S.prizes.length) {
    toast(gt('toast.noPrizeLeft'));
    return;
  }
  const card = revealCard(S.prizes.pop());
  S.hand.push(card);
  renderHand();
  counters();
}
function draw() { if (!S.deck.length) return; S.hand.push(revealCard(S.deck.pop())); counters(); renderHand(); if (!e.deckModal.hidden) renderDeckList() }
function takeDis(id) { const i = S.discard.findIndex(c => c.id === id); if (i < 0) return; const [c] = S.discard.splice(i, 1); S.hand.push(revealCard(c)); renderHand(); renderDiscardTop(); counters(); renderDisList() }
function takeDeck(id) { const i = S.deck.findIndex(c => c.id === id); if (i < 0) return; const [c] = S.deck.splice(i, 1); S.hand.push(revealCard(c)); renderHand(); counters(); renderDeckList() }
function mix() { if (S.deck.length <= 1) { toast(gt('toast.noShuffle')); return } sh(S.deck); counters(); if (!e.deckModal.hidden) renderDeckList(); toast(gt('toast.shuffled')) }
function askCloseDeckWithShufflePrompt() { if (e.deckModal.hidden) return; e.deckClosePrompt.hidden = false }
function closeDeckAndPrompt() { e.deckClosePrompt.hidden = true; e.deckModal.hidden = true }

function mGhost(type) { const d = mTypes[type] || ['?', '']; const g = document.createElement('div'); g.className = `marker-drag-ghost ${d[1]}`; g.textContent = d[0]; document.body.appendChild(g); return g }
function mMove(x, y) { if (!S.mGhost) return; S.mGhost.style.transform = `translate(${x - 16}px, ${y - 16}px)` }
function mStop() { e.bag.classList.remove('drop-highlight', 'delete-ready'); e.bag.textContent = '??'; if (S.hideEl) S.hideEl.classList.remove('drag-hidden'); if (S.mGhost) S.mGhost.remove(); S.mGhost = null; S.hideEl = null; S.mDrag = null; removeEventListener('pointermove', mOnMove); removeEventListener('pointerup', mUp); removeEventListener('pointercancel', mUp) }
function mFinish(x, y) { if (!S.mDrag) return; let sharedChanged = false; const ob = inR(x, y, e.bag.getBoundingClientRect()), op = inR(x, y, e.playmat.getBoundingClientRect()); if (S.mDrag.src === 'catalog' && op) { const p = markerPointToRelative(x, y); S.markers.push({ id: S.nextMarker++, type: S.mDrag.type, rx: p.rx, ry: p.ry, ownerUid: currentUid() || undefined }); renderMarkers(); sharedChanged = true } if (S.mDrag.src === 'board') { const i = S.markers.findIndex(m => m.id === S.mDrag.id); if (i >= 0) { if (ob) { S.markers.splice(i, 1); sharedChanged = true } else if (op) { const p = markerPointToRelative(x, y); S.markers[i].rx = p.rx; S.markers[i].ry = p.ry; delete S.markers[i].x; delete S.markers[i].y; sharedChanged = true } renderMarkers() } } if (sharedChanged) saveNow() }
function mOnMove(ev) { if (!S.mDrag) return; mMove(ev.clientX, ev.clientY); const ob = inR(ev.clientX, ev.clientY, e.bag.getBoundingClientRect()), del = ob && S.mDrag.src === 'board'; e.bag.classList.toggle('drop-highlight', ob); e.bag.classList.toggle('delete-ready', del); e.bag.textContent = del ? 'X' : '??' }
function mUp(ev) { if (!S.mDrag) return; mFinish(ev.clientX, ev.clientY); mStop() }
function mStart(type, src, id, ev, el) { S.mDrag = { type, src, id }; if (src === 'board' && el) { S.hideEl = el; S.hideEl.classList.add('drag-hidden') } S.mGhost = mGhost(type); mMove(ev.clientX, ev.clientY); addEventListener('pointermove', mOnMove); addEventListener('pointerup', mUp); addEventListener('pointercancel', mUp) }

e.fs.addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch { } updFS() });
e.deckSel.addEventListener('change', () => { S.deckId = e.deckSel.value || ''; if (e.startDeckSel.value !== e.deckSel.value) e.startDeckSel.value = e.deckSel.value });
e.startDeckSel.addEventListener('change', () => { S.deckId = e.startDeckSel.value || ''; e.deckSel.value = S.deckId });
if (e.roomIdInput) e.roomIdInput.addEventListener('input', () => { e.roomIdInput.value = e.roomIdInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) });
if (e.createRoomBtn) e.createRoomBtn.addEventListener('click', () => { createRoom().catch(() => toast(gt('toast.multiNeedAuth'))) });
if (e.joinRoomBtn) e.joinRoomBtn.addEventListener('click', () => { joinRoom().catch(() => toast(gt('toast.multiRoomMissing'))) });
if (e.leaveRoomBtn) e.leaveRoomBtn.addEventListener('click', () => { leaveCurrentRoom().catch(() => {}) });
e.startBtn.addEventListener('click', async () => { const fsOk = await enterFullscreen(); if (!fsOk) { toast(gt('toast.fsRequired')); showStartScreen(); return } S.deckId = e.startDeckSel.value || ''; e.deckSel.value = S.deckId; localStorage.removeItem(K.save); await newGame(S.deckId); hideStartScreen() });
e.resumeBtn.addEventListener('click', async () => { const fsOk = await enterFullscreen(); if (!fsOk) { toast(gt('toast.fsRequired')); showStartScreen(); return } const ok = restore(); if (!ok) { toast(gt('toast.noSaved')); showStartScreen(); return } hideStartScreen() });
e.loadDeck.addEventListener('click', async () => { S.deckId = e.deckSel.value || ''; localStorage.removeItem(K.save); await newGame(S.deckId) });
e.reset.addEventListener('click', async () => { S.deckId = e.deckSel.value || ''; localStorage.removeItem(K.save); await newGame(S.deckId); toast(gt('toast.reset')) });
e.handT.addEventListener('click', () => setHand(!handHidden()));
e.showHand.addEventListener('click', () => setHand(false));
e.draw.addEventListener('click', ev => { ev.stopPropagation(); draw(); e.deckActions.hidden = true });
e.setupPrizes.addEventListener('click', ev => { ev.stopPropagation(); setupPrizes(); e.deckActions.hidden = true });
e.prizeDraw.addEventListener('click', ev => { ev.stopPropagation(); drawPrize() });
e.viewDeck.addEventListener('click', ev => { ev.stopPropagation(); e.deckActions.hidden = true; renderDeckList(); e.deckModal.hidden = false });
e.shuffle.addEventListener('click', ev => { ev.stopPropagation(); mix(); e.deckActions.hidden = true });
e.deckMenu.addEventListener('click', ev => { ev.stopPropagation(); e.deckActions.hidden = false }); e.deckZone.addEventListener('click', () => e.deckActions.hidden = false);
e.handCards.addEventListener('pointerdown', handDown); e.board.addEventListener('pointerdown', boardDown);
e.closeCard.addEventListener('click', closeCard); e.cardModal.addEventListener('click', ev => { const t = ev.target; if (t instanceof HTMLElement && t.dataset.closeModal === 'true') closeCard() });
e.closeDis.addEventListener('click', closeDis); e.disModal.addEventListener('click', ev => { const t = ev.target; if (!(t instanceof HTMLElement)) return; if (t.dataset.closeDiscardModal === 'true') { closeDis(); return } const b = t.closest('.discard-item-btn'); if (b instanceof HTMLElement) { takeDis(b.dataset.discardTakeBackId || ''); return } const c = t.closest('.discard-list-card'); if (c instanceof HTMLElement) { const card = S.discard.find(x => x.id === (c.dataset.discardTakeBackId || '')); if (card) openCard(card) } });
e.closeDeck.addEventListener('click', askCloseDeckWithShufflePrompt); e.closeDeckActions.addEventListener('click', () => e.deckActions.hidden = true);
e.deckModal.addEventListener('click', ev => { const t = ev.target; if (!(t instanceof HTMLElement)) return; if (t.dataset.closeDeckModal === 'true') { askCloseDeckWithShufflePrompt(); return } const b = t.closest('.deck-item-btn'); if (b instanceof HTMLElement) { takeDeck(b.dataset.deckTakeId || ''); return } const c = t.closest('.deck-list-card'); if (c instanceof HTMLElement) { const card = S.deck.find(x => x.id === (c.dataset.deckTakeId || '')); if (card) openCard(card) } });
e.deckClosePromptShuffle.addEventListener('click', () => { mix(); closeDeckAndPrompt() });
e.deckClosePromptNoShuffle.addEventListener('click', closeDeckAndPrompt);
e.deckClosePrompt.addEventListener('click', ev => { const t = ev.target; if (t instanceof HTMLElement && t.dataset.closeDeckClosePromptModal === 'true') e.deckClosePrompt.hidden = true });
e.discardZone.addEventListener('click', () => { if (Date.now() < S.blockDis) return; openDis() });
e.bag.addEventListener('click', ev => { ev.stopPropagation(); e.bagModal.hidden = false }); e.closeBag.addEventListener('click', () => e.bagModal.hidden = true); e.bagModal.addEventListener('click', ev => { const t = ev.target; if (t instanceof HTMLElement && t.dataset.closeMarkerBagModal === 'true') e.bagModal.hidden = true });
e.catalog.addEventListener('pointerdown', ev => { const t = ev.target; if (!(t instanceof HTMLElement)) return; const b = t.closest('.marker-catalog-item'); if (!(b instanceof HTMLElement) || ((ev.pointerType !== 'touch') && ev.button !== 0)) return; const tp = b.dataset.markerType || ''; if (!mTypes[tp]) return; ev.preventDefault(); mStart(tp, 'catalog', null, ev) });
e.markers.addEventListener('pointerdown', ev => { const t = ev.target; if (!(t instanceof HTMLElement)) return; const b = t.closest('.marker-item'); if (!(b instanceof HTMLElement) || ((ev.pointerType !== 'touch') && ev.button !== 0)) return; const id = Number(b.dataset.markerId || '-1'); const m = S.markers.find(x => x.id === id); if (!m) return; if (!ownsSharedItem(m)) { toast(gt('toast.multiLockedObject')); return; } ev.preventDefault(); mStart(m.type, 'board', m.id, ev, b) });
addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (!e.cardModal.hidden) e.cardModal.hidden = true; else if (!e.disModal.hidden) e.disModal.hidden = true; else if (!e.deckClosePrompt.hidden) e.deckClosePrompt.hidden = true; else if (!e.deckModal.hidden) askCloseDeckWithShufflePrompt(); else if (!e.deckActions.hidden) e.deckActions.hidden = true; else if (!e.bagModal.hidden) e.bagModal.hidden = true });
addEventListener('fullscreenchange', onFullscreenChange); addEventListener('resize', relayout); addEventListener('beforeunload', () => { if (S.saveT) clearTimeout(S.saveT); saveNow() });
applyGridVars(); init();
initOfflineSupport();

async function initCloudSync() {
  try {
    firebaseApi = await import("./firebase/storage.js");
    await firebaseApi.initFirebase();
  } catch {
    firebaseApi = null;
    return;
  }
  updateMultiplayerUi();
  if (!firebaseApi.isFirebaseEnabled()) return;
  firebaseApi.onUserChanged(async user => {
    currentCloudUser = user || null;
    updateMultiplayerUi();
    if (!user) {
      if (MP.roomId) await leaveCurrentRoom({ silent: true }).catch(() => {});
      return;
    }
    const data = await firebaseApi.loadUserData(user.uid).catch(() => null);
    if (!data) return;
    if (Array.isArray(data.decks)) {
      localStorage.setItem(K.decks, JSON.stringify(data.decks));
      renderDeckOptions(S.deckId || "");
      syncStartDeckOptions();
    }
    if (data.gameState && typeof data.gameState === "object") {
      localStorage.setItem(K.save, JSON.stringify(data.gameState));
      showStartScreen();
    }
    if (typeof data.lang === "string" && SUPPORTED_LANGS.has(data.lang)) {
      LANG = data.lang;
      localStorage.setItem(K.lang, LANG);
      applyGameTranslations();
    }
    const queryRoomId = new URLSearchParams(location.search).get('room');
    if (queryRoomId && !MP.roomId) {
      if (e.roomIdInput) e.roomIdInput.value = String(queryRoomId).toUpperCase();
      joinRoom().catch(() => {});
    }
  });
}

initCloudSync();

