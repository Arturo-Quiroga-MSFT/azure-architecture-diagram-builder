# Demo videos

Tooling and scripts for the AADB demo video series. Each video is recorded live on the app by a Playwright script, then narrated with Azure AI Speech, scored, captioned and encoded with ffmpeg. A retake is a single command.

How it works, and the lessons learned making the first nine episodes: **[DOCS/DEMO-VIDEO-PRODUCTION.md](../DOCS/DEMO-VIDEO-PRODUCTION.md)**.

```text
demo-videos/
├── engine/            # the shared toolkit (record, narrate, mix, encode)
├── episodes/          # one folder per video: episode.json, narration.json, storyboard.md, scene.mjs, assets/
├── .env.example       # settings template; copy to .env
└── videos/            # finished MP4s, captions and thumbnails (generated, git-ignored)
```

## Setup

Requirements: Node.js 20+, Python 3.10+, ffmpeg, Azure CLI, and an Azure AI Speech resource. Episode 9 also uses Microsoft PowerPoint (macOS) or LibreOffice, plus poppler (`pdftoppm`). Episode 10 uses GitHub Copilot CLI and the packages in `demo-videos/package.json` (node-pty, xterm.js).

```bash
# From the repository root
npm install                                   # provides @playwright/test
npx playwright install chromium

cd demo-videos
npm install                                   # node-pty and xterm.js (Episode 10)
python3 -m venv engine/.venv && engine/.venv/bin/pip install -r engine/requirements.txt
cp .env.example .env                          # set SPEECH_RESOURCE_ID and SPEECH_REGION
az login                                      # narration uses your Entra identity (no keys)
```

Your identity needs the **Cognitive Services Speech User** role on the Speech resource.

## Make a video

```bash
cd demo-videos
engine/run.sh episodes/00-example             # ~25 s smoke test: narrate → record → mix → encode
engine/run.sh episodes/08-deploy-it           # a full episode (3–6 minutes per take)
STEP=mix engine/run.sh episodes/08-deploy-it  # re-mix and re-encode only (e.g. after a music change)
ONLY='n04*' engine/narrate.sh episodes/08-deploy-it   # re-synthesize selected cues
```

Output: `videos/<output>.mp4` (1080p30, −16 LUFS), `videos/captions/<output>.srt`, `videos/thumbnails/<output>.jpg`, and `episodes/<name>/review/contact-sheet.png` for review.

- Change the words: edit `narration.json`; only changed cues are re-synthesized.
- Change the music: set `"music"` in `episode.json` to `drive`, `lift`, `pulse` or `ambient`, then run `STEP=mix`.
- Preview the music presets with narration on top: `engine/.venv/bin/python engine/sample_music.py /tmp/music episodes/08-deploy-it/narr n04-generate n14-close drive lift pulse ambient`.

## Episodes

| Folder | Video | Notes |
| --- | --- | --- |
| `00-example` | Example | Template and smoke test, no AI calls |
| `00-trailer` | Trailer: AADB in 90 Seconds | Cut from the episodes' raw recordings, so film Episodes 1–10 first. `engine/run.sh episodes/00-trailer` narrates, cuts and mixes it |
| `01-prompt-to-architecture` | Prompt to Architecture | |
| `02-whiteboard-and-import` | Whiteboard and Import | Assets: an AI-generated whiteboard photo and a fictional Contoso ARM template |
| `03-refine-with-guided-chat` | Refine with Guided Chat | Starts from the saved clinic booking draft |
| `04-talk-to-your-architecture` | Talk to Your Architecture | Voice Live: seller turns fed to a fake microphone; `assets/seller/generate.sh` re-creates them |
| `05-well-architected-review` | Well-Architected Review | |
| `06-cost-and-regions` | Cost and Regions | |
| `07-compare-models` | Compare Models | Captures the avatar's WebRTC audio (`media_tap`) |
| `08-deploy-it` | Deploy It | Set `WHATIF_RESOURCE_GROUP` (an empty resource group) to show a real `what-if` |
| `09-share-it` | Share It | Renders the deck with PowerPoint (or LibreOffice) and records a diagrams.net session |
| `10-aadb-everywhere-mcp` | AADB Everywhere (MCP) | A real GitHub Copilot CLI session in a pseudo-terminal; needs `AADB_MCP_URL`, `AADB_MCP_KEY`, the `copilot` CLI signed in, and `npm install` in `demo-videos/` |

Model output varies between takes, so narration never quotes AI-generated values: scenes read them from the page and show them in callouts.

## Adapting the toolkit to another web app

Set `AADB_APP_URL` (or `"url"` in an episode's `episode.json`) to the app, then restyle the cards and hide distracting app chrome in `engine/overlay.js`. `engine/showcase.mjs` and the dark-mode settings in `overlay.js` are specific to AADB's canvas. See [Reusing this for another project](../DOCS/DEMO-VIDEO-PRODUCTION.md#reusing-this-for-another-project).
