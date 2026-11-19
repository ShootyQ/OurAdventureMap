# Our Adventure Map

A static anniversary journal for Savannah built with HTML, CSS, JavaScript and Leaflet.

## Preview locally

Run `python3 -m http.server 8000` from the repository root and open
`http://localhost:8000`. Serve the directory over HTTP so the browser can load
the journal JSON and the map. The home page opens the continuous album at
`journey.html`. The original atlas and timeline are available at `atlas.html`
and `story.html`. The album groups dated memories by year automatically and
uses `chapterIntroductions` for each year’s opening text.

## Add memories

Edit [data/journal.json](data/journal.json). Copy an entry from `places`, give it
a unique `id` and fill in its title, place, coordinates in latitude–longitude
order, story and optional note. Change `sample` to `false`. Use `YYYY-MM-DD`,
`YYYY-MM` or `YYYY` for dates. Memories without dates appear at the end of the
timeline. Omit `coordinates` to keep a memory on the timeline without assigning
a map pin. For a season or relative date, use `dateLabel` for the wording shown
on the site and `sortDate` to place it in the timeline. Year-only entries
appear after dated entries in that year unless you supply a `sortDate`.
Set `featured` to `true` to give a milestone a highlighted frame in the story.

Choose a `type` from `milestone`, `adventure`, `favorite`, `dream`, or
`secret`. Dream entries appear in the Someday section. To record a completed
dream, change its type to `adventure` and add the date, story and photos. A
secret appears as a small glint on the map and stays out of the timeline.

Put images in `assets/photos/` and add one object per photo, in display order.
Use a relative path without a leading slash, a short alt description, and an
optional caption.

```json
"photos": [
  {
    "src": "assets/photos/example.jpg",
    "alt": "Describe what is visible in this image",
    "caption": "An optional caption"
  }
]
```

Edit `letter` to personalize the closing letter. Set `mapView.center` and
`mapView.zoom` to change where the atlas opens.

## Story music

Set `spotifyPlaylistUrl` in `data/journal.json` to the Spotify playlist Share URL.
Spotify controls the playlist order. To cue a specific recording, add its track
Share URL as `spotifyUrl` in `soundtrack`. The first entry can override the
opening playlist, and a track with a `cue` switches playback at that memory
after music is enabled. Cues advance as you scroll forward. The rest of
`soundtrack` provides links for manual listening.

## Publish

In GitHub, open **Settings → Pages** and select **GitHub Actions** as the
source. The workflow deploys on pushes to `main` and can also be run manually
from the **Actions** tab. Its deployment job reports the live URL.

Treat the journal and its assets as public when publishing to public Pages.
A hidden map pin is a surprise in the interface, and its content is still
readable in the JSON.

The local basemap uses public-domain Natural Earth data from World Atlas.
Leaflet 1.9.4 and its license are in `assets/vendor/`.
