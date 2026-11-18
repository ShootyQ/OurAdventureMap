const types = {
  milestone: { label: 'Milestones', color: '#a16d57', symbol: '✦' },
  adventure: { label: 'Adventures', color: '#486e57', symbol: '▲' },
  favorite: { label: 'Favorite places', color: '#527786', symbol: '•' },
  dream: { label: 'Someday', color: '#927039', symbol: '☆' },
  secret: { label: 'A hidden surprise', color: '#927039', symbol: '✧' },
};

const byId = (id) => document.getElementById(id);
const memory = byId('memory');
const gallery = byId('gallery');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const markers = new Map();
const filters = new Set(Object.keys(types));
let map;
let initialView;
let activePlace;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function formatDate(date) {
  if (!date) return '';
  if (/^\d{4}$/.test(date)) return date;
  const fullDate = date.length === 7 ? date + '-01' : date;
  const options = { year: 'numeric', month: 'long', timeZone: 'UTC' };
  if (date.length === 10) options.day = 'numeric';
  return new Intl.DateTimeFormat('en', options).format(new Date(fullDate + 'T00:00:00Z'));
}

function displayDate(place) {
  return place.sample ? 'Sample entry' : formatDate(place.date);
}

function openMemory(place) {
  activePlace = place;
  byId('memory-type').textContent = types[place.type].label;
  byId('memory-title').textContent = place.title;
  byId('memory-meta').textContent = [place.place, displayDate(place)].filter(Boolean).join(' · ');
  byId('memory-story').textContent = place.story;
  byId('memory-note').textContent = place.note || '';
  byId('memory-map').hidden = !map;
  const photos = place.photos || [];
  byId('gallery-controls')?.remove();
  gallery.replaceChildren(...photos.map((photo) => {
    const figure = element('figure');
    const image = element('img');
    image.src = photo.src;
    image.alt = photo.alt || '';
    image.addEventListener('error', () => {
      image.replaceWith(element('p', 'This photo is unavailable.'));
    });
    figure.append(image);
    if (photo.caption) figure.append(element('figcaption', photo.caption));
    return figure;
  }));
  gallery.hidden = photos.length === 0;
  if (photos.length > 1) addGalleryControls();
  memory.showModal();
  gallery.scrollLeft = 0;
}

function addGalleryControls() {
  const controls = element('div', '', 'gallery-controls');
  controls.id = 'gallery-controls';
  for (const [direction, title] of [[-1, '← Previous photo'], [1, 'Next photo →']]) {
    const button = element('button', title, 'text-button');
    button.type = 'button';
    button.addEventListener('click', () => {
      const index = Math.round(gallery.scrollLeft / (gallery.clientWidth + 12)) + direction;
      gallery.children[index]?.scrollIntoView({
        behavior: motion.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'start',
      });
    });
    controls.append(button);
  }
  gallery.after(controls);
}

function viewOnMap(place) {
  if (!map) return;
  if (memory.open) memory.close();
  filters.add(place.type);
  refreshPins();
  byId('map-section').scrollIntoView({ block: 'center' });
  map.setView(place.coordinates, Math.max(map.getZoom(), 6));
  markers.get(place.id).getElement()?.focus({ preventScroll: true });
}

byId('memory-map').addEventListener('click', () => viewOnMap(activePlace));

function memoryButton(place) {
  const button = element('button', 'Open memory', 'text-button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open memory: ' + place.title);
  button.addEventListener('click', () => openMemory(place));
  return button;
}

function renderJournal({ places, letter }) {
  byId('sample-notice').hidden = !places.some(({ sample }) => sample);
  const entries = places.filter(({ type }) => type !== 'dream' && type !== 'secret');
  entries.sort((first, second) => (first.date || '9999').localeCompare(second.date || '9999'));
  for (const place of entries) {
    const row = element('li');
    const date = element(!place.sample && place.date ? 'time' : 'span', displayDate(place), 'entry-place');
    if (date.tagName === 'TIME') date.dateTime = place.date;
    const title = element('div');
    title.append(element('h3', place.title), element('span', place.place, 'entry-place'));
    row.append(date, title, memoryButton(place));
    byId('timeline-list').append(row);
  }
  for (const place of places.filter(({ type }) => type === 'dream')) {
    const card = element('article');
    const label = [place.place, displayDate(place)].filter(Boolean).join(' · ');
    card.append(element('p', label, 'entry-place'), element('h3', place.title));
    const button = memoryButton(place);
    button.textContent = 'Open adventure';
    button.setAttribute('aria-label', 'Open adventure: ' + place.title);
    card.append(button);
    byId('dream-list').append(card);
  }
  byId('letter-copy').replaceChildren(...letter.map((paragraph) => element('p', paragraph)));
}

