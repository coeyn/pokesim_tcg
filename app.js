import {
  i18n,
  regulationMarks,
  typeDefinitions,
  typeOrder,
  basicEnergyTypeKeys,
  energyTypeColors,
} from "./catalog/constants.js";
import { cacheOfflinePack, registerOfflineServiceWorker } from "./offline/offline.js";
let firebaseApi = null;

let currentLanguage = "fr";
const STORAGE_LANG_KEY = "simtcg.lang";
let selectedTypeFilter = "all";
let currentSetName = "Standard G/H/I/J";
let fetchedCards = [];
const selectedEnergyTypes = new Set();
let currentVisibleCards = [];
let searchQuery = "";

const MAX_DECK_SIZE = 60;
const MAX_CARD_COPIES = 4;
const STORAGE_DECKS_KEY = "simtcg.decks";
let decks = [];
let selectedDeckId = "";

const languageSelect = document.getElementById("language");
const playLink = document.querySelector(".play-link");
const offlineCacheBtn = document.getElementById("offlineCacheBtn");
const loadStandardSetsButton = document.getElementById("loadStandardSets");
const typeFilterSelect = document.getElementById("typeFilterSelect");
const energyTypeButtons = document.getElementById("energyTypeButtons");
const cardSearchInput = document.getElementById("cardSearchInput");
const apiStatus = document.getElementById("apiStatus");
const cardResults = document.getElementById("cardResults");
const cardsLoading = document.getElementById("cardsLoading");
const cardsLoadingText = document.getElementById("cardsLoadingText");
const deckSelect = document.getElementById("deckSelect");
const deckNameInput = document.getElementById("deckNameInput");
const createDeckBtn = document.getElementById("createDeckBtn");
const deleteDeckBtn = document.getElementById("deleteDeckBtn");
const deckStatus = document.getElementById("deckStatus");
const energyDeckControls = document.getElementById("energyDeckControls");
const deckPreviewStatus = document.getElementById("deckPreviewStatus");
const deckPreviewList = document.getElementById("deckPreviewList");
const copyTransferBtn = document.getElementById("copyTransferBtn");
const clearTransferBtn = document.getElementById("clearTransferBtn");
const deckTransferData = document.getElementById("deckTransferData");
const cardDetailsModal = document.getElementById("cardDetailsModal");
const closeCardDetailsBtn = document.getElementById("closeCardDetailsBtn");
const cardDetailsContent = document.getElementById("cardDetailsContent");
const cardDetailsCache = new Map();
let offlineReady = false;

const offlineText = {
  fr: {
    idle: "Mode hors ligne",
    ready: "Hors ligne pret",
    caching: "Mise en cache...",
    done: (count) => `Hors ligne actif (${count})`,
    fail: "Echec du mode hors ligne",
  },
  en: {
    idle: "Offline mode",
    ready: "Offline ready",
    caching: "Caching...",
    done: (count) => `Offline ready (${count})`,
    fail: "Offline setup failed",
  },
  es: {
    idle: "Modo sin conexion",
    ready: "Sin conexion listo",
    caching: "Guardando cache...",
    done: (count) => `Sin conexion listo (${count})`,
    fail: "Error modo sin conexion",
  },
};

function t(key) {
  return i18n[currentLanguage][key] || key;
}

function getStoredLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_LANG_KEY);
    if (value && i18n[value]) {
      return value;
    }
  } catch (error) {
    // ignore storage access issues
  }
  return "fr";
}

function syncPlayLinkLanguage() {
  if (!playLink) {
    return;
  }
  const url = new URL(playLink.getAttribute("href") || "game.html", window.location.href);
  url.searchParams.set("lang", currentLanguage);
  playLink.setAttribute("href", `${url.pathname}${url.search}`);
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });
  cardSearchInput.placeholder = t("cards.searchPlaceholder");
  renderTypeFilterOptions();
  renderEnergyTypeButtons();
  renderEnergyDeckControls();
  if (offlineCacheBtn) {
    const text = offlineText[currentLanguage] || offlineText.fr;
    offlineCacheBtn.textContent = offlineReady ? text.ready : text.idle;
    offlineCacheBtn.classList.toggle("is-ready", offlineReady);
  }
}

