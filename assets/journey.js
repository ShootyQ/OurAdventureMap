'use strict';

const byId = (id) => document.getElementById(id);
const road = byId('road');
const stage = road.querySelector('.road-stage');
const prints = byId('road-prints');
const canvas = byId('route-map');
const opening = road.querySelector('.road-copy');
const itinerary = road.querySelector('.road-itinerary');
const lifeMap = byId('life-map');
const lifeCanvas = byId('life-map-canvas');
const lifePhotos = byId('life-map-photos');
const roadFoot = road.querySelector('.road-foot > span');
// Offsets keep the prints clear of neighboring pins. The dots mark the journal coordinates.
const lifeStops = [
  ['union-college', 'Lincoln, NE', -7.5, 2],
  ['teaching-in-owosso-2010', 'Owosso, MI', 8, 0],
  ['wedding', 'Middletown, CA', 1, 8],
  ['brooklyn-park-home', 'Brooklyn Park, MN', -2, -8],
  ['waco-2018', 'Waco, TX', -3, 4],
  ['pisgah-hike-2021', 'Pisgah, NC', 9, 4],
  ['orlando-2021', 'Orlando, FL', -4, 7],
  ['grand-turk-2024', 'Grand Turk', 3, -6],
  ['seattle-2026', 'Seattle, WA', 5, -7],
];
const roadLink = road.querySelector('.road-foot a');
const compact = matchMedia('(max-width: 740px), (max-height: 555px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const stops = [
  { name: 'Hendersonville', lat: 35.32, lon: -82.46 },
  { name: 'Orlando', lat: 28.54, lon: -81.38 },
  { name: 'Owosso', lat: 43.0, lon: -84.18 },
  { name: 'Lincoln', lat: 40.81, lon: -96.68 },
];
const lifePins = [];
let basemap;
let geography;
let cueMusic;
let openPrint;
let viewedPhotos = [];
let photoIndex = 0;
let readingStops = [];
let activeStop;
const picker = byId('album-index');
const clamp = (n) => Math.max(0, Math.min(1, n));

async function readJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}

function photoButton(photo, caption, className = '', group = [photo]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'print ' + className;
  button.setAttribute('aria-label', 'Enlarge photograph: ' + photo.alt);
  const img = new Image();
  if (photo.width && photo.height) {
    img.width = photo.width;
    img.height = photo.height;
    button.style.setProperty('--photo-ratio', photo.width / photo.height);
  }
  if (!['front','back'].includes(className)) img.loading = 'lazy';
  img.src = photo.src;
  img.alt = photo.alt;
  img.decoding = 'async';
  button.append(img);
  if (caption) {
    const label = document.createElement('span');
    label.textContent = caption;
    button.append(label);
  }
  button.addEventListener('click', () => {
    openPrint = button;
    viewedPhotos = group;
    photoIndex = group.indexOf(photo);
    showPhoto();
    byId('photo-view').showModal();
  });
  return button;
}

function showPhoto() {
  const photo = viewedPhotos[photoIndex];
  byId('full-photo').src = photo.src;
  byId('full-photo').alt = photo.alt;
  byId('full-caption').textContent = photo.caption || photo.alt;
  byId('photo-controls').hidden = viewedPhotos.length < 2;
  byId('photo-count').textContent = (photoIndex + 1) + ' / ' + viewedPhotos.length;
}

function turnPhoto(direction) {
  photoIndex = (photoIndex + direction + viewedPhotos.length) % viewedPhotos.length;
  showPhoto();
}

const viewer = byId('photo-view');
byId('photo-prev').onclick = () => turnPhoto(-1);
byId('photo-next').onclick = () => turnPhoto(1);
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    turnPhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
viewer.querySelector('button').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () => openPrint?.focus({ preventScroll: true }));

function point(lon, lat, w = canvas.clientWidth, h = canvas.clientHeight) {
  const scale = Math.min(h / 23, w / 36);
  return [w * .69 + (lon + 84) * scale * .79, h * .48 - (lat - 36.5) * scale];
}

