/* =====================================================================
 * app.js — Application logic for the Library Book Recommender
 * ---------------------------------------------------------------------
 * Wires the custom data structures from dsa.js to the UI:
 *   BookHashTable  -> O(1) lookup of a book by ID (+ duplicate-title check)
 *   Trie           -> live autocomplete + search filtering
 *   MaxHeap        -> "Top 5 Highest Rated"
 *   mergeSort      -> sort dropdown
 *   bfsRecommendation -> "Related Books" in the details modal
 * ===================================================================== */
'use strict';

/* =====================================================================
 * 0. STARTUP GUARD
 * ---------------------------------------------------------------------
 * app.js needs dsa.js to be loaded first (see the <script> tags at the end
 * of index.html). If it is missing or misnamed, show a visible message
 * instead of failing silently with dead buttons.
 * ===================================================================== */
function showStartupError(message) {
  const box = document.createElement('div');
  box.id = 'startup-error';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;padding:14px 20px;' +
    'background:#7f1d1d;color:#fff;font:600 14px/1.5 system-ui,sans-serif;text-align:center;';
  box.textContent = message;
  (document.body || document.documentElement).appendChild(box);
}

if (typeof BookHashTable === 'undefined' || typeof Trie === 'undefined' || typeof MaxHeap === 'undefined' ||
    typeof BookGraph === 'undefined' || typeof mergeSort === 'undefined' || typeof bfsRecommendation === 'undefined') {
  showStartupError('Startup error: dsa.js was not loaded. Make sure index.html, style.css, dsa.js and app.js are in the same folder and named exactly like this.');
  throw new Error('dsa.js not loaded - check the file name and that it sits next to index.html');
}

/* =====================================================================
 * 1. DUMMY-DATA VOCABULARY
 * ===================================================================== */

// Title prefixes that are followed by a place phrase ("... the Silver Forest")
const OF_PREFIXES = [
  'The Shadow of', 'Echoes of', 'Whispers in', 'The Secret of', 'Legacy of',
  'The Last Light of', 'Beyond', 'Rise of', 'Tales from', 'Chronicles of',
  'The Return to', 'Fall of', 'Across', 'Journey to', 'Songs of',
  'Guardians of', 'Beneath', 'The Heart of', 'Dawn over', 'Memories of'
];

// Prefixes that are followed by a noun ("The Last Dragonkeeper")
const ADJ_PREFIXES = [
  'The Last', 'The Silent', 'The Forgotten', 'The Crimson', 'The Hidden',
  'The Broken', 'The Midnight', 'The Golden', 'The Final', 'The Wandering',
  'The Hollow', 'The Burning', 'The Lonely', 'The Silver', 'The Secret', 'The Restless'
];