function getImageUrl(card) {
  if (!card || !card.image) {
    return null;
  }
  if (typeof card.image === "string") {
    if (card.image.startsWith("data:") || card.image.startsWith("blob:")) {
      return card.image;
    }
    if (/\.(webp|png|jpg|jpeg)$/i.test(card.image)) {
      return card.image;
    }
    return `${card.image}/low.webp`;
  }
  if (typeof card.image === "object") {
    return card.image.high || card.image.low || card.image.small || null;
  }
  return null;
}

function getHighImageUrl(card) {
  if (!card || !card.image) {
    return null;
  }
  if (typeof card.image === "string") {
    if (card.image.startsWith("data:") || card.image.startsWith("blob:")) {
      return card.image;
    }
    if (/\.(webp|png|jpg|jpeg)$/i.test(card.image)) {
      return card.image;
    }
    return `${card.image}/high.webp`;
  }
  if (typeof card.image === "object") {
    return card.image.high || card.image.low || card.image.small || null;
  }
  return null;
}

function textOrDash(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function renderDetailsRow(label, value) {
  const row = document.createElement("div");
  row.className = "card-details-row";
  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  row.appendChild(strong);
  row.appendChild(document.createTextNode(` ${textOrDash(value)}`));
  return row;
}

function renderDetailsSection(title, rows, longRows = []) {
  const section = document.createElement("section");
  section.className = "card-details-section";

  const heading = document.createElement("h4");
  heading.className = "card-details-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  const rowsWrap = document.createElement("div");
  rowsWrap.className = "card-details-rows";
  rows.forEach((row) => rowsWrap.appendChild(row));
  section.appendChild(rowsWrap);

  longRows.forEach((row) => {
    row.classList.add("card-details-long");
    section.appendChild(row);
  });

  return section;
}

function closeCardDetailsModal() {
  cardDetailsModal.hidden = true;
}

async function openCardDetailsModal(cardId) {
  if (!cardId) {
    return;
  }
  cardDetailsModal.hidden = false;
  cardDetailsContent.textContent = "Chargement...";
  let details = cardDetailsCache.get(cardId);
  if (!details) {
    const response = await fetch(`https://api.tcgdex.net/v2/${currentLanguage}/cards/${encodeURIComponent(cardId)}`);
    if (!response.ok) {
      cardDetailsContent.textContent = t("cards.error");
      return;
    }
    details = await response.json();
    cardDetailsCache.set(cardId, details);
  }

  cardDetailsContent.innerHTML = "";
  const image = document.createElement("img");
  image.className = "card-details-image";
  image.alt = details.name || details.id || "Carte";
  image.src = getHighImageUrl(details) || getImageUrl(details) || "";
  cardDetailsContent.appendChild(image);

  const grid = document.createElement("div");
  grid.className = "card-details-grid";

  const head = document.createElement("div");
  head.className = "card-details-head";
  const title = document.createElement("h3");
  title.className = "card-details-title";
  title.textContent = details.name || details.id || "Carte";
  head.appendChild(title);
  const sub = document.createElement("p");
  sub.className = "card-details-sub";
  sub.textContent = `${textOrDash(details.category)} | ${textOrDash(details.regulationMark)} | ${textOrDash(details.set?.name)}`;
  head.appendChild(sub);
  grid.appendChild(head);

  grid.appendChild(renderDetailsSection("Carte", [
    renderDetailsRow("ID", details.id),
    renderDetailsRow("Local ID", details.localId),
    renderDetailsRow("Categorie", details.category),
    renderDetailsRow("PV", details.hp),
    renderDetailsRow("Type(s)", Array.isArray(details.types) ? details.types.join(", ") : ""),
    renderDetailsRow("Niveau", details.stage),
  ]));

  const attacks = Array.isArray(details.attacks) && details.attacks.length > 0
    ? details.attacks.map((a) => `${a.name || "Attaque"} (${a.damage || "-"})`).join(" | ")
    : "";
  const abilities = Array.isArray(details.abilities) && details.abilities.length > 0
    ? details.abilities.map((a) => a.name || "Talent").join(" | ")
    : "";
  const weaknesses = Array.isArray(details.weaknesses) && details.weaknesses.length > 0
    ? details.weaknesses.map((w) => `${w.type || ""} ${w.value || ""}`.trim()).join(", ")
    : "";
  const resistances = Array.isArray(details.resistances) && details.resistances.length > 0
    ? details.resistances.map((r) => `${r.type || ""} ${r.value || ""}`.trim()).join(", ")
    : "";

  grid.appendChild(renderDetailsSection("Combat", [
    renderDetailsRow("Retraite", details.retreat),
    renderDetailsRow("Faiblesses", weaknesses),
    renderDetailsRow("Resistances", resistances),
  ], [
    renderDetailsRow("Attaques", attacks),
    renderDetailsRow("Talents", abilities),
  ]));

  grid.appendChild(renderDetailsSection("Collection", [
    renderDetailsRow("Regulation Mark", details.regulationMark),
    renderDetailsRow("Set", details.set?.name),
    renderDetailsRow("Rareté", details.rarity),
    renderDetailsRow("Illustrateur", details.illustrator),
  ]));

  cardDetailsContent.appendChild(grid);
}

function loadDecksFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_DECKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    decks = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    decks = [];
  }
}

