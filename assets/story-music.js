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

function initStoryMusic(tracks, steps) {
  if (!tracks?.length) return;
  const section = document.getElementById('story-music');
  const toggle = document.getElementById('enable-music');
  const playlist = document.getElementById('story-playlist');
  const player = document.getElementById('story-player');
  const status = document.getElementById('story-music-status');
  const spotifyLink = document.getElementById('story-spotify-link');
  const host = document.getElementById('spotify-player');
  const cues = new Map(tracks.filter((track) => track.cue).map((track) => [track.cue, track]));
  const chapterTracks = new Map();
  let chapterTrack = tracks[0];
  for (const { place } of steps) {
    chapterTrack = cues.get(place.id) ?? chapterTrack;
    chapterTracks.set(place.id, chapterTrack);
  }

  function trackId(track) {
    return track.spotifyUrl?.match(/^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]{22})(?:[?#]|$)/)?.[1];
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

  const hasPlayer = tracks.some(trackId);
  toggle.textContent = hasPlayer ? 'Enable music' : 'Show music links';

  let enabled = false;
  let selected = tracks[0];
  let controller;
  let revision = 0;

  function disposePlayer() {
    controller?.destroy();
    controller = undefined;
    host.replaceChildren();
  }

  async function playSelection() {
    const version = ++revision;
    const id = trackId(selected);
    spotifyLink.href = trackLink(selected);
    if (!id) {
      disposePlayer();
      status.textContent = selected.title + ' · Open Spotify to play.';
      return;
    }
    status.textContent = selected.title + ' · Press Play below if it doesn’t start.';
    const uri = 'spotify:track:' + id;
    if (controller) {
      controller.loadUri(uri);
      controller.play();
      return;
    }

    try {
      const api = await loadSpotifyApi();
      if (!enabled || version !== revision) return;
      const target = document.createElement('div');
      host.replaceChildren(target);
      api.createController(target, { uri, width: '100%', height: 152 }, (embed) => {
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
      status.textContent = selected.title + ' · Press Play in the Spotify player or open Spotify.';
      const iframe = document.createElement('iframe');
      iframe.title = 'Spotify player for ' + selected.title;
      iframe.src = 'https://open.spotify.com/embed/track/' + id;
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
      void playSelection();
    } else {
      revision++;
      disposePlayer();
    }
  });
  section.hidden = false;

  return (place) => {
    const next = chapterTracks.get(place?.id) ?? tracks[0];
    if (next === selected) return;
    selected = next;
    if (enabled) void playSelection();
  };
}