// Each genre has its own places + nouns so titles feel genre-appropriate.
const GENRES = [
  {
    name: 'Fantasy', hue: 265, emoji: '🐉',
    places: ['the Ember Throne', 'the Silver Forest', 'the Hollow Crown', 'the Frostbound Keep',
             'the Moonlit Realm', "the Dragon's Reach", 'the Crystal Citadel', 'the Wandering Isles',
             'the Ashen Kingdom', 'the Starlit Grove', 'the Sunken Temple', 'the Gilded Tower'],
    nouns: ['Dragonkeeper', 'Spellweaver', 'Rune Witch', 'Shieldbearer', 'Stormcaller', 'Oathkeeper',
            'Wyrmhunter', 'Sorcerer-King', 'Moonblade', 'Ember Mage', 'Thornknight', 'Wandering Wizard']
  },
  {
    name: 'Sci-Fi', hue: 205, emoji: '🚀',
    places: ['the Distant Orbit', 'Neon Station Nine', 'the Void Between Stars', 'the Silent Colony',
             'the Iron Nebula', "Andromeda's Edge", 'the Last Starport', 'the Quantum Garden',
             'the Red Horizon', 'the Dying Sun', 'the Orbital Ring', 'the Lunar Archive'],
    nouns: ['Starship', 'Android', 'Time Traveler', 'Terraformer', 'Signal', 'Cyborg',
            'Navigator', 'Algorithm', 'Exile', 'Singularity', 'Voidrunner', 'Star Cartographer']
  },
  {
    name: 'Mystery', hue: 48, emoji: '🕵️',
    places: ['the Locked Study', 'Blackwater Manor', 'the Midnight Express', 'the Vanishing Gallery',
             'Raven Hollow', 'the Foggy Harbor', 'the Silent Parlor', 'Hollowbrook Inn',
             'the Gilded Cage', 'the Quiet Village', 'the Burned Archive', 'Marlowe Street'],
    nouns: ['Alibi', 'Witness', 'Cipher', 'Detective', 'Confession', 'Clue',
            'Informant', 'Locksmith', 'Inheritance', 'Portrait', 'Ledger', 'Suspect']
  },
  {
    name: 'Romance', hue: 335, emoji: '💕',
    places: ['the Summer Cottage', 'Paris in Rain', 'the Lantern Festival', 'the Seaside Café',
             'Willow Bay', 'the Winter Ball', 'the Golden Hour', 'the Vineyard',
             'Maple Street', 'the Moonlit Pier', 'the Last Dance', 'the Garden Wedding'],
    nouns: ['Promise', 'Letter', 'Heart', 'Serenade', 'Sweetheart', 'Kiss',
            'Valentine', 'Duet', 'Bride', 'Rendezvous', 'Proposal', 'Embrace']
  },
  {
    name: 'Thriller', hue: 12, emoji: '🎯',
    places: ['the Red Protocol', 'the Cold Harbor', 'Zero Hour', 'the Safehouse',
             'the Final Hour', 'the Black Ledger', 'Checkpoint Nine', 'the Burning Bridge',
             'the Silent Witness', 'the Hostage Floor', 'the Long Con', 'the Iron Vault'],
    nouns: ['Assassin', 'Hostage', 'Conspiracy', 'Defector', 'Mole', 'Fugitive',
            'Operative', 'Ultimatum', 'Sniper', 'Courier', 'Whistleblower', 'Contract']
  },
  {
    name: 'Historical', hue: 92, emoji: '🏛️',
    places: ['the Silk Road', 'Old Constantinople', 'the Iron Empire', 'the Last Republic',
             'Rome in Flames', 'the Plague Year', 'Imperial Vienna', 'the Gold Rush',
             'the Siege of Orléans', 'the Tudor Court', 'the Samurai Road', 'the Trade Winds'],
    nouns: ['Cartographer', 'Empress', 'Courier', 'Legionnaire', 'Chronicler', 'Merchant',
            'Regent', 'Blacksmith', 'Navigator', 'Scribe', 'Duchess', 'Pilgrim']
  },
  {
    name: 'Horror', hue: 300, emoji: '👻',
    places: ['the Hollow House', 'Blackmoor Asylum', 'the Whispering Cellar', "Dead Man's Lane",
             'the Crooked Chapel', 'the Drowned Village', 'the Candlelit Attic', 'Ravenscar Hall',
             'the Fog-Bound Woods', 'the Midnight Carnival', 'the Rotting Orchard', 'the Silent Nursery'],
    nouns: ['Hollow Man', 'Scarecrow', 'Revenant', 'Lullaby', 'Doll', 'Séance',
            'Shade', 'Banshee', 'Ghoul', 'Poltergeist', 'Undertaker', 'Harvest']
  },
  {
    name: 'Adventure', hue: 160, emoji: '🧭',
    places: ['the Lost Canyon', 'the Jade Temple', 'the Emerald Coast', 'the Forbidden Peak',
             'the Hidden Lagoon', 'the Sunken Galleon', 'the Amazon Deep', 'the Desert Compass',
             'the Golden Idol', 'Treasure Cove', 'the Crimson Jungle', 'the Frozen Pass'],
    nouns: ['Treasure Hunter', 'Explorer', 'Castaway', 'Compass', 'Mapmaker', 'Stowaway',
            'Buccaneer', 'Trailblazer', 'Expedition', 'Pathfinder', 'Voyager', 'Relic']
  }
];

const FIRST_NAMES = [
  'Eleanor', 'Marcus', 'Priya', 'Tobias', 'Naomi', 'Dmitri', 'Isabella', 'Kwame', 'Lucia', 'Henrik',
  'Amara', 'Julian', 'Sofia', 'Rafael', 'Mei', 'Callum', 'Zara', 'Anselm', 'Ingrid', 'Mateo',
  'Leila', 'Oskar', 'Hana', 'Desmond', 'Freya', 'Idris', 'Camille', 'Soren', 'Nadia', 'Ezra',
  'Willa', 'Tariq', 'Beatrix', 'Joaquin', 'Yara', 'Magnus', 'Odette', 'Rohan', 'Thea', 'Cassian',
  'Imogen', 'Lars', 'Noor', 'Everett', 'Mira', 'Bastian', 'Selene', 'Ambrose'
];

