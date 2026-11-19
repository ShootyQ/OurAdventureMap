'use strict';

const byId = (id) => document.getElementById(id);
const road = byId('road');
const stage = road.querySelector('.road-stage');
const prints = byId('road-prints');
const canvas = byId('route-map');
const opening = road.querySelector('.road-copy');
const itinerary = road.querySelector('.road-itinerary');
const roadLink = road.querySelector('.road-foot a');
const compact = matchMedia('(max-width: 740px), (max-height: 555px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const stops = [
  { name: 'Hendersonville', lat: 35.32, lon: -82.46 },
  { name: 'Orlando', lat: 28.54, lon: -81.38 },
  { name: 'Owosso', lat: 43.0, lon: -84.18 },
  { name: 'Lincoln', lat: 40.81, lon: -96.68 },
];
let basemap;
let geography;
let cueMusic;
let openPrint;
const clamp = (n) => Math.max(0, Math.min(1, n));

async function readJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}

function photoButton(photo, caption, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'print ' + className;
  button.setAttribute('aria-label', 'Enlarge photograph: ' + photo.alt);
  const img = new Image(photo.width, photo.height);
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
    byId('full-photo').src = photo.src;
    byId('full-photo').alt = photo.alt;
    byId('full-caption').textContent = caption || photo.caption || photo.alt;
    byId('photo-view').showModal();
  });
  return button;
}

const viewer = byId('photo-view');
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
  function trace(coords) {
    coords.forEach(([lon, lat], index) => {
      const [x,y] = point(lon, lat, w, h);
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
function render() {
  pending = false;
  const bar = document.querySelector('.folio-bar').offsetHeight;
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
  const destination = progress > .9 ? '#lincoln' : '#road-route';
  if (roadLink.hash !== destination) {
    roadLink.hash = destination;
    roadLink.textContent = progress > .9 ? 'Continue to Lincoln ↓' : 'Follow the drive ↓';
  }
  const [pinX,pinY] = point(stops[0].lon,stops[0].lat);
  const t = reduced.matches ? cut : progress;
  const shiftX = (pinX - stage.clientWidth * .61 - prints.offsetWidth * .23)*t;
  const shiftY = (pinY - stage.clientHeight * .48 + 35)*t;
  prints.style.transformOrigin = '0 0';
  prints.style.transform = compact.matches ? '' : 'translate('+shiftX+'px,'+shiftY+'px) scale('+(1-.73*t)+')';
  drawRoute(compact.matches ? 1 : reduced.matches ? cut : progress);
  const trigger = bar + window.innerHeight * .42;
  let current = 'road';
  for (const id of ['lincoln','wedding']) {
    if (byId(id).getBoundingClientRect().top <= trigger) current = id;
  }
  for (const link of document.querySelectorAll('.folio-bar nav a')) {
    if (link.hash === '#'+current) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
  const memory = {road:'orlando-road-trip', lincoln:'started-dating', wedding:'wedding'};
  cueMusic?.({id:memory[current]});
}
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}
window.addEventListener('scroll',schedule,{passive:true});
new ResizeObserver(() => { buildMap(); schedule(); }).observe(stage);
reduced.addEventListener('change',schedule);

async function loadJournal() {
  const journal = await readJson('data/journal.json');
  const steps = ['orlando-road-trip','started-dating','wedding'].map(id => ({
    place: journal.places.find(entry => entry.id === id)
  }));
  const [trip, date, wedding] = steps.map(step => step.place);
  prints.append(photoButton(trip.photos[0], 'On the road', 'back'), photoButton(trip.photos[1], 'Our spring break, 2011', 'front'));
  byId('date-print').append(photoButton(date.photos[0],'Our first date in Lincoln'));
  byId('date-story').textContent = date.story;
  byId('wedding-story').textContent = wedding.story;
  const [vows, kiss, ...portraits] = wedding.photos;
  byId('ceremony').append(photoButton(vows),photoButton(kiss));
  byId('wedding-prints').append(...portraits.map(photo => photoButton(photo)));
  cueMusic = initStoryMusic(journal.soundtrack,steps,journal.spotifyPlaylistUrl);
  schedule();
}
loadJournal().catch(() => { byId('journey-error').hidden = false; });
Promise.all([readJson('data/world.geojson'),readJson('data/us-state-borders.geojson')])
  .then(data => { geography = data; buildMap(); schedule(); })
  .catch(() => { canvas.hidden = true; });