function saveDecksToStorage() {
  localStorage.setItem(STORAGE_DECKS_KEY, JSON.stringify(decks));
  const user = currentCloudUser;
  if (user && firebaseApi) {
    firebaseApi.saveUserData(user.uid, { decks }).catch(() => {});
  }
}

function getDeckById(deckId) {
  return decks.find((deck) => deck.id === deckId) || null;
}

function countCopiesInDeck(deck, cardId) {
  if (!deck || !Array.isArray(deck.cards)) {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < deck.cards.length; i += 1) {
    if (deck.cards[i].id === cardId) {
      count += 1;
    }
  }
  return count;
}

function setDeckStatus(message) {
  deckStatus.textContent = message;
}

function renderDeckSelect() {
  deckSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Aucun deck";
  deckSelect.appendChild(placeholder);

  decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck.id;
    const count = Array.isArray(deck.cards) ? deck.cards.length : 0;
    option.textContent = `${deck.name} (${count}/60)`;
    if (deck.id === selectedDeckId) {
      option.selected = true;
    }
    deckSelect.appendChild(option);
  });
}

function renderDeckUi() {
  renderDeckSelect();
  const deck = getDeckById(selectedDeckId);
  deckNameInput.value = deck ? deck.name : "";
  deleteDeckBtn.disabled = !deck;
  renderDeckPreview(deck);
  renderEnergyDeckControls();
  syncDeckTransferPreview(deck);
}

function syncDeckTransferPreview(deck) {
  if (!deckTransferData) {
    return;
  }
  if (!deck) {
    deckTransferData.value = "";
    if (copyTransferBtn) {
      copyTransferBtn.disabled = true;
    }
    return;
  }
  const payload = {
    version: 1,
    deck: {
      name: deck.name,
      cards: Array.isArray(deck.cards) ? deck.cards : [],
    },
  };
  deckTransferData.value = JSON.stringify(payload, null, 2);
  if (copyTransferBtn) {
    copyTransferBtn.disabled = false;
  }
}

function renderEnergyDeckControls() {
  if (!energyDeckControls) {
    return;
  }
  energyDeckControls.innerHTML = "";
  const deck = getDeckById(selectedDeckId);
  const deckSize = Array.isArray(deck?.cards) ? deck.cards.length : 0;
  basicEnergyTypeKeys.forEach((typeKey) => {
    const id = `basic-energy-${typeKey}`;
    const count = countCopiesInDeck(deck, id);
    const item = document.createElement("div");
    item.className = "energy-deck-item";

    const name = document.createElement("span");
    name.className = "energy-deck-name";
    name.textContent = typeDefinitions[typeKey]?.[currentLanguage]?.label || typeKey;
    item.appendChild(name);

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "energy-deck-btn";
    minusBtn.textContent = "-";
    minusBtn.dataset.energyAction = "remove";
    minusBtn.dataset.energyType = typeKey;
    minusBtn.disabled = !deck || count === 0;
    item.appendChild(minusBtn);

    const badge = document.createElement("span");
    badge.className = "energy-deck-count";
    badge.textContent = String(count);
    item.appendChild(badge);

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "energy-deck-btn";
    plusBtn.textContent = "+";
    plusBtn.dataset.energyAction = "add";
    plusBtn.dataset.energyType = typeKey;
    plusBtn.disabled = !deck || deckSize >= MAX_DECK_SIZE;
    item.appendChild(plusBtn);

    energyDeckControls.appendChild(item);
  });
}