const LAST_NAMES = [
  'Whitlock', 'Okafor', 'Lindqvist', 'Navarro', 'Castellanos', 'Ashworth', 'Petrov', 'Nakamura',
  'Delacroix', 'Fitzgerald', 'Mbeki', 'Halloran', 'Vasquez', 'Thornfield', 'Kowalski', 'Abernathy',
  'Sandoval', 'Eriksen', 'Banerjee', 'Montague', 'Rosenthal', 'Ibarra', 'Calloway', 'Bergstrom',
  'Quinlan', 'Oyelaran', 'Hargreave', 'Lombardi', 'Tanaka', 'Winterbourne', 'Duarte', 'Kingsley',
  'Ferreira', 'Alvarez', 'Blackwood', 'Santiago', 'Moreau', 'Pemberton', 'Zielinski', 'Radcliffe',
  'Villanueva', 'Strand', 'Okonkwo', 'Hartwell', 'Mendoza', 'Larkspur', 'Dimaculangan', 'Reyes'
];

// Books that MUST exist so the BFS recommender can be tested.
const FEATURED_BOOKS = [
  {
    title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', genre: 'Fantasy',
    rating: 4.9, year: 1997,
    description: 'A young orphan discovers he is a wizard and begins his first year at Hogwarts School of Witchcraft and Wizardry, where friendship, courage and a dangerous secret await.'
  },
  {
    title: 'The Hunger Games', author: 'Suzanne Collins', genre: 'Sci-Fi',
    rating: 4.7, year: 2008,
    description: "In the dystopian nation of Panem, sixteen-year-old Katniss Everdeen volunteers to take her sister's place in a televised fight to the death."
  }
];

// Only used in the (very unlikely) event that many title combinations collide.
const FALLBACK_SUFFIXES = ['Reborn', 'Unbound', 'Revisited', 'Rising', 'Awakened', 'Reckoning', 'Ascendant', 'Redeemed', 'Unveiled', 'Beyond'];

const DESCRIPTION_TEMPLATES = [
  '{author} delivers a gripping {genre} story in “{title}”, packed with twists readers won’t see coming.',
  '“{title}” is a richly imagined {genre} novel that pulls readers in from the very first chapter.',
  'A fan favorite in the {genre} section, “{title}” follows an unlikely hero through danger, loyalty and discovery.',
  'With sharp characters and relentless pacing, {author}’s “{title}” is a standout {genre} read.',
  'Critics praise “{title}” for its bold storytelling and unforgettable atmosphere — a must-read for {genre} lovers.',
  'In “{title}”, {author} crafts an immersive {genre} world where every choice has a cost.'
];

/* =====================================================================
 * 2. STATE
 * ===================================================================== */
const state = {
  books: [],                          // master list (array of book objects)
  table: new BookHashTable(211),      // bookId -> book        (O(1) lookup)
  titles: new BookHashTable(211),     // normalised title -> id (duplicate check + unique generation)
  trie: new Trie(),                   // autocomplete index
  graph: new BookGraph(),             // genre graph for BFS
  nextId: 1,
  sortKey: 'id',
  sortOrder: 'desc',
  query: '',
  detailId: null,
  editingId: null,
  deleteId: null,
  menuId: null,
  formReturnToDetail: false,
  confirmReturnToDetail: false,
  suggestions: [],
  activeSuggestion: -1
};

/* =====================================================================
 * 3. SMALL HELPERS
 * ===================================================================== */
const $ = (selector, root = document) => root.querySelector(selector);

/** Creates an element and sets text via textContent (never innerHTML => XSS-safe). */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

const titleKey = (title) => title.replace(/\s+/g, ' ').trim().toLowerCase();
const formatRating = (r) => Number(r).toFixed(1);

function genreMeta(name) {
  for (let i = 0; i < GENRES.length; i++) if (GENRES[i].name === name) return GENRES[i];
  return { name, hue: 210, emoji: '📖' };
}

/* =====================================================================
 * 4. DUMMY DATA GENERATION
 * ===================================================================== */
function makeTitle(genre) {
  const pattern = Math.floor(Math.random() * 3);
  if (pattern === 0) return `${pick(OF_PREFIXES)} ${pick(genre.places)}`;      // Echoes of the Silver Forest
  if (pattern === 1) return `${pick(ADJ_PREFIXES)} ${pick(genre.nouns)}`;      // The Last Dragonkeeper
  return `The ${pick(genre.nouns)} of ${pick(genre.places)}`;                   // The Oathkeeper of the Ember Throne
}

