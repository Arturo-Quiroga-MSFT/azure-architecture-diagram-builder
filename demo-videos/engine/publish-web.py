"""Publish the finished episodes for the in-app video tour. Usage: publish-web.py [--dest DIR] [--upload ACCOUNT]

Reads demo-videos/web/catalog.json, each episode's episode.json and out/timeline.json, and the finished
files in $OUTPUT_DIR (<output>.mp4, captions/<output>.srt, thumbnails/<output>.jpg). Writes to DEST
(default: the app's public/media/videos, git-ignored, so `npm run dev` serves it at /media/videos):

  <output>.mp4           web encode: H.264 1080p, CRF 26, AAC 128k, +faststart (streams with range requests)
  <output>.vtt           captions, converted from the SRT
  <output>.chapters.vtt  chapters, timed from the narration cues in the final cut
  <output>.jpg           poster, 960 px wide
  videos.json            manifest the app reads: episodes, chapters, topic deep links, playlists

Internal episodes (episode.json "internal": true) are never published. Unchanged encodes are reused.
--upload ACCOUNT also copies DEST to the blob container (default "videos", --container) with
`az storage blob upload-batch --auth-mode login`: media cached for a day, the manifest for five minutes.
"""
import argparse, json, os, re, subprocess, sys, datetime