function renderDeckPreview(deck) {
  deckPreviewList.innerHTML = "";
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  deckPreviewStatus.textContent = `${cards.length} / 60`;
  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "deck-preview-empty";
    empty.textContent = "Aucune carte selectionnee.";
    deckPreviewList.appendChild(empty);
    return;
  }

  const countById = new Map();
  cards.forEach((card) => {
    const key = card.id || "";
    if (!key) {
      return;
    }
    const existing = countById.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    countById.set(key, { card, count: 1 });
  });

  countById.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "deck-preview-item";
    const imageUrl = getImageUrl(entry.card);
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = entry.card.name || entry.card.id || "Carte";
      img.loading = "lazy";
      item.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "deck-preview-placeholder";
      placeholder.textContent = entry.card.name || "Carte";
      item.appendChild(placeholder);
    }

    const countEl = document.createElement("span");
    countEl.className = "deck-preview-count";
    countEl.textContent = String(entry.count);
    item.appendChild(countEl);
    deckPreviewList.appendChild(item);
  });
}

function toDeckCard(card) {
  const rawCategory = String(card?.category || "").toLowerCase();
  const rawType = String(card?.type || "").toLowerCase();
  const isTrainer = rawCategory.includes("trainer") || rawCategory.includes("dresseur") || rawCategory.includes("entrenador");
  const isEnergy = rawCategory.includes("energy") || rawCategory.includes("energie") || rawCategory.includes("energ");
  const kind = isEnergy ? "energy" : (isTrainer ? "trainer" : "pokemon");
  return {
    id: card.id || `CARD-${Date.now()}`,
    name: card.name || "Carte",
    image: card.image || null,
    type: rawType || "",
    category: card.category || "",
    kind,
  };
}

function isBasicEnergyId(cardId) {
  return typeof cardId === "string" && cardId.startsWith("basic-energy-");
}

function buildBasicEnergyName(typeKey) {
  const label = typeDefinitions[typeKey]?.[currentLanguage]?.label || typeKey;
  return `${label} Energie`;
}

function createEnergyImageDataUrl(typeKey) {
  const def = energyTypeColors[typeKey] || { bg: "#666666", fg: "#ffffff" };
  const title = (typeDefinitions[typeKey]?.[currentLanguage]?.label || typeKey).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${def.bg}"/><stop offset="1" stop-color="#1f1f1f"/></linearGradient></defs><rect width="500" height="700" rx="28" ry="28" fill="url(#g)"/><circle cx="250" cy="300" r="140" fill="rgba(255,255,255,0.18)"/><text x="250" y="322" text-anchor="middle" fill="${def.fg}" font-size="62" font-family="Space Grotesk,Arial,sans-serif" font-weight="700">${title}</text><text x="250" y="610" text-anchor="middle" fill="${def.fg}" font-size="46" font-family="Space Grotesk,Arial,sans-serif" font-weight="700">BASIC ENERGY</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildBasicEnergyCard(typeKey) {
  const id = `basic-energy-${typeKey}`;
  return {
    id,
    name: buildBasicEnergyName(typeKey),
    image: createEnergyImageDataUrl(typeKey),
    type: typeDefinitions[typeKey]?.[currentLanguage]?.label || typeKey,
    kind: "energy",
  };
}