function createPin(place) {
  const type = types[place.type];
  const pin = element('div', '', 'map-pin ' + place.type);
  pin.style.setProperty('--pin', type.color);
  pin.append(element('span', type.symbol));
  const title = place.type === 'secret' ? type.label : place.title + (place.sample ? ' (sample)' : '');
  const marker = L.marker(place.coordinates, {
    icon: L.divIcon({ html: pin, className: '', iconSize: [30, 30], iconAnchor: [14, 28] }),
    title,
  });
  marker.on('add', () => marker.getElement().setAttribute('aria-label', title));
  marker.on('click', () => openMemory(place));
  markers.set(place.id, marker);
  marker.journalType = place.type;
}

function refreshPins() {
  for (const marker of markers.values()) {
    if (filters.has(marker.journalType)) marker.addTo(map);
    else marker.remove();
  }
  for (const button of byId('legend').children) {
    button.setAttribute('aria-pressed', String(filters.has(button.dataset.type)));
  }
}

function renderLegend() {
  for (const [key, type] of Object.entries(types)) {
    if (key === 'secret') continue;
    const button = element('button');
    button.type = 'button';
    button.dataset.type = key;
    const dot = element('span', '', 'dot');
    dot.style.setProperty('--pin', type.color);
    button.append(dot, type.label);
    button.addEventListener('click', () => {
      if (filters.has(key)) filters.delete(key);
      else filters.add(key);
      refreshPins();
    });
    byId('legend').append(button);
  }
}

function addAtlasLabels() {
  const labels = [
    ['CANADA', [57, -113]], ['UNITED STATES', [39, -102]], ['MEXICO', [23, -102]],
    ['GREENLAND', [72, -42]], ['SOUTH AMERICA', [-13, -58]], ['EUROPE', [53, 19]],
    ['AFRICA', [12, 21]], ['ASIA', [48, 91]], ['AUSTRALIA', [-25, 135]],
    ['North Atlantic', [43, -42], true], ['North Pacific', [34, -143], true],
    ['South Pacific', [-29, -125], true], ['Indian Ocean', [-20, 79], true],
  ];
  for (const [name, coordinates, ocean] of labels) {
    L.marker(coordinates, {
      interactive: false, keyboard: false, zIndexOffset: -1000,
      icon: L.divIcon({
        html: name, className: 'map-label' + (ocean ? ' ocean' : ''),
        iconSize: [120, 20], iconAnchor: [60, 10],
      }),
    }).addTo(map);
  }
}

function resetMap() {
  const zoom = map.getSize().x < 500 ? Math.min(initialView.zoom, 2) : initialView.zoom;
  map.setView(initialView.center, zoom);
}

async function initMap(journal) {
  const world = await readJson('data/world.geojson');
  initialView = journal.mapView;
  map = L.map('map', {
    minZoom: 2, maxZoom: 9, scrollWheelZoom: false,
    maxBounds: [[-85, -180], [85, 180]], attributionControl: true,
  });
  resetMap();
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://leafletjs.com/">Leaflet</a>');
  L.geoJSON(world, {
    interactive: false,
    style: { color: '#a3ad96', weight: 1, fillColor: '#e5e6ce', fillOpacity: 1 },
  }).addTo(map);
  addAtlasLabels();
  journal.places.forEach(createPin);
  renderLegend();
  refreshPins();
  byId('reset').disabled = false;
  byId('reset').addEventListener('click', resetMap);
}

async function readJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Unable to load ' + path);
  return response.json();
}

async function start() {
  const message = byId('map-message');
  try {
    const journal = await readJson('data/journal.json');
    renderJournal(journal);
    await initMap(journal);
    message.hidden = true;
  } catch (error) {
    message.textContent = 'The atlas couldn’t be opened.';
    console.error(error);
  }
}

start();
