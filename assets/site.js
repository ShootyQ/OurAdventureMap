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
let mappedPlaces = [];

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
  return place.sample ? 'Sample entry' : place.dateLabel || formatDate(place.date);
}

function openMemory(place, photoIndex = 0) {
  activePlace = place;
  byId('memory-type').textContent = types[place.type].label;
  byId('memory-title').textContent = place.title;
  byId('memory-meta').textContent = [place.place, displayDate(place)].filter(Boolean).join(' · ');
  byId('memory-story').textContent = place.story || '';
  byId('memory-story').hidden = !place.story;
  byId('memory-note').textContent = place.note || '';
  byId('memory-note').hidden = !place.note;
  byId('memory-map').hidden = !place.coordinates || (!map && !byId('timeline-list'));
  const photos = place.photos || [];
  byId('gallery-controls')?.remove();
  gallery.replaceChildren(...photos.map((photo, index) => {
    const figure = element('figure');
    const image = element('img');
    image.decoding = 'async';
    if (index > 0) image.loading = 'lazy';
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
  gallery.scrollLeft = photoIndex * (gallery.clientWidth + 12);
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
  markers.get(place.coordinates.join(',')).getElement()?.focus({ preventScroll: true });
}

function mapLink(place) {
  return './?memory=' + encodeURIComponent(place.id) + '#map-section';
}

byId('memory-map').addEventListener('click', () => {
  if (map) viewOnMap(activePlace);
  else window.location.assign(mapLink(activePlace));
});

function memoryButton(place) {
  const count = place.photos?.length || 0;
  const label = count ? `Open memory · ${count} ${count === 1 ? 'photo' : 'photos'}` : 'Open memory';
  const button = element('button', label, 'text-button');
  button.type = 'button';
  button.setAttribute('aria-label', `${label}: ${place.title}`);
  button.addEventListener('click', () => openMemory(place));
  return button;
}

function storyPhotos(place, observer) {
  const photos = element('div', '', 'story-photos');
  for (const [index, photo] of place.photos.slice(0, 2).entries()) {
    const frame = element('figure', '', 'story-print');
    const button = element('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Open photo ${index + 1}: ${photo.alt || place.title}`);
    const image = element('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = photo.alt || '';
    image.src = photo.src;
    button.append(image);
    button.addEventListener('click', () => openMemory(place, index));
    frame.append(button);
    if (photo.caption) frame.append(element('figcaption', photo.caption));
    photos.append(frame);
    observer?.observe(frame);
  }
  return photos;
}

function renderTimeline(places) {
  const timeline = byId('timeline-list');
  const picker = byId('chapter-picker');
  const entries = places.filter(({ type }) => type !== 'dream' && type !== 'secret');
  const sortDate = (place) => place.sortDate || place.date || '9999';
  entries.sort((first, second) => sortDate(first).localeCompare(sortDate(second)));
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((changes) => {
      for (const change of changes) {
        if (!change.isIntersecting) continue;
        if (!motion.matches) change.target.classList.add('photo-arrived');
        observer.unobserve(change.target);
      }
    }, { threshold: 0.18 })
    : null;
  let currentYear;
  let list;
  for (const place of entries) {
    const year = sortDate(place).slice(0, 4);
    if (year !== currentYear) {
      currentYear = year;
      const chapter = element('section', '', 'story-chapter');
      chapter.id = year === '9999' ? 'little-things' : 'year-' + year;
      const label = year === '9999' ? 'Little things' : year;
      const heading = element('h2', label, 'chapter-year');
      heading.id = chapter.id + '-title';
      chapter.setAttribute('aria-labelledby', heading.id);
      list = element('ol', '', 'story-list');
      chapter.append(heading, list);
      timeline.append(chapter);
      picker.add(new Option(label, chapter.id));
    }
    const row = element('li', '', 'story-entry');
    const copy = element('div', '', 'story-entry-copy');
    const date = element(!place.sample && place.date ? 'time' : 'span', displayDate(place), 'entry-place');
    if (date.tagName === 'TIME') date.dateTime = place.date;
    if (date.textContent) copy.append(date);
    copy.append(element('h3', place.title));
    if (place.place) copy.append(element('p', place.place, 'story-location'));
    if (place.story) copy.append(element('p', place.story, 'story-excerpt'));
    if (place.note) copy.append(element('p', place.note, 'handwritten'));
    const actions = element('div', '', 'story-actions');
    if (place.photos?.length) actions.append(memoryButton(place));
    if (place.coordinates) {
      const link = element('a', 'Find on the map →');
      link.href = mapLink(place);
      actions.append(link);
    }
    if (actions.children.length) copy.append(actions);
    row.append(copy);
    if (place.photos?.length) row.append(storyPhotos(place, observer));
    list.append(row);
  }
  byId('story-message').hidden = entries.length > 0;
  byId('story-message').textContent = 'The story is waiting for its first memory.';
  if (picker.options.length > 1) {
    picker.parentElement.hidden = false;
    picker.addEventListener('change', () => byId(picker.value)?.scrollIntoView());
  }
  byId(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
}

function renderJournal({ places, letter }) {
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
  if (!byId('dream-list').children.length) {
    byId('dream-list').append(element('p', 'There’s room here for wherever we dream of going next.'));
  }
  byId('letter-copy').replaceChildren(...letter.map((paragraph) => element('p', paragraph)));
}

function refreshPins() {
  for (const marker of markers.values()) marker.remove();
  markers.clear();
  const groups = new Map();
  for (const place of mappedPlaces) {
    if (!filters.has(place.type)) continue;
    const key = place.coordinates.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(place);
  }
  for (const [key, places] of groups) {
    const [place] = places;
    const type = types[place.type];
    const grouped = places.length > 1;
    const pin = element('div', '', 'map-pin ' + place.type);
    pin.style.setProperty('--pin', type.color);
    pin.append(element('span', grouped ? String(places.length) : type.symbol));
    const title = grouped ? place.place + ' · ' + places.length + ' memories'
      : place.type === 'secret' ? type.label : place.title + (place.sample ? ' (sample)' : '');
    const marker = L.marker(place.coordinates, {
      icon: L.divIcon({ html: pin, className: '', iconSize: [30, 30], iconAnchor: [14, 28] }),
      title,
    });
    marker.on('add', () => marker.getElement().setAttribute('aria-label', title));
    if (grouped) {
      const list = element('div', '', 'pin-memories');
      list.append(element('strong', place.place));
      for (const entry of places) {
        const button = memoryButton(entry);
        button.textContent = entry.title;
        list.append(button);
      }
      marker.bindPopup(list);
    } else {
      marker.on('click', () => openMemory(place));
    }
    marker.addTo(map);
    markers.set(key, marker);
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
  mappedPlaces = journal.places.filter(({ coordinates }) => coordinates);
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
  const storyPage = byId('timeline-list');
  const message = byId(storyPage ? 'story-message' : 'map-message');
  try {
    const journal = await readJson('data/journal.json');
    if (storyPage) {
      renderTimeline(journal.places);
      return;
    }
    renderJournal(journal);
    await initMap(journal);
    message.hidden = true;
    const requested = new URLSearchParams(window.location.search).get('memory');
    const place = mappedPlaces.find(({ id }) => id === requested);
    if (place) viewOnMap(place);
  } catch (error) {
    message.textContent = storyPage ? 'The journal couldn’t be opened.' : 'The atlas couldn’t be opened.';
    console.error(error);
  }
}

start();