ENGINE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ENGINE)
REPO = os.path.dirname(ROOT)
FF = os.environ.get('FFMPEG', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE', 'ffprobe')
SRC = os.environ.get('OUTPUT_DIR', os.path.join(ROOT, 'videos'))
FAST = 6  # must match mix.py


def remapper(tl):
    segs = sorted((s['a'], s['b'], max(FAST, (s['b'] - s['a']) / s['max']) if s.get('max') else FAST) for s in tl.get('ff', []))

    def remap(t):
        out = t
        for a, b, k in segs:
            if t >= b: out -= (b - a) * (1 - 1 / k)
            elif t > a: out -= (t - a) * (1 - 1 / k)
        return out
    return remap


def vtt_ts(s):
    ms = int(round(max(0, s) * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{sec:02}.{ms:03}'


def srt_to_vtt(srt):
    body = re.sub(r'(\d\d:\d\d:\d\d),(\d\d\d)', r'\1.\2', srt.replace('\r', '')).strip()
    return 'WEBVTT\n\n' + body + '\n'


def duration(path):
    return float(subprocess.check_output([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())


def fresh(out, src):
    return os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dest', default=os.path.join(REPO, 'public', 'media', 'videos'))
    ap.add_argument('--upload', metavar='ACCOUNT')
    ap.add_argument('--container', default='videos')
    ap.add_argument('--crf', default='26')
    args = ap.parse_args()
    os.makedirs(args.dest, exist_ok=True)
    cat = json.load(open(os.path.join(ROOT, 'web', 'catalog.json')))
    videos, topics = [], {}
    for item in cat['episodes']:
        d = os.path.join(ROOT, 'episodes', item['dir'])
        ep = json.load(open(os.path.join(d, 'episode.json')))
        if ep.get('internal'):
            print(f"skip {item['dir']}: internal"); continue
        name = ep['output']
        mp4 = os.path.join(SRC, f'{name}.mp4')
        if not os.path.exists(mp4):
            print(f'skip {name}: no {mp4}'); continue
        out = os.path.join(args.dest, f'{name}.mp4')
        if not fresh(out, mp4):
            subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp4, '-c:v', 'libx264', '-preset', 'slow', '-crf', args.crf,
                            '-maxrate', '3500k', '-bufsize', '7000k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
                            '-movflags', '+faststart', out], check=True)
        dur = round(duration(out), 2)
        files = {'src': f'{name}.mp4'}
        srt = os.path.join(SRC, 'captions', f'{name}.srt')
        if os.path.exists(srt):
            open(os.path.join(args.dest, f'{name}.vtt'), 'w').write(srt_to_vtt(open(srt).read())); files['captions'] = f'{name}.vtt'
        thumb = os.path.join(SRC, 'thumbnails', f'{name}.jpg')
        if os.path.exists(thumb):
            poster = os.path.join(args.dest, f'{name}.jpg')
            if not fresh(poster, thumb):
                subprocess.run([FF, '-y', '-loglevel', 'error', '-i', thumb, '-vf', 'scale=960:-2', '-q:v', '4', poster], check=True)
            files['poster'] = f'{name}.jpg'
        tl_path = os.path.join(d, 'out', 'timeline.json')
        tl = json.load(open(tl_path)) if os.path.exists(tl_path) else {}
        remap = remapper(tl)
        cue = {c['name']: remap(c['at']) for c in tl.get('narr', [])}
        chapters = []
        for ch in item.get('chapters', []):
            names = ch['narr'] if isinstance(ch['narr'], list) else [ch['narr']]
            at = next((cue[n] for n in names if n in cue), None)
            if at is None:
                print(f"  {name}: chapter '{ch['title']}' has no cue {names} in this take, skipped"); continue
            c = {'title': ch['title'], 'at': round(max(0.0, at - 0.4), 2)}
            if ch.get('key'): c['key'] = ch['key']; topics[ch['key']] = {'video': item['dir'], 'at': c['at'], 'title': ch['title']}
            chapters.append(c)
        if chapters:
            if chapters[0]['at'] > 3: chapters.insert(0, {'title': 'Introduction', 'at': 0})
            cues = [f"{vtt_ts(c['at'])} --> {vtt_ts(chapters[i + 1]['at'] if i + 1 < len(chapters) else dur)}\n{c['title']}"
                    for i, c in enumerate(chapters)]
            open(os.path.join(args.dest, f'{name}.chapters.vtt'), 'w').write('WEBVTT\n\n' + '\n\n'.join(cues) + '\n')
            files['chapters'] = f'{name}.chapters.vtt'
        videos.append({
            'id': item['dir'], 'badge': ep.get('badge', ''), 'title': ep.get('title', name), 'summary': item.get('summary', ''),
            'duration': dur, 'filmed': item.get('filmed') or tl.get('filmed'), 'appVersion': item.get('appVersion') or tl.get('appVersion'),
            **files, 'chapters': chapters,
        })
        print(f"{name}: {dur:.0f}s, {len(chapters)} chapters, {os.path.getsize(out) / 1e6:.1f} MB")
    ids = {v['id'] for v in videos}
    playlists = [{**p, 'episodes': [e for e in p['episodes'] if e in ids]} for p in cat.get('playlists', [])]
    manifest = {'version': 1, 'title': cat.get('title', ''), 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
                'videos': videos, 'topics': topics, 'playlists': playlists}
    json.dump(manifest, open(os.path.join(args.dest, 'videos.json'), 'w'), indent=1)
    total = sum(os.path.getsize(os.path.join(args.dest, f)) for f in os.listdir(args.dest))
    print(f'videos.json: {len(videos)} videos, {len(topics)} topics, {total / 1e6:.0f} MB in {args.dest}')
    if args.upload:
        base = ['az', 'storage', 'blob', 'upload-batch', '--auth-mode', 'login', '--account-name', args.upload,
                '--destination', args.container, '--source', args.dest, '--overwrite', '--only-show-errors', '--output', 'none']
        for pattern, ctype, cache in (('*.mp4', 'video/mp4', 'public, max-age=86400'), ('*.jpg', 'image/jpeg', 'public, max-age=86400'),
                                      ('*.vtt', 'text/vtt', 'public, max-age=86400'), ('videos.json', 'application/json', 'public, max-age=300')):
            subprocess.run(base + ['--pattern', pattern, '--content-type', ctype, '--content-cache-control', cache], check=True)
        print(f'uploaded to {args.upload}/{args.container}')


if __name__ == '__main__':
    sys.exit(main())
