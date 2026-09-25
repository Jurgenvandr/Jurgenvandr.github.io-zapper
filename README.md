# Zapper

Flemish and Dutch live TV channels in one place, with what's on now.

- `index.html`: the app
- `guide.json`: the TV guide (written automatically, don't edit)
- `apple-touch-icon.png`: icon for "Add to Home Screen" on iPhone/iPad
- `epg/zapper.channels.xml`: which channels the guide covers
- `epg/convert.mjs`: turns the downloaded guide into `guide.json`
- `.github/workflows/tv-guide.yml`: runs every day around 05:00 and 16:00 (Belgian time) and updates `guide.json`

The guide is downloaded with the open-source [iptv-org/epg](https://github.com/iptv-org/epg) grabber
(sources: pickx.be for the Belgian channels, tvgids.nl and delta.nl for the Dutch ones).

## Update the guide by hand

Actions tab → "Update TV guide" → Run workflow.