/** Returns a title that is not used yet, and reserves it in the title table. */
function uniqueTitle(genre) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const t = makeTitle(genre);
    if (!state.titles.has(titleKey(t))) { state.titles.set(titleKey(t), true); return t; }
  }
  // Fallback: extend a title with a suffix word until it is free.
  const base = makeTitle(genre);
  for (let i = 0; i < FALLBACK_SUFFIXES.length; i++) {
    const t = `${base}: ${FALLBACK_SUFFIXES[i]}`;
    if (!state.titles.has(titleKey(t))) { state.titles.set(titleKey(t), true); return t; }
  }
  let n = 2;
  while (state.titles.has(titleKey(`${base} ${n}`))) n++;
  const t = `${base} ${n}`;
  state.titles.set(titleKey(t), true);
  return t;
}

function makeDescription(title, author, genre) {
  return pick(DESCRIPTION_TEMPLATES)
    .replace('{title}', () => title)
    .replace('{author}', () => author)
    .replace('{genre}', () => genre.toLowerCase());
}

function randomAuthor() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

/** Bell-shaped ratings between 2.8 and 5.0 (one decimal). */
function randomRating() {
  const r = (Math.random() + Math.random()) / 2;
  return Math.round((2.8 + r * 2.2) * 10) / 10;
}

/**
 * Builds 500 unique books (no "Volume 1, 2, 3" titles). The two featured books
 * are included in the 500 when they are not in the library yet.
 */
function generate500Books(startId) {
  const out = [];

  FEATURED_BOOKS.forEach((f) => {
    const key = titleKey(f.title);
    if (!state.titles.has(key)) {
      state.titles.set(key, true);
      out.push({ title: f.title, author: f.author, genre: f.genre, rating: f.rating, year: f.year, description: f.description });
    }
  });

  while (out.length < 500) {
    const genre = pick(GENRES);
    const title = uniqueTitle(genre);
    const author = randomAuthor();
    out.push({
      title,
      author,
      genre: genre.name,
      rating: randomRating(),
      year: 1950 + Math.floor(Math.random() * 76),
      description: makeDescription(title, author, genre.name)
    });
  }

  shuffle(out);                                   // so featured books are not always first
  out.forEach((book, i) => { book.id = startId + i; });
  return out;
}

/* =====================================================================
 * 5. INDEX MANAGEMENT
 * ===================================================================== */
function registerBook(book) {
  state.books.push(book);
  state.table.set(book.id, book);
  state.titles.set(titleKey(book.title), book.id);
  if (book.id >= state.nextId) state.nextId = book.id + 1;
}

/** Index every word-start of the text, so "potter" finds "Harry Potter and…". */
function indexText(trie, text, id) {
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] !== ' ' && (i === 0 || lower[i - 1] === ' ')) trie.insert(lower.slice(i), id);
  }
}

function buildTrie(books) {
  const trie = new Trie();
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    indexText(trie, b.title, b.id);
    indexText(trie, b.author, b.id);
    indexText(trie, b.genre, b.id);
  }
  return trie;
}

function rebuildIndexes() {
  state.trie = buildTrie(state.books);
  state.graph = BookGraph.fromBooks(state.books);
}

/* =====================================================================
 * 6. RENDERING
 * ===================================================================== */
function getVisibleBooks() {
  let list;
  if (state.query) {
    const ids = state.trie.search(state.query);          // Trie prefix search
    list = [];
    for (let i = 0; i < ids.length; i++) {
      const book = state.table.get(ids[i]);              // Hash table lookup
      if (book) list.push(book);
    }
  } else {
    list = state.books;
  }
  return mergeSort(list, state.sortKey, state.sortOrder); // custom merge sort
}

