"""Turns the screencast frames into the final MP4: per-scene speed-up, burned-in Hinglish captions, a
'Walkthrough · sample data' label, poster image, and a matching WebVTT file."""
import json, subprocess, pathlib
V = pathlib.Path("/home/claude/video")
tl = json.load(open(V / "timeline.json"))
frames, marks, T0 = tl["frames"], tl["marks"], tl["t0"]

# speed per scene (1 = real time). Typing/waiting is sped up; moments that matter play at real time.
SPEED = {"intro": 1, "landing": 1, "voice": 1, "understand": 1.15, "questions": 1.9, "profile": 1.2, "catalog": 1.9,
         "domains": 1.15, "approval": 1.25, "build": 1.6, "verify": 1, "website": 1.25, "order": 2.2, "placed": 1, "dashboard": 1.3, "outro": 1}
CAPTION = {
    "landing": "Saheli — aapki business saheli. Bas boliye.",
    "voice": "Sonali bas apni bhasha mein bolti hai…",
    "understand": "Saheli samajhti hai — aur ek baar mein ek hi sawaal poochhti hai",
    "questions": "Daam, WhatsApp, UPI — jaise wo bole, waise",
    "profile": "Business profile tayyar. Kuch galat ho to “Badlo”",
    "catalog": "Photos se catalogue — Claude Vision products pehchaanta hai",
    "domains": "GoDaddy par asli naam aur saal ka daam",
    "approval": "Har kharcha pehle: aaj ₹0. Faisla hamesha uska",
    "build": "Website ban rahi hai — achaar brand ka design, catalogue, order flow",
    "verify": "Saheli khud website khol kar check karti hai — live ✓",
    "website": "Sonali’s Achaar — ab poore India ke liye",
    "order": "Customer order karta hai — koi account nahi chahiye",
    "placed": "Order #1001 — UPI seedha Sonali ke account mein",
    "dashboard": "Launch ke baad bhi saath: order, payment, agla kadam",
}

seg = [(n, t - T0) for n, t in marks]          # scene name, start (s, wall clock)
def scene_at(t):
    cur = seg[0][0]
    for n, s in seg:
        if t >= s: cur = n
    return cur

def out_time(t):
    """map wall-clock time -> output time, integrating 1/speed per scene"""
    acc, prev_t, prev_n = 0.0, 0.0, seg[0][0]
    for n, s in seg[1:]:
        if t <= s: break
        acc += (s - prev_t) / SPEED.get(prev_n, 1); prev_t, prev_n = s, n
    return acc + (t - prev_t) / SPEED.get(prev_n, 1)

# ---- concat list with per-frame durations
ft0 = frames[0][0]
times = [out_time(ts - ft0) for ts, _ in frames]
end_out = out_time(seg[-1][1])
lines = []
for i, (ts, name) in enumerate(frames):
    nxt = times[i + 1] if i + 1 < len(times) else end_out
    d = max(nxt - times[i], 0.001)
    lines += [f"file '{V / 'frames' / name}'", f"duration {d:.4f}"]
lines.append(f"file '{V / 'frames' / frames[-1][1]}'")
(V / "list.txt").write_text("\n".join(lines))

# ---- captions (ASS for burn-in, VTT for players)
def ts_ass(x): h, r = divmod(x, 3600); m, s = divmod(r, 60); return f"{int(h)}:{int(m):02d}:{s:05.2f}"
def ts_vtt(x): m, s = divmod(x, 60); return f"{int(m):02d}:{s:06.3f}"
cues = []
for i, (n, s) in enumerate(seg):
    if n in CAPTION:
        a = out_time(s) + 0.25; b = out_time(seg[i + 1][1]) - 0.15 if i + 1 < len(seg) else end_out
        cues.append((a, b, CAPTION[n]))
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter SemiBold,44,&H00FFFFFF,&H00FFFFFF,&H004A1F5B,&H004A1F5B,0,0,0,0,100,100,0,0,3,18,0,2,140,140,78,1
Style: Tag,Inter Medium,26,&H00FFFFFF,&H00FFFFFF,&H6024161F,&H6024161F,0,0,0,0,100,100,0.5,0,3,10,0,1,36,36,34,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ass += f"Dialogue: 1,{ts_ass(out_time(dict(seg)['landing']))},{ts_ass(out_time(dict(seg)['outro']))},Tag,,0,0,0,,Product walkthrough · sample data\n"
for a, b, txt in cues:
    ass += f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Cap,,0,0,0,,{{\\fad(180,180)}}{txt}\n"
(V / "captions.ass").write_text(ass, encoding="utf-8")
vtt = "WEBVTT\n\n" + "\n".join(f"{ts_vtt(a)} --> {ts_vtt(b)}\n{t}\n" for a, b, t in cues)
(V / "saheli-demo.hi.vtt").write_text(vtt, encoding="utf-8")

# ---- encode
out = V / "saheli-demo.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(V / "list.txt"),
                "-vf", f"fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,ass={V / 'captions.ass'}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", str(out)], check=True)
# poster: the intro card ("Sonali, Jaipur."), no captions on it
poster_t = out_time(dict(seg)["intro"]) + 3.9
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(V / "list.txt"), "-ss", f"{poster_t:.2f}",
                "-frames:v", "1", "-vf", "fps=30,scale=1920:1080", "-q:v", "3", str(V / "poster.jpg")], check=True)
print("duration out:", round(end_out, 1), "s  cues:", len(cues))