function addEnergyCardToSelectedDeck(typeKey) {
  const deck = getDeckById(selectedDeckId);
  if (!deck) {
    setDeckStatus("Selectionne ou cree un deck.");
    return;
  }
  if (!Array.isArray(deck.cards)) {
    deck.cards = [];
  }
  if (deck.cards.length >= MAX_DECK_SIZE) {
    setDeckStatus("Deck complet (60/60).");
    return;
  }
  deck.cards.push(buildBasicEnergyCard(typeKey));
  saveDecksToStorage();
  setDeckStatus(`${deck.name}: ${deck.cards.length}/60`);
  renderDeckUi();
}

function removeEnergyCardFromSelectedDeck(typeKey) {
  const deck = getDeckById(selectedDeckId);
  if (!deck || !Array.isArray(deck.cards) || deck.cards.length === 0) {
    return;
  }
  const id = `basic-energy-${typeKey}`;
  const index = deck.cards.findIndex((card) => card.id === id);
  if (index < 0) {
    return;
  }
  deck.cards.splice(index, 1);
  saveDecksToStorage();
  setDeckStatus(`${deck.name}: ${deck.cards.length}/60`);
  renderDeckUi();
}

function addCardToSelectedDeck(card) {
  const deck = getDeckById(selectedDeckId);
  if (!deck) {
    setDeckStatus("Selectionne ou cree un deck.");
    return;
  }
  if (!Array.isArray(deck.cards)) {
    deck.cards = [];
  }
  if (deck.cards.length >= MAX_DECK_SIZE) {
    setDeckStatus("Deck complet (60/60).");
    return;
  }
  const copies = countCopiesInDeck(deck, card.id);
  if (!isBasicEnergyId(card.id) && copies >= MAX_CARD_COPIES) {
    setDeckStatus("Maximum 4 exemplaires pour une meme carte.");
    return;
  }
  deck.cards.push(toDeckCard(card));
  saveDecksToStorage();
  setDeckStatus(`${deck.name}: ${deck.cards.length}/60`);
  renderDeckUi();
  renderCards(currentVisibleCards, currentSetName);
}

function removeCardFromSelectedDeck(cardId) {
  const deck = getDeckById(selectedDeckId);
  if (!deck || !Array.isArray(deck.cards) || deck.cards.length === 0) {
    return;
  }
  const index = deck.cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    return;
  }
  deck.cards.splice(index, 1);
  saveDecksToStorage();
  setDeckStatus(`${deck.name}: ${deck.cards.length}/60`);
  renderDeckUi();
  renderCards(currentVisibleCards, currentSetName);
}

function showCardsLoading(message) {
  cardsLoadingText.textContent = message;
  cardsLoading.hidden = false;
}

function hideCardsLoading() {
  cardsLoading.hidden = true;
}

function renderTypeFilterOptions() {
  typeFilterSelect.innerHTML = "";

  const filterOptions = [
    { value: "all", key: "cards.filterAll" },
    { value: "pokemon", key: "cards.filterPokemon" },
    { value: "trainer", key: "cards.filterTrainer" },
    { value: "energy", key: "cards.filterEnergy" },
  ];

  filterOptions.forEach((filterOption) => {
    const option = document.createElement("option");
    option.value = filterOption.value;
    option.textContent = t(filterOption.key);
    if (filterOption.value === selectedTypeFilter) {
      option.selected = true;
    }
    typeFilterSelect.appendChild(option);
  });

  typeFilterSelect.disabled = false;
}

function renderEnergyTypeButtons() {
  energyTypeButtons.innerHTML = "";
  const disabled = false;

  typeOrder.forEach((typeKey) => {
    const langDef = typeDefinitions[typeKey][currentLanguage];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "type-button";
    button.textContent = langDef.label;
    button.setAttribute("data-type-key", typeKey);
    if (selectedEnergyTypes.has(typeKey)) {
      button.classList.add("active");
    }
    button.disabled = disabled;
    energyTypeButtons.appendChild(button);
  });
}

function getCategoryParamForFilter(filterKey) {
  const categoriesByLanguage = {
    fr: {
      pokemon: "Pok\u00e9mon",
      trainer: "Dresseur",
      energy: "\u00c9nergie",
    },
    en: {
      pokemon: "Pokemon",
      trainer: "Trainer",
      energy: "Energy",
    },
    es: {
      pokemon: "Pok\u00e9mon",
      trainer: "Entrenador",
      energy: "Energ\u00eda",
    },
  };

  return categoriesByLanguage[currentLanguage]?.[filterKey] || null;
}