function createBookCard(book, rank) {
  const meta = genreMeta(book.genre);
  const card = el('article', 'book-card');
  card.style.setProperty('--hue', meta.hue);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open details for ${book.title}`);
  card.onclick = () => openDetailModal(book.id);
  card.onkeydown = (e) => {
    if (e.target === card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openDetailModal(book.id);
    }
  };

  const menuBtn = el('button', 'menu-btn', '⋮');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-label', `Options for ${book.title}`);
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.onclick = (e) => { e.stopPropagation(); toggleCardMenu(menuBtn, book.id); };
  card.appendChild(menuBtn);

  if (rank) card.appendChild(el('span', 'rank-badge', '#' + rank));
  card.appendChild(el('h3', 'book-title', book.title));
  card.appendChild(el('p', 'book-author', 'by ' + book.author));

  const foot = el('div', 'book-foot');
  foot.appendChild(el('span', 'genre-pill', book.genre));
  foot.appendChild(el('span', 'book-rating', '⭐ ' + formatRating(book.rating)));
  card.appendChild(foot);
  return card;
}

function renderTop5() {
  const top = MaxHeap.topK(state.books, 5);              // custom Max-Heap
  const grid = $('#top-grid');
  grid.replaceChildren();
  if (top.length === 0) grid.appendChild(el('p', 'muted', 'No books yet — add or generate some to see the top rated.'));
  top.forEach((book, i) => grid.appendChild(createBookCard(book, i + 1)));
}

function renderGrid() {
  const books = getVisibleBooks();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < books.length; i++) frag.appendChild(createBookCard(books[i]));
  $('#book-grid').replaceChildren(frag);

  $('#empty-state').classList.toggle('show', books.length === 0);
  if (books.length === 0) {
    const libraryEmpty = state.books.length === 0;
    $('#empty-state h3').textContent = libraryEmpty ? 'Your library is empty' : 'No books found';
    $('#empty-state p').textContent = libraryEmpty
      ? 'Use “+ Generate 500 Books” or “+ Add Book” to get started.'
      : 'Try a different title, author or genre.';
  }
  $('#result-count').textContent = state.query
    ? `${books.length} result${books.length === 1 ? '' : 's'}`
    : `${books.length} book${books.length === 1 ? '' : 's'}`;

  const select = $('#sort-select');
  $('#collection-sub').textContent = `Sorted by ${select.options[select.selectedIndex].text} · merge sort`;
}

function renderCounter() {
  $('#total-books').textContent = state.table.size.toLocaleString();
  const s = state.table.stats();
  $('#table-stats').textContent =
    `Hash table: ${s.capacity.toLocaleString()} buckets · load ${s.loadFactor.toFixed(2)} · longest chain ${s.longestChain}`;
}

function renderAll() {
  renderCounter();
  renderTop5();
  renderGrid();
}
/* =====================================================================
 * 7. MODAL MANAGER
 * ===================================================================== */
const isOpen = (sel) => $(sel).classList.contains('open');

function openModal(sel) {
  const m = $(sel);
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

function closeModal(sel) {
  const m = $(sel);
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('no-scroll');
}

/* ---------- Details modal (+ BFS related books) ---------- */
function openDetailModal(id) {
  const book = state.table.get(id);
  if (!book) return;
  closeCardMenu();
  closeSearchDropdown();
  state.detailId = id;
  renderDetail(book);
  openModal('#detail-modal');
  $('#detail-modal .modal').scrollTop = 0;
  setTimeout(() => $('#detail-close').focus(), 30);
}

function renderDetail(book) {
  const meta = genreMeta(book.genre);
  const body = $('#detail-body');
  body.replaceChildren();
  body.style.setProperty('--hue', meta.hue);

  // Header: cover + info
  const header = el('div', 'detail-header');
  const cover = el('div', 'detail-cover');
  cover.appendChild(el('span', 'cover-emoji', meta.emoji));
  cover.appendChild(el('span', 'cover-genre', book.genre));

  const info = el('div', 'detail-info');
  const title = el('h2', 'detail-title', book.title);
  title.id = 'detail-heading';
  info.appendChild(title);
  info.appendChild(el('p', 'detail-author', 'by ' + book.author));

  const chips = el('div', 'detail-chips');
  chips.appendChild(el('span', 'genre-pill', book.genre));
  chips.appendChild(el('span', 'chip', `⭐ ${formatRating(book.rating)} / 5`));
  chips.appendChild(el('span', 'chip', `📅 ${book.year}`));
  chips.appendChild(el('span', 'chip', `🆔 #${book.id}`));
  info.appendChild(chips);

  header.append(cover, info);
  body.appendChild(header);
  body.appendChild(el('p', 'detail-desc', book.description));

  // Related books powered by BFS
  const recs = bfsRecommendation(book.id, state.graph, 3);
  const section = el('section', 'related');
  const head = el('div', 'related-head');
  head.append(el('h3', '', 'Related Books'), el('span', 'related-tag', 'BFS · same genre first'));
  section.appendChild(head);

  const grid = el('div', 'related-grid');
  let shown = 0;
  recs.forEach((rec) => {
    const rb = state.table.get(rec.bookId);
    if (!rb) return;
    shown++;
    const card = el('button', 'related-card');
    card.type = 'button';
    card.style.setProperty('--hue', genreMeta(rb.genre).hue);
    card.onclick = () => openDetailModal(rb.id);

    const foot = el('div', 'related-foot');
    foot.appendChild(el('span', 'genre-pill', rb.genre));
    foot.appendChild(el('span', 'book-rating', '⭐ ' + formatRating(rb.rating)));

    card.append(
      el('span', 'related-title', rb.title),
      el('span', 'related-author', 'by ' + rb.author),
      foot,
      el('span', 'related-hop', `${rec.distance} hop${rec.distance === 1 ? '' : 's'} away`)
    );
    grid.appendChild(card);
  });
  if (shown === 0) grid.appendChild(el('p', 'muted', 'No related books yet — add more books to the library.'));
  section.appendChild(grid);
  body.appendChild(section);

  // Actions
  const actions = el('div', 'detail-actions');
  const editBtn = el('button', 'btn btn-secondary', '✏️ Edit');
  editBtn.type = 'button';
  editBtn.onclick = () => { closeModal('#detail-modal'); openFormModal(book.id, true); };
  const delBtn = el('button', 'btn btn-danger', '🗑️ Delete');
  delBtn.type = 'button';
  delBtn.onclick = () => { closeModal('#detail-modal'); openConfirmModal(book.id, true); };
  actions.append(editBtn, delBtn);
  body.appendChild(actions);
}

