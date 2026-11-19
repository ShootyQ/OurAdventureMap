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

function sortDate(place) {
  if (place.sortDate) return place.sortDate;
  if (!place.date) return '9999';
  return place.date.length === 4 ? place.date + '-12-31' : place.date;
}

function addAtlasLabels(atlas) {
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
    }).addTo(atlas);
  }
}

function createAtlas(id, world, options = {}) {
  const atlas = L.map(id, {
    minZoom: 2, maxZoom: 9, scrollWheelZoom: false,
    maxBounds: [[-85, -180], [85, 180]], attributionControl: true,
    ...options,
  });
  atlas.attributionControl.setPrefix(false);
  atlas.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://leafletjs.com/">Leaflet</a>');
  L.geoJSON(world, {
    interactive: false,
    style: { color: '#a3ad96', weight: 1, fillColor: '#e5e6ce', fillOpacity: 1 },
  }).addTo(atlas);
  addAtlasLabels(atlas);
  return atlas;
}
