let spotifyApiRequest;

function loadSpotifyApi() {
  if (!spotifyApiRequest) {
    spotifyApiRequest = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      const timeout = window.setTimeout(fail, 6000);

      function fail() {
        window.clearTimeout(timeout);
        script.remove();
        delete window.onSpotifyIframeApiReady;
        spotifyApiRequest = undefined;
        reject(new Error('Spotify player unavailable'));
      }

      window.onSpotifyIframeApiReady = (api) => {
        window.clearTimeout(timeout);
        delete window.onSpotifyIframeApiReady;
        resolve(api);
      };
      script.addEventListener('error', fail, { once: true });
      document.head.append(script);
    });
  }
  return spotifyApiRequest;
}

function initStoryMusic(tracks, steps, playlistUrl) {
  if (!tracks?.length) return;
  const section = document.getElementById('story-music');
  const toggle = document.getElementById('enable-music');
  const playlist = document.getElementById('story-playlist');
  const player = document.getElementById('story-player');
  const panel = document.getElementById('story-player-panel');
  const trackName = document.getElementById('story-track-name');
  const stop = document.getElementById('stop-story-music');
  const status = document.getElementById('story-music-status');
  const spotifyLink = document.getElementById('story-spotify-link');
  const host = document.getElementById('spotify-player');
  const cues = new Map(tracks.filter((track) => track.cue).map((track) => [track.cue, track]));
  const chapterCues = new Map();
  const openingCue = { track: tracks[0], position: -1 };
  let chapterCue = openingCue;
  for (const [position, { place }] of steps.entries()) {
    const track = cues.get(place.id);
    if (track) chapterCue = { track, position };
    chapterCues.set(place.id, chapterCue);
  }

  function spotifyId(url, type) {
    const share = url?.match(/^https:\/\/open\.spotify\.com\/(track|playlist)\/([a-zA-Z0-9]{22})(?:[?#]|$)/);
    return share?.[1] === type ? share?.[2] : undefined;
  }

  function trackId(track) {
    return spotifyId(track.spotifyUrl, 'track');
  }

  function trackLink(track) {
    const id = trackId(track);
    return id ? 'https://open.spotify.com/track/' + id
      : 'https://open.spotify.com/search/' + encodeURIComponent(track.title + ' ' + track.artist);
  }

  for (const track of tracks) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = trackLink(track);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = track.title + ' · ' + track.artist;
    item.append(link);
    playlist.append(item);
  }

  const playlistId = spotifyId(playlistUrl, 'playlist');
  const playlistLink = document.getElementById('story-spotify-playlist');
  if (playlistId) {
    playlistLink.href = 'https://open.spotify.com/playlist/' + playlistId;
    playlistLink.hidden = false;
  }

  const hasPlayer = playlistId || tracks.some(trackId);
  toggle.textContent = hasPlayer ? 'Enable music' : 'Show music links';

  let enabled = false;
  let visibleCue = openingCue;
  let selectedCue = openingCue;
  let controller;
  let activeUri;
  let revision = 0;

  function disposePlayer() {
    controller?.destroy();
    controller = undefined;
    activeUri = undefined;
    host.replaceChildren();
  }

  async function playSelection() {
    const selected = selectedCue.track;
    const directTrack = trackId(selected);
    const type = directTrack ? 'track' : 'playlist';
    const id = directTrack ?? playlistId;
    spotifyLink.href = directTrack || !playlistId ? trackLink(selected) : playlistLink.href;
    if (!id) {
      trackName.textContent = selected.title;
      revision++;
      disposePlayer();
      status.textContent = selected.title + ' · Open Spotify to play.';
      return;
    }

    const uri = 'spotify:' + type + ':' + id;
    if (uri === activeUri) return;
    const version = ++revision;
    disposePlayer();
    activeUri = uri;
    const label = directTrack ? selected.title : 'Our Spotify playlist';
    const height = directTrack ? 152 : 352;
    trackName.textContent = label;
    status.textContent = 'Press Play below if the music doesn’t start.';

    try {
      const api = await loadSpotifyApi();
      if (!enabled || version !== revision) return;
      const target = document.createElement('div');
      host.replaceChildren(target);
      api.createController(target, { uri, width: '100%', height }, (embed) => {
        if (!enabled || version !== revision) {
          embed.destroy();
          return;
        }
        controller = embed;
        embed.addListener('ready', () => {
          if (enabled && controller === embed) embed.play();
        });
      });
    } catch {
      if (!enabled || version !== revision) return;
      status.textContent = 'Press Play in the Spotify player or open Spotify.';
      const iframe = document.createElement('iframe');
      iframe.title = label;
      iframe.src = 'https://open.spotify.com/embed/' + type + '/' + id;
      iframe.height = height;
      iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      host.replaceChildren(iframe);
    }
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = hasPlayer
      ? (enabled ? 'Turn off music' : 'Enable music')
      : (enabled ? 'Hide music links' : 'Show music links');
    player.hidden = !enabled;
    if (enabled) {
      panel.open = true;
      selectedCue = visibleCue;
      void playSelection();
    } else {
      revision++;
      disposePlayer();
    }
  });
  stop.addEventListener('click', () => toggle.click());
  section.hidden = false;

  return (place) => {
    visibleCue = chapterCues.get(place?.id) ?? openingCue;
    if (!enabled || visibleCue.position <= selectedCue.position) return;
    selectedCue = visibleCue;
    void playSelection();
  };
}