/* ---------- Add / Edit modal ---------- */
function openFormModal(id = null, fromDetail = false) {
  closeCardMenu();
  closeSearchDropdown();
  state.editingId = id;
  state.formReturnToDetail = fromDetail && id !== null;

  const book = id !== null ? state.table.get(id) : null;
  $('#form-title').textContent = book ? 'Edit Book' : 'Add New Book';
  $('#form-submit').textContent = book ? 'Save Changes' : 'Add Book';
  $('#field-title').value = book ? book.title : '';
  $('#field-author').value = book ? book.author : '';
  $('#field-genre').value = book ? book.genre : GENRES[0].name;
  $('#field-rating').value = book ? formatRating(book.rating) : '4.0';
  $('#field-year').value = book ? book.year : new Date().getFullYear();
  $('#field-desc').value = book ? book.description : '';
  $('#form-error').textContent = '';

  openModal('#form-modal');
  setTimeout(() => $('#field-title').focus(), 30);
}

/** Closes the form; if it was opened from the details modal, goes back to it. */
function closeFormModal() {
  closeModal('#form-modal');
  if (state.formReturnToDetail && state.editingId !== null && state.table.get(state.editingId)) {
    openDetailModal(state.editingId);
  }
  state.formReturnToDetail = false;
}

function handleFormSubmit(e) {
  e.preventDefault();
  const fail = (message, selector) => {
    $('#form-error').textContent = message;
    $(selector).focus();
  };

  const title = $('#field-title').value.replace(/\s+/g, ' ').trim();
  const author = $('#field-author').value.replace(/\s+/g, ' ').trim();
  const genre = $('#field-genre').value;
  const rating = parseFloat($('#field-rating').value);
  const year = parseInt($('#field-year').value, 10);
  const description = $('#field-desc').value.trim();
  const maxYear = new Date().getFullYear() + 1;

  if (!title) return fail('Please enter a title.', '#field-title');
  if (!author) return fail('Please enter an author.', '#field-author');
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return fail('Rating must be a number between 0 and 5.', '#field-rating');
  if (!Number.isInteger(year) || year < 1000 || year > maxYear) return fail(`Year must be between 1000 and ${maxYear}.`, '#field-year');

  const key = titleKey(title);
  const clash = state.titles.get(key);                       // O(1) duplicate check
  if (clash !== null && clash !== state.editingId) return fail('A book with this title already exists.', '#field-title');

  const cleanRating = Math.round(rating * 10) / 10;
  let savedId;

  if (state.editingId === null) {
    const book = {
      id: state.nextId, title, author, genre, rating: cleanRating, year,
      description: description || makeDescription(title, author, genre)
    };
    registerBook(book);
    savedId = book.id;
    if (state.query) {                       // a filter would hide the new book -> clear it
      $('#search-input').value = '';
      state.query = '';
      clearTimeout(searchTimer);
      closeSearchDropdown();
    }
    showToast(`“${title}” was added`);
  } else {
    const book = state.table.get(state.editingId);
    if (titleKey(book.title) !== key) state.titles.remove(titleKey(book.title));
    book.title = title;
    book.author = author;
    book.genre = genre;
    book.rating = cleanRating;
    book.year = year;
    book.description = description || makeDescription(title, author, genre);
    state.titles.set(key, book.id);
    savedId = book.id;
    showToast(`“${title}” was updated`);
  }

  rebuildIndexes();
  renderAll();
  state.editingId = savedId;
  closeFormModal();
}