function getSelectedTypeApiValues() {
  return Array.from(selectedEnergyTypes).map((typeKey) => typeDefinitions[typeKey][currentLanguage].api);
}

function renderCards(cards, setName, totalCardsCount = null) {
  currentVisibleCards = Array.isArray(cards) ? cards : [];
  cardResults.innerHTML = "";

  if (!Array.isArray(cards) || cards.length === 0) {
    apiStatus.textContent = t("cards.noCards");
    return;
  }

  if (typeof totalCardsCount === "number" && totalCardsCount !== cards.length) {
    apiStatus.textContent = `${cards.length}/${totalCardsCount} ${t("cards.cardsShown")} - ${setName}`;
  } else {
    apiStatus.textContent = `${cards.length} ${t("cards.cardsLoaded")} - ${setName}`;
  }

  cards.forEach((card) => {
    const cardBox = document.createElement("article");
    cardBox.className = "card-item";
    cardBox.dataset.cardId = card.id || "";

    const imageUrl = getImageUrl(card);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = card.name || card.id;
      image.loading = "lazy";
      image.onerror = () => {
        if (image.src.endsWith("/low.webp")) {
          image.src = image.src.replace("/low.webp", "/low.png");
        }
      };
      cardBox.appendChild(image);
    } else {
      const noImage = document.createElement("p");
      noImage.textContent = t("cards.result.noImage");
      noImage.className = "no-image";
      cardBox.appendChild(noImage);
    }

    if (selectedDeckId) {
      const selectedDeck = getDeckById(selectedDeckId);
      const qty = countCopiesInDeck(selectedDeck, card.id);

      const controls = document.createElement("div");
      controls.className = "card-item-controls";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "card-item-btn";
      removeBtn.dataset.cardAction = "remove";
      removeBtn.dataset.cardId = card.id || "";
      removeBtn.textContent = "-";
      removeBtn.disabled = qty === 0;
      controls.appendChild(removeBtn);

      const qtyEl = document.createElement("span");
      qtyEl.className = "card-item-qty";
      qtyEl.textContent = String(qty);
      controls.appendChild(qtyEl);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "card-item-btn";
      addBtn.dataset.cardAction = "add";
      addBtn.dataset.cardId = card.id || "";
      addBtn.textContent = "+";
      addBtn.disabled = (selectedDeck?.cards?.length || 0) >= MAX_DECK_SIZE || qty >= MAX_CARD_COPIES;
      controls.appendChild(addBtn);

      cardBox.appendChild(controls);
    }

    cardResults.appendChild(cardBox);
  });
}