function buildMap() {
  if (!geography) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const density = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * density);
  canvas.height = Math.round(h * density);
  basemap = document.createElement('canvas');
  basemap.width = canvas.width;
  basemap.height = canvas.height;
  const ctx = basemap.getContext('2d');
  ctx.scale(density, density);
  ctx.fillStyle = '#cddcd3';
  ctx.fillRect(0, 0, w, h);
  paintGeography(ctx, (lon, lat) => point(lon, lat, w, h));
  ctx.fillStyle = '#637966a6';
  ctx.font = 'italic 16px Georgia';
  ctx.fillText('Atlantic Ocean', ...point(-75,32));
  ctx.fillText('Gulf of Mexico', ...point(-89,27));
  ctx.font = '11px Georgia';
  for (const [text,lon,lat] of [['M I C H I G A N',-87,44.8],['F L O R I D A',-82,27.3],['V I R G I N I A',-81,37.4],['K E N T U C K Y',-87,37.6],['I O W A',-94,42.2]]) {
    ctx.fillText(text,...point(lon,lat));
  }
  const wash = ctx.createLinearGradient(0, 0, w, 0);
  wash.addColorStop(.04, '#f6efdd');
  wash.addColorStop(.29, '#f6efddf5');
  wash.addColorStop(.46, '#f6efddbc');
  wash.addColorStop(.77, '#f6efdd15');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function paintGeography(ctx, project) {
  function trace(coords) {
    coords.forEach(([lon, lat], index) => {
      const [x,y] = project(lon, lat);
      if (index === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
  }
  const [world, states] = geography;
  ctx.fillStyle = '#e9e7d6';
  ctx.strokeStyle = '#a5b4a3';
  ctx.lineWidth = 1;
  for (const { geometry } of world.features) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      polygon.forEach(ring => { trace(ring); ctx.closePath(); });
      ctx.fill('evenodd');
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#b6b9a4';
  ctx.beginPath();
  states.coordinates.forEach(trace);
  ctx.stroke();
  ctx.strokeStyle = '#84988638';
  ctx.lineWidth = .7;
  ctx.beginPath();
  for (let lon = -165; lon < -40; lon += 5) trace([[lon,10],[lon,70]]);
  for (let lat = 10; lat < 70; lat += 5) trace([[-165,lat],[-40,lat]]);
  ctx.stroke();
}

function overviewPoint(lon, lat) {
  return [(lon + 132) / 68, (54 - lat) / 38];
}

function buildLifeMap() {
  if (!geography) return;
  const w = lifeCanvas.clientWidth;
  const h = lifeCanvas.clientHeight;
  if (!w || !h) return;
  const density = Math.min(devicePixelRatio || 1, 2);
  lifeCanvas.width = Math.round(w * density);
  lifeCanvas.height = Math.round(h * density);
  const ctx = lifeCanvas.getContext('2d');
  ctx.scale(density, density);
  ctx.fillStyle = '#cddcd3';
  ctx.fillRect(0, 0, w, h);
  paintGeography(ctx, (lon, lat) => {
    const [x, y] = overviewPoint(lon, lat);
    return [x * w, y * h];
  });
  ctx.beginPath();
  for (const [x, y, photoX, photoY] of lifePins) {
    ctx.moveTo(x * w, y * h);
    ctx.lineTo(photoX * w, photoY * h);
  }
  ctx.strokeStyle = '#a85136';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function addLifePhotos(entries) {
  for (const [id, label, offsetX, offsetY] of lifeStops) {
    const place = entries.find(memory => memory.id === id);
    const photo = place?.photos?.[0];
    if (!photo || !place.coordinates) continue;
    const [lat, lon] = place.coordinates;
    const [x, y] = overviewPoint(lon, lat);
    const photoX = x + offsetX / 100;
    const photoY = y + offsetY / 100;
    lifePins.push([x, y, photoX, photoY]);
    const marker = node('div', 'life-map-marker');
    marker.dataset.memory = id;
    marker.style.setProperty('--pin-x', x * 100 + '%');
    marker.style.setProperty('--pin-y', y * 100 + '%');
    marker.style.setProperty('--photo-x', photoX * 100 + '%');
    marker.style.setProperty('--photo-y', photoY * 100 + '%');
    const button = photoButton(photo, label, 'life-print', place.photos);
    button.setAttribute('aria-label', label + ' · ' + photo.alt);
    marker.append(button);
    lifePhotos.append(marker);
  }
}

function drawRoute(progress) {
  if (!basemap) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(basemap,0,0);
  ctx.scale(canvas.width / canvas.clientWidth, canvas.height / canvas.clientHeight);
  const pins = stops.map(stop => point(stop.lon,stop.lat));
  const legs = [[0,1,-24],[1,0,22],[0,2,16],[2,3,-18]];
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a9523e';
  ctx.setLineDash([5,4]);
  legs.forEach(([from,to,bend], i) => {
    const fraction = clamp(progress * 4 - i);
    if (!fraction) return;
    const [x,y] = pins[from];
    const [dx,dy] = [pins[to][0]-x, pins[to][1]-y];
    ctx.beginPath();
    ctx.moveTo(x,y);
    for (let n=1; n<=32; n++) {
      const t = fraction*n/32;
      ctx.lineTo(x+t*dx + bend*Math.sin(t*Math.PI), y+t*dy);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  pins.forEach(([x,y], i) => {
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fillStyle='#984d36'; ctx.fill();
    ctx.fillStyle='#344c41'; ctx.font='600 14px Georgia';
    ctx.fillText(stops[i].name,x+9,y-6);
  });
}

let pending = false;
function renderCover(bar) {
  const travel = road.offsetHeight - stage.offsetHeight;
  const progress = compact.matches ? 0 : clamp((bar-road.getBoundingClientRect().top)/Math.max(1,travel));
  const cut = Number(progress > .48);
  const coverOpacity = reduced.matches ? 1-cut : 1-clamp((progress-.12)/.25);
  const routeOpacity = compact.matches ? 1 : reduced.matches ? cut : clamp((progress-.37)/.24);
  opening.style.opacity = coverOpacity;
  opening.inert = coverOpacity === 0;
  itinerary.style.opacity = routeOpacity;
  itinerary.style.visibility = routeOpacity > 0 ? 'visible' : 'hidden';
  itinerary.inert = routeOpacity < .5;
  canvas.style.opacity = compact.matches ? 1 : 1 - routeOpacity;
  lifeMap.style.opacity = routeOpacity;
  lifeMap.style.visibility = routeOpacity > 0 ? 'visible' : 'hidden';
  lifeMap.inert = itinerary.inert;
  prints.style.opacity = compact.matches ? 1 : 1 - routeOpacity;
  prints.inert = !compact.matches && routeOpacity >= .5;
  const overviewVisible = routeOpacity >= .5;
  roadFoot.hidden = overviewVisible;
  const destination = overviewVisible ? '#year-2007' : '#road-route';
  if (roadLink.hash !== destination) {
    roadLink.hash = destination;
    roadLink.textContent = overviewVisible ? 'Begin in Lincoln ↓' : 'Explore our story ↓';
  }
  const [pinX,pinY] = point(stops[0].lon,stops[0].lat);
  const t = reduced.matches ? cut : progress;
  const shiftX = (pinX - stage.clientWidth * .61 - prints.offsetWidth * .23)*t;
  const shiftY = (pinY - stage.clientHeight * .48 + 35)*t;
  prints.style.transformOrigin = '0 0';
  prints.style.transform = compact.matches ? '' : 'translate('+shiftX+'px,'+shiftY+'px) scale('+(1-.73*t)+')';
  drawRoute(compact.matches ? 1 : reduced.matches ? cut : progress);
}

function render() {
  pending = false;
  const bar = document.querySelector('.folio-bar').offsetHeight;
  if (road.getBoundingClientRect().bottom > 0) renderCover(bar);
  const trigger = bar + Math.min(innerHeight * .19, 140);
  // In a two-column spread, follow the left memory first and the right halfway down.
  let low = 0, high = readingStops.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const row = readingStops[mid].row;
    const bounds = row.getBoundingClientRect();
    const previous = row.previousElementSibling;
    const rightColumn = row.classList.contains('album-memory') &&
      previous?.getBoundingClientRect().top === bounds.top;
    const start = bounds.top + (rightColumn ? bounds.height / 2 : 0);
    if (start <= trigger) low = mid + 1;
    else high = mid;
  }
  const stop = readingStops[Math.max(0, low - 1)];
  if (!stop || stop === activeStop) return;
  activeStop = stop;
  picker.value = stop.chapter;
  mapToggle.hidden = ['someday', 'letter'].includes(stop.chapter);
  for (const link of document.querySelectorAll('.folio-bar nav a')) {
    if (link.hash === '#' + stop.row.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  if (stop.place) cueMusic?.(stop.place);
  if (mapDialog.open && !compact.matches) {
    if (stop.chapter === 'someday' || stop.chapter === 'letter') mapDialog.close();
    else updatePlace(stop.place);
  }
}
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}
window.addEventListener('scroll',schedule,{passive:true});
new ResizeObserver(() => { buildMap(); schedule(); }).observe(stage);
new ResizeObserver(buildLifeMap).observe(lifeMap);
reduced.addEventListener('change',schedule);

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

const geographyReady = Promise.all([readJson('data/world.geojson'), readJson('data/us-state-borders.geojson')])
  .then(data => { geography = data; buildMap(); buildLifeMap(); schedule(); })
  .catch(() => { canvas.hidden = true; });

const mapDialog = byId('place-view');
const mapToggle = byId('follow-map');
let atlas, pin, mappedPlace;

function showPlace(place) {
  if (!place) return;
  if (!mapDialog.open) {
    if (compact.matches) mapDialog.showModal();
    else mapDialog.show();
  }
  mapToggle.setAttribute('aria-expanded', 'true');
  updatePlace(place);
}

async function updatePlace(place) {
  if (!place) return;
  mappedPlace = place;
  byId('place-name').textContent = place.title;
  byId('place-location').textContent = place.place || (place.coordinates ? '' : 'Location unrecorded');
  byId('album-map').hidden = !place.coordinates;
  if (!place.coordinates) return;
  await geographyReady;
  if (!mapDialog.open || mappedPlace !== place) return;
  if (!geography) {
    byId('album-map').hidden = true;
    byId('map-error').hidden = false;
    return;
  }
  if (!atlas) {
    atlas = createAtlas('album-map', geography[0], {center:place.coordinates, zoom:5});
    L.geoJSON(geography[1], {interactive: false, style: {color:'#aaa991',weight:1}}).addTo(atlas);
    pin = L.circleMarker(place.coordinates, {radius:7, color:'#fff9e8', weight:2, fillColor:'#a85136', fillOpacity:1}).addTo(atlas);
  }
  atlas.invalidateSize();
  atlas.setView(place.coordinates, 5, {animate:false});
  pin.setLatLng(place.coordinates).bringToFront();
}

mapToggle.onclick = () => {
  if (mapDialog.open) mapDialog.close();
  else showPlace(activeStop?.place);
};
mapDialog.addEventListener('close', () => mapToggle.setAttribute('aria-expanded', 'false'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mapDialog.open && !viewer.open) mapDialog.close();
});
compact.addEventListener('change', () => { if (mapDialog.open) mapDialog.close(); });

function locationLabel(place) {
  const label = place.place || 'View on map';
  if (!place.coordinates) return node('span', '', place.place);
  const button = node('button', 'album-location', label);
  button.type = 'button';
  button.setAttribute('aria-label', 'Show ' + label + ' on the map');
  button.onclick = () => showPlace(place);
  return button;
}

function memoryCard(place) {
  const card = node('article', 'album-memory');
  card.id = place.id;
  const photos = place.photos || [];
  if (place.featured) card.classList.add('milestone-spread');
  const copy = node('div', 'memory-copy');
  if (displayDate(place)) copy.append(node('p', 'dateline', displayDate(place)));
  copy.append(node('h3', '', place.title));
  if (place.place || place.coordinates) copy.append(locationLabel(place));
  if (place.story) copy.append(node('p', 'memory-story', place.story));
  if (place.note) copy.append(node('p', 'inscription', place.note));
  card.append(copy);
  if (place.id === 'orlando-road-trip') {
    const link = node('a', 'text-link', 'Revisit the drive ↑');
    link.href = '#road';
    copy.append(link);
  }
  if (photos.length) {
    const gallery = node('div', 'album-photos');
    if (photos.length === 1) gallery.classList.add('single-print');
    for (const photo of photos) gallery.append(photoButton(photo, photo.caption, '', photos));
    card.append(gallery);
  }
  return card;
}

const chapterNames = {
  2007:'When we were friends.', 2008:'The roommate connection.', 2009:'Coffee now and then.',
  2010:'Back in Lincoln.', 2011:'A little closer.',
  2012:'The miles between us.', 2013:'She said yes.', 2014:'Just married.',
  2015:'North to Minnesota.', 2016:'A home of our own.', 2017:'Room for one more.',
  2018:'Hello, Violet.', 2019:'Her first candle.', 2020:'Close to home.',
  2021:'A summer with our girl.', 2022:'Hello, Max and Ellie.', 2023:'Ten years married.',
  2024:'Out to sea.', 2025:'Days worth celebrating.', 2026:'Everywhere with you.'
};

function createChapter(year, introductions) {
  const chapter = node('section', 'album-chapter');
  const dated = year !== '9999';
  chapter.id = dated ? 'year-' + year : 'little-things';
  const head = node('header', 'chapter-head album-inner');
  const title = node('h2', '', chapterNames[year] || (dated ? year : 'The little things.'));
  title.id = chapter.id + '-title';
  chapter.setAttribute('aria-labelledby', title.id);
  const titleBlock = node('div');
  if (dated && chapterNames[year]) titleBlock.append(node('p', 'chapter-year-mark', year));
  titleBlock.append(title);
  const intro = node('div', 'chapter-prose');
  for (const line of introductions || []) intro.append(node('p', '', line));
  head.append(titleBlock, intro);
  chapter.append(head);
  picker.add(new Option(dated ? year : 'Little things', chapter.id));
  byId('album').append(chapter);
  return chapter;
}

function addClosing(journal) {
  const dreams = journal.places.filter(place => place.type === 'dream');
  if (dreams.length) {
    const section = byId('someday');
    section.hidden = false;
    for (const place of dreams) {
      const item = node('article');
      item.id = place.id;
      if (place.dateLabel) item.append(node('p', 'dateline', place.dateLabel));
      item.append(node('h3', '', place.title));
      if (place.place || place.coordinates) item.append(locationLabel(place));
      if (place.story) item.append(node('p', '', place.story));
      if (place.note) item.append(node('p', 'inscription', place.note));
      for (const photo of place.photos || []) item.append(photoButton(photo, photo.caption, '', place.photos));
      byId('dreams').append(item);
    }
    picker.add(new Option('Someday', section.id));
    readingStops.push({chapter:section.id, row:section, place:readingStops.at(-1).place});
  }
  if (journal.letter?.length) {
    const section = byId('letter');
    section.hidden = false;
    const [salutation, ...lines] = journal.letter;
    byId('letter-heading').textContent = salutation;
    for (const line of lines) byId('letter-paragraphs').append(node('p', '', line));
    picker.add(new Option('The letter', section.id));
    readingStops.push({chapter:section.id, row:section, place:readingStops.at(-1).place});
  }
}

async function loadJournal() {
  const journal = await readJson('data/journal.json');
  const entries = journal.places.filter(place => !['dream','secret'].includes(place.type))
    .sort((a,b) => sortDate(a).localeCompare(sortDate(b)));
  addLifePhotos(entries);
  buildLifeMap();
  const trip = entries.find(place => place.id === 'orlando-road-trip');
  const covers = trip?.photos || [];
  for (const [i, photo] of covers.slice(0,2).entries()) {
    prints.append(photoButton(photo, i ? 'Our spring break, 2011' : 'On the road', i ? 'front' : 'back', covers));
  }
  readingStops.push({chapter:'road', row:road, place:trip});
  const dateScene = byId('lincoln');
  const weddingScene = byId('wedding');
  dateScene.remove();
  weddingScene.remove();
  let year, chapter, spread;
  for (const place of entries) {
    const nextYear = sortDate(place).slice(0, 4);
    if (nextYear !== year) {
      year = nextYear;
      chapter = createChapter(year, journal.chapterIntroductions?.[year]);
      readingStops.push({chapter:chapter.id, row:chapter, place});
      spread = null;
    }
    let row;
    const photos = place.photos || [];
    if (place.id === 'started-dating' || place.id === 'wedding') {
      const firstDate = place.id === 'started-dating';
      row = firstDate ? dateScene : weddingScene;
      chapter.append(row);
      row.querySelector('.dateline span').replaceWith(locationLabel(place));
      if (firstDate) {
        byId('date-story').textContent = place.story || '';
      } else {
        for (const paragraph of (place.story || '').split('\n\n').filter(Boolean)) {
          byId('wedding-story').append(node('p', '', paragraph));
        }
      }
      photos.forEach((photo,i) => {
        const host = firstDate ? 'date-print' : i < 2 ? 'ceremony' : 'wedding-prints';
        byId(host).append(photoButton(photo, photo.caption, '', photos));
      });
      spread = null;
    } else {
      if (!spread || place.featured) {
        spread = node('div', 'album-spread album-inner');
        chapter.append(spread);
      }
      row = memoryCard(place);
      spread.append(row);
      if (place.featured) spread = null;
    }
    readingStops.push({chapter:chapter.id, row, place});
  }
  addClosing(journal);
  mapToggle.hidden = false;
  cueMusic = initStoryMusic(journal.soundtrack, entries.map(place => ({place})), journal.spotifyPlaylistUrl);
  const target = byId(location.hash.slice(1));
  if (target) {
    await document.fonts.ready;
    if (target.id === location.hash.slice(1)) target.scrollIntoView({behavior:'instant'});
  }
  schedule();
}

picker.addEventListener('change', () => {
  const target = byId(picker.value);
  if (target) {
    history.pushState(null, '', '#' + target.id);
    target.scrollIntoView({behavior:'instant'});
    schedule();
  }
});
loadJournal().catch(() => { byId('journey-error').hidden = false; });