/* ---------- Delete confirmation ---------- */
function openConfirmModal(id, fromDetail = false) {
  const book = state.table.get(id);
  if (!book) return;
  closeCardMenu();
  state.deleteId = id;
  state.confirmReturnToDetail = fromDetail;
  const text = $('#confirm-text');
  text.replaceChildren();
  text.append('You are about to delete ', el('strong', '', `“${book.title}”`), ' by ' + book.author + '. This cannot be undone.');
  openModal('#confirm-modal');
  setTimeout(() => $('#confirm-cancel').focus(), 30);
}

/** Cancels the delete dialog; if it came from the details modal, goes back to it. */
function closeConfirmModal() {
  closeModal('#confirm-modal');
  const id = state.deleteId;
  if (state.confirmReturnToDetail && id !== null && state.table.get(id)) openDetailModal(id);
  state.confirmReturnToDetail = false;
  state.deleteId = null;
}

function confirmDelete() {
  const id = state.deleteId;
  const book = state.table.get(id);
  state.confirmReturnToDetail = false;
  if (!book) { closeModal('#confirm-modal'); return; }

  state.table.remove(id);
  state.titles.remove(titleKey(book.title));
  state.books = state.books.filter((b) => b.id !== id);
  state.deleteId = null;
  state.detailId = null;

  rebuildIndexes();
  renderAll();
  closeModal('#confirm-modal');
  showToast(`“${book.title}” was deleted`, 'info');
}

/* =====================================================================
 * 8. 3-DOTS CARD MENU (one shared floating dropdown, z-index 9999)
 * ===================================================================== */
function toggleCardMenu(button, id) {
  const menu = $('#card-menu');
  if (menu.classList.contains('open') && state.menuId === id) { closeCardMenu(); return; }

  closeSearchDropdown();
  state.menuId = id;
  menu.classList.add('open');

  const rect = button.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const left = Math.min(Math.max(8, rect.right - mw), window.innerWidth - mw - 8);
  let top = rect.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6); // flip above if no room
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function closeCardMenu() {
  $('#card-menu').classList.remove('open');
  state.menuId = null;
}

/* =====================================================================
 * 9. SEARCH (Trie autocomplete + grid filtering)
 * ===================================================================== */
let searchTimer = null;

function normalizeQuery(raw) {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

function appendHighlighted(parent, text, q) {
  const idx = q ? text.toLowerCase().indexOf(q) : -1;
  if (idx < 0) { parent.appendChild(document.createTextNode(text)); return; }
  parent.appendChild(document.createTextNode(text.slice(0, idx)));
  parent.appendChild(el('mark', 'hl', text.slice(idx, idx + q.length)));
  parent.appendChild(document.createTextNode(text.slice(idx + q.length)));
}

function closeSearchDropdown() {
  $('#search-dropdown').classList.remove('open');
  $('#search-input').setAttribute('aria-expanded', 'false');
  state.activeSuggestion = -1;
}

function updateSuggestions() {
  const dropdown = $('#search-dropdown');
  dropdown.replaceChildren();
  state.activeSuggestion = -1;

  if (!state.query) { state.suggestions = []; closeSearchDropdown(); return; }

  const ids = state.trie.search(state.query, 8);            // Trie autocomplete
  state.suggestions = ids;

  if (ids.length === 0) {
    dropdown.appendChild(el('li', 'suggestion empty', 'No matching books'));
  } else {
    ids.forEach((id) => {
      const book = state.table.get(id);
      if (!book) return;
      const li = el('li', 'suggestion');
      li.setAttribute('role', 'option');
      li.onmousedown = (e) => e.preventDefault();           // keep focus in the input
      li.onclick = () => selectSuggestion(id);

      const t = el('div', 'suggestion-title');
      appendHighlighted(t, book.title, state.query);
      const m = el('div', 'suggestion-meta');
      appendHighlighted(m, book.author, state.query);
      m.appendChild(document.createTextNode(` · ${book.genre} · ⭐ ${formatRating(book.rating)}`));
      li.append(t, m);
      dropdown.appendChild(li);
    });
  }
  dropdown.classList.add('open');
  $('#search-input').setAttribute('aria-expanded', 'true');
}

function selectSuggestion(id) {
  const book = state.table.get(id);
  if (!book) return;
  const input = $('#search-input');
  input.value = book.title;
  state.query = normalizeQuery(book.title);
  clearTimeout(searchTimer);
  closeSearchDropdown();
  renderGrid();
  openDetailModal(id);
}

function setActiveSuggestion(index) {
  const items = $('#search-dropdown').querySelectorAll('.suggestion:not(.empty)');
  if (items.length === 0) return;
  state.activeSuggestion = (index + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle('active', i === state.activeSuggestion));
  items[state.activeSuggestion].scrollIntoView({ block: 'nearest' });
}

function handleSearchKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestion(state.activeSuggestion + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestion(state.activeSuggestion - 1); }
  else if (e.key === 'Enter') {
    if (state.activeSuggestion >= 0 && state.suggestions[state.activeSuggestion] !== undefined) {
      e.preventDefault();
      selectSuggestion(state.suggestions[state.activeSuggestion]);
    } else {
      closeSearchDropdown();
    }
  }
}

