#!/usr/bin/env python3
# Packs the recorded sounds into the game.
#
#   python3 tools/pack_sfx.py
#
# Reads the cut recordings in sfx_src/cut/ (kept out of git: they come from Pixabay, whose licence
# lets them be used inside a game but not handed out on their own), squeezes each into a small MP3,
# and writes src/10a_samples.js, which holds them as text inside the page. The game decodes them
# once, when sound is first switched on.
#
# Each entry: the file, its bitrate, mono or stereo, and marks (seconds into the sound) that the
# game uses to line things up: where a bolt's clicks fall, where a magazine seats, where a hit peaks.
import base64, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'sfx_src', 'cut')
OUT = os.path.join(ROOT, 'src', '10a_samples.js')

SOUNDS = [
    # name, kbps, channels, marks, where it came from
    ('shot_m24', 128, 1, {'peak': 0.018}, 'Pixabay, freesound_community "071817 sniper rifle M24": the shot'),
    ('shot_barrett50', 128, 1, {'peak': 0.004}, 'Pixabay, adhimahadi "Barrett 50 cal slow mo": from the bang on'),
    ('shot_ar15', 128, 1, {'peak': 0.012}, 'Pixabay, jigokukarano_sisya "AR15": the single shot'),
    ('shot_suppressed', 128, 1, {'peak': 0.009}, 'Pixabay, freesound_community "silenced sniper rifle": second take'),
    ('shot_suppressed_alt', 128, 1, {'peak': 0.012}, 'Pixabay, freesound_community "silenced sniper rifle": first take'),
    ('bolt_m24', 112, 1, {'on': [0.075, 0.21, 0.408, 0.642, 0.876], 'cut': [0.0, 0.19, 0.39, 0.62, 0.85]}, 'Pixabay, freesound_community "071817 sniper rifle M24": the bolt worked'),
    ('reload_magout', 112, 1, {'click': 0.189}, 'Pixabay, jigokukarano_sisya "AR15": magazine out'),
    ('reload_magin', 112, 1, {'seat': 0.483}, 'Pixabay, jigokukarano_sisya "AR15": magazine in'),
    ('reload_charge', 112, 1, {'slap': 0.063}, 'Pixabay, jigokukarano_sisya "AR15": charging handle'),
    ('hit_body', 128, 1, {'peak': 0.036}, 'Pixabay, u_68csiaifb5 "bullet impact 3": the impact'),
    ('hit_body_whiz', 112, 1, {'peak': 0.151}, 'Pixabay, u_68csiaifb5 "bullet impact 3": with the whiz in'),
    ('ricochet_metal', 128, 1, {'peak': 0.054, 'on': 0.012}, 'Pixabay, kebabus16 "bullet ricochet on a metal surface 3"'),
    ('glass', 112, 1, {'peak': 0.021}, 'Pixabay, dragon-studio "glass shattering": second break'),
    ('explosion', 96, 1, {'peak': 0.033}, 'Pixabay, freesound_community "explosion"'),
    ('thunder_close', 96, 1, {'peak': 0.09}, 'Pixabay, u_q2hb2391vb "thunder clap"'),
    ('thunder_mid', 80, 1, {}, 'Pixabay, dragon-studio "dry thunder": a nearer roll'),
    ('thunder_far_a', 64, 1, {}, 'Pixabay, dragon-studio "dry thunder": far roll'),
    ('thunder_far_b', 64, 1, {}, 'Pixabay, dragon-studio "dry thunder": far roll'),
    ('thunder_far_c', 64, 1, {}, 'Pixabay, dragon-studio "dry thunder": far roll'),
    ('rain_loop', 112, 2, {'loop': 1}, 'Pixabay, liecio "calming rain": 20 s of rain only, looped'),
    ('killcam_barrett50_slowmo', 112, 1, {'bang': 0.59}, 'Pixabay, adhimahadi "Barrett 50 cal slow mo": whole, for the kill camera'),
]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit('failed: ' + ' '.join(cmd) + '\n' + r.stderr)
    return r.stdout


def main():
    entries, total = [], 0
    with tempfile.TemporaryDirectory() as tmp:
        for name, kbps, ch, marks, src in SOUNDS:
            wav = os.path.join(CUT, name + '.wav')
            if not os.path.exists(wav):
                sys.exit('missing ' + wav)
            dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).strip())
            # bring the loudest peak to -1 dB (the game sets each sound's real level itself)
            stats = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            peak = 0.0
            for line in stats.splitlines():
                if 'max_volume' in line:
                    peak = float(line.split('max_volume:')[1].split('dB')[0])
            gain = -1.0 - peak
            mp3 = os.path.join(tmp, name + '.mp3')
            run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', str(ch), '-ar', '44100', '-af', 'volume=%.2fdB' % gain,
                 '-c:a', 'libmp3lame', '-b:a', '%dk' % kbps, mp3])
            data = open(mp3, 'rb').read()
            total += len(data)
            entries.append((name, base64.b64encode(data).decode('ascii'), round(dur, 4), ch, marks, src, len(data)))
    lines = [
        '// ---------------------------------------------------------------------------',
        '// Recorded sounds, packed by tools/pack_sfx.py from sfx_src/cut/. Do not edit by hand: change the',
        '// cuts or the list in the tool and run it again. Each is a small MP3 held as text (d), with its',
        '// true length in seconds (n: decoders can add a little silence in front, which is trimmed off),',
        '// its channel count (ch) and marks the game lines things up by (m).',
        '//',
        '// Every recording comes from Pixabay under the Pixabay Content License: free to use inside a',
        '// game, sold or not, with no credit needed; the raw files may not be passed on by themselves.',
        '// That is why only these squeezed copies, built into the game, are in the repository.',
        '// ---------------------------------------------------------------------------',
        'Sfx.REC = {',
    ]
    for name, b64, dur, ch, marks, src, size in entries:
        lines.append('  // %s (%.1f KB)' % (src, size / 1024))
        lines.append('  %s: { n: %s, ch: %d, m: %s, d: \'%s\' },' % (name, dur, ch, json.dumps(marks), b64))
    lines.append('};')
    open(OUT, 'w').write('\n'.join(lines) + '\n')
    print('packed %d sounds, %.0f KB of MP3, %.0f KB as text -> %s' % (len(entries), total / 1024, os.path.getsize(OUT) / 1024, OUT))
    for name, b64, dur, ch, marks, src, size in entries:
        print('  %-26s %5.2fs %d ch %6.1f KB' % (name, dur, ch, size / 1024))


if __name__ == '__main__':
    main()