async function renderCurrentSetWithFilters() {
  const categoryParam = getCategoryParamForFilter(selectedTypeFilter);
  const selectedTypeValues = getSelectedTypeApiValues();

  if (selectedTypeFilter === "all" && selectedTypeValues.length === 0) {
    apiStatus.textContent = t("cards.loadingCards");
    showCardsLoading(t("cards.loadingCards"));
  } else {
    apiStatus.textContent = t("cards.loadingTypes");
    showCardsLoading(t("cards.loadingTypes"));
  }
  cardResults.innerHTML = "";

  try {
    const params = new URLSearchParams({ regulationMark: regulationMarks.join(",") });
    if (categoryParam) {
      params.set("category", categoryParam);
    }
    if (selectedTypeValues.length > 0) {
      params.set("types", selectedTypeValues.join(","));
    }
    const response = await fetch(`https://api.tcgdex.net/v2/${currentLanguage}/cards?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const cards = await response.json();
    fetchedCards = Array.isArray(cards) ? cards : [];
    applySearchAndRender();
  } catch (error) {
    apiStatus.textContent = t("cards.error");
  } finally {
    hideCardsLoading();
  }
}

async function loadStandardSets() {
  apiStatus.textContent = t("cards.loadingSets");
  cardResults.innerHTML = "";

  try {
    await renderCurrentSetWithFilters();
  } catch (error) {
    apiStatus.textContent = t("cards.error");
  }
}

function applySearchAndRender() {
  const query = searchQuery.trim().toLowerCase();
  let cards = fetchedCards.filter((card) => Boolean(getImageUrl(card)));
  if (query) {
    cards = cards.filter((card) => {
      const id = (card.id || "").toLowerCase();
      const name = (card.name || "").toLowerCase();
      const localId = (card.localId || "").toLowerCase();
      return id.includes(query) || name.includes(query) || localId.includes(query);
    });
  } else if (selectedTypeFilter === "all" && selectedEnergyTypes.size === 0) {
    cards = cards.slice(0, 120);
  }
  renderCards(cards, currentSetName, query ? cards.length : null);
}

function getVisibleCardImageUrls() {
  return currentVisibleCards
    .map((card) => getHighImageUrl(card) || getImageUrl(card))
    .filter(Boolean);
}

async function initOfflineSupport() {
  if (!offlineCacheBtn) {
    return;
  }
  const txt = offlineText[currentLanguage] || offlineText.fr;
  const registration = await registerOfflineServiceWorker();
  if (registration) {
    offlineReady = true;
    offlineCacheBtn.classList.add("is-ready");
    offlineCacheBtn.textContent = txt.ready;
  }
  offlineCacheBtn.addEventListener("click", async () => {
    const curr = offlineText[currentLanguage] || offlineText.fr;
    offlineCacheBtn.disabled = true;
    offlineCacheBtn.classList.remove("is-ready");
    offlineCacheBtn.textContent = curr.caching;
    const result = await cacheOfflinePack(getVisibleCardImageUrls());
    if (result.ok) {
      offlineCacheBtn.textContent = curr.done(result.count);
      offlineCacheBtn.classList.add("is-ready");
      apiStatus.textContent = curr.done(result.count);
    } else {
      offlineCacheBtn.textContent = curr.fail;
      apiStatus.textContent = curr.fail;
    }
    setTimeout(() => {
      const next = offlineText[currentLanguage] || offlineText.fr;
      offlineCacheBtn.disabled = false;
      offlineCacheBtn.textContent = next.ready;
      offlineCacheBtn.classList.add("is-ready");
    }, 1700);
  });
}

function createOrRenameDeck() {
  const name = deckNameInput.value.trim();
  if (!name) {
    setDeckStatus("Entre un nom de deck.");
    return;
  }

  const existing = getDeckById(selectedDeckId);
  if (existing) {
    existing.name = name;
    saveDecksToStorage();
    setDeckStatus(`Deck renomme: ${name}`);
    renderDeckUi();
    return;
  }

  const newDeck = {
    id: `deck-${Date.now()}`,
    name,
    cards: [],
  };
  decks.push(newDeck);
  selectedDeckId = newDeck.id;
  saveDecksToStorage();
  setDeckStatus(`Deck cree: ${name}`);
  renderDeckUi();
  renderCards(currentVisibleCards, currentSetName);
}

function deleteSelectedDeck() {
  const deck = getDeckById(selectedDeckId);
  if (!deck) {
    return;
  }
  decks = decks.filter((item) => item.id !== deck.id);
  selectedDeckId = "";
  saveDecksToStorage();
  setDeckStatus("Deck supprime.");
  renderDeckUi();
  renderCards(currentVisibleCards, currentSetName);
}

languageSelect.addEventListener("change", async () => {
  currentLanguage = languageSelect.value;
  localStorage.setItem(STORAGE_LANG_KEY, currentLanguage);
  const user = currentCloudUser;
  if (user && firebaseApi) {
    firebaseApi.saveUserData(user.uid, { lang: currentLanguage }).catch(() => {});
  }
  syncPlayLinkLanguage();
  applyTranslations();
  await loadStandardSets();
});

loadStandardSetsButton.addEventListener("click", loadStandardSets);

deckSelect.addEventListener("change", () => {
  selectedDeckId = deckSelect.value || "";
  renderDeckUi();
  renderCards(currentVisibleCards, currentSetName);
});

createDeckBtn.addEventListener("click", createOrRenameDeck);
deleteDeckBtn.addEventListener("click", deleteSelectedDeck);
if (copyTransferBtn && deckTransferData) {
  copyTransferBtn.addEventListener("click", async () => {
    if (!deckTransferData.value.trim()) {
      setDeckStatus("Aucun JSON a copier.");
      return;
    }
    try {
      await navigator.clipboard.writeText(deckTransferData.value);
      setDeckStatus("JSON copie dans le presse-papier.");
    } catch {
      setDeckStatus("Impossible de copier dans le presse-papier.");
    }
  });
}
if (clearTransferBtn && deckTransferData) {
  clearTransferBtn.addEventListener("click", () => {
    deckTransferData.value = "";
    setDeckStatus("Zone JSON videe.");
  });
}

energyDeckControls.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const action = target.dataset.energyAction;
  const typeKey = target.dataset.energyType;
  if (!action || !typeKey) {
    return;
  }
  if (action === "add") {
    addEnergyCardToSelectedDeck(typeKey);
    return;
  }
  if (action === "remove") {
    removeEnergyCardFromSelectedDeck(typeKey);
  }
});

typeFilterSelect.addEventListener("change", () => {
  selectedTypeFilter = typeFilterSelect.value;
  renderCurrentSetWithFilters();
});

energyTypeButtons.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const typeKey = target.getAttribute("data-type-key");
  if (!typeKey) {
    return;
  }

  if (selectedEnergyTypes.has(typeKey)) {
    selectedEnergyTypes.delete(typeKey);
  } else {
    selectedEnergyTypes.add(typeKey);
  }

  renderEnergyTypeButtons();
  renderCurrentSetWithFilters();
});

cardSearchInput.addEventListener("input", () => {
  searchQuery = cardSearchInput.value || "";
  applySearchAndRender();
});

cardResults.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    const cardItem = event.target instanceof HTMLElement ? event.target.closest(".card-item") : null;
    if (!(cardItem instanceof HTMLElement)) {
      return;
    }
    const cardId = cardItem.dataset.cardId || "";
    if (!cardId) {
      return;
    }
    openCardDetailsModal(cardId).catch(() => {
      cardDetailsContent.textContent = t("cards.error");
      cardDetailsModal.hidden = false;
    });
    return;
  }
  const action = target.dataset.cardAction;
  const cardId = target.dataset.cardId;
  if (!action || !cardId) {
    return;
  }

  if (action === "remove") {
    removeCardFromSelectedDeck(cardId);
    return;
  }

  if (action === "add") {
    const card = currentVisibleCards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    addCardToSelectedDeck(card);
  }
});

closeCardDetailsBtn.addEventListener("click", closeCardDetailsModal);
cardDetailsModal.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.closeCardDetails === "true") {
    closeCardDetailsModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !cardDetailsModal.hidden) {
    closeCardDetailsModal();
  }
});

currentLanguage = getStoredLanguage();
languageSelect.value = currentLanguage;
syncPlayLinkLanguage();
applyTranslations();
loadDecksFromStorage();
renderDeckUi();
loadStandardSets();

let currentCloudUser = null;
async function initCloudSync() {
  try {
    firebaseApi = await import("./firebase/storage.js");
    await firebaseApi.initFirebase();
  } catch {
    firebaseApi = null;
    return;
  }
  if (!firebaseApi.isFirebaseEnabled()) return;
  firebaseApi.onUserChanged(async (user) => {
    currentCloudUser = user || null;
    if (!user) return;
    const data = await firebaseApi.loadUserData(user.uid).catch(() => null);
    if (!data) return;
    if (Array.isArray(data.decks)) {
      decks = data.decks;
      localStorage.setItem(STORAGE_DECKS_KEY, JSON.stringify(decks));
      renderDeckUi();
      renderCards(currentVisibleCards, currentSetName);
    }
    if (typeof data.lang === "string" && i18n[data.lang]) {
      currentLanguage = data.lang;
      languageSelect.value = currentLanguage;
      localStorage.setItem(STORAGE_LANG_KEY, currentLanguage);
      syncPlayLinkLanguage();
      applyTranslations();
      await loadStandardSets();
    }
  });
}

initCloudSync();
initOfflineSupport();