/* =====================================================================
 * 10. TOASTS
 * ===================================================================== */
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  const toast = el('div', `toast ${type}`);
  toast.append(el('span', '', icons[type] || '✅'), el('span', '', message));
  $('#toast-root').appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* =====================================================================
 * 11. EVENT WIRING
 * ===================================================================== */
function bindEvents() {
  // Sidebar buttons
  $('#btn-add').onclick = () => openFormModal(null);

  $('#btn-generate').onclick = () => {
    const btn = $('#btn-generate');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    setTimeout(() => {                                       // let the label paint first
      const books = generate500Books(state.nextId);
      books.forEach((b) => registerBook(b));
      rebuildIndexes();
      renderAll();
      btn.disabled = false;
      btn.textContent = original;
      showToast('Added 500 new unique books');
    }, 30);
  };

  // Sort dropdown -> custom merge sort
  $('#sort-select').onchange = (e) => {
    const parts = e.target.value.split('-');
    state.sortKey = parts[0];
    state.sortOrder = parts[1];
    renderGrid();
  };

  // Search bar -> Trie
  const input = $('#search-input');
  input.oninput = () => {
    state.query = normalizeQuery(input.value);
    updateSuggestions();                                     // instant autocomplete
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderGrid, 100);               // debounced grid filter
  };
  input.onfocus = () => { if (state.query) updateSuggestions(); };
  input.onkeydown = handleSearchKeydown;

  // 3-dots menu actions
  $('#menu-edit').onclick = () => { const id = state.menuId; closeCardMenu(); if (id !== null) openFormModal(id); };
  $('#menu-delete').onclick = () => { const id = state.menuId; closeCardMenu(); if (id !== null) openConfirmModal(id); };

  // Modal buttons
  $('#detail-close').onclick = () => closeModal('#detail-modal');
  $('#form-close').onclick = closeFormModal;
  $('#form-cancel').onclick = closeFormModal;
  $('#confirm-cancel').onclick = closeConfirmModal;
  $('#confirm-delete').onclick = confirmDelete;
  $('#book-form').onsubmit = handleFormSubmit;

  // Click on the blurred backdrop closes a modal
  $('#detail-modal').onclick = (e) => { if (e.target.id === 'detail-modal') closeModal('#detail-modal'); };
  $('#form-modal').onclick = (e) => { if (e.target.id === 'form-modal') closeFormModal(); };
  $('#confirm-modal').onclick = (e) => { if (e.target.id === 'confirm-modal') closeConfirmModal(); };

  // Click outside closes floating dropdowns
  document.addEventListener('click', (e) => {
    if (!$('#card-menu').contains(e.target)) closeCardMenu();
    if (!$('#search-wrap').contains(e.target)) closeSearchDropdown();
  });
  window.addEventListener('scroll', closeCardMenu, true);
  window.addEventListener('resize', closeCardMenu);

  // Escape closes the top-most layer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isOpen('#confirm-modal')) closeConfirmModal();
    else if (isOpen('#form-modal')) closeFormModal();
    else if (isOpen('#detail-modal')) closeModal('#detail-modal');
    else { closeCardMenu(); closeSearchDropdown(); }
  });
}

/* =====================================================================
 * 12. INIT
 * ===================================================================== */
function init() {
  try {
  // Fill the genre <select> in the Add/Edit form
  const genreSelect = $('#field-genre');
  GENRES.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.name;
    opt.textContent = g.name;
    genreSelect.appendChild(opt);
  });

  $('#field-year').max = new Date().getFullYear() + 1;   // keep HTML limit in sync with validation

  bindEvents();

  generate500Books(state.nextId).forEach((b) => registerBook(b));
  rebuildIndexes();
  renderAll();
  } catch (err) {
    console.error(err);
    showStartupError('Startup error: ' + err.message + ' (open the browser console with F12 for details)');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();