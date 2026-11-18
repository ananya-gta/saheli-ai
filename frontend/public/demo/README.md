# Saheli demo video

`saheli-demo.mp4` (1920×1080, 76 s, Hindi captions burned in, original background music) + `poster.jpg` are included. The landing page detects
the video automatically. It is a **product walkthrough with sample data**: the real Saheli UI, the real generated
achaar website and the real order system, with scripted replies standing in for live Claude/GoDaddy. A small
"Product walkthrough · sample data" label is visible in the video.

**Best for judging:** after the VPS deploy, record the same journey on the live product (real Claude, real GoDaddy,
real photos) and replace `saheli-demo.mp4` with it (same name). Mac: QuickTime → New Screen Recording.
Windows: Win + Alt + R. Keep it ~60–75 s. If your recording has no burned-in captions, also set
`VITE_DEMO_CAPTIONS_URL=/demo/saheli-demo.hi.vtt` in `frontend/.env` and adjust its timings.

How the included video was made: `tools/demo_video/record.py` (Playwright + Chrome DevTools screencast) and
`tools/demo_video/assemble.py` (ffmpeg: per-scene speed, captions, label, poster) and `tools/demo_video/music.py`
(the background score, synthesised from scratch — no samples, no licensing). There is no voice-over: no text-to-speech
was available. To add one, record your voice over the video in any editor (CapCut, iMovie, Clipchamp) and lower the music.

## Journey to record (same as the walkthrough)
1. Landing → "Bolkar shuru karein" → *"Mere paas 20 tarah ke achaar hain. Main Jaipur se poore India mein bhejna chahti hoon."*
2. Answer Saheli's one question (prices, WhatsApp, UPI) → profile card → "Haan, sahi hai"
3. Camera → 3 product photos → add prices → "Meri dukaan mein jodo"
4. "Naam aur domain dikhao" → GoDaddy cards with prices → pick one
5. Approval card (₹0) → "Haan, banao" → build → "Saheli ne khud website khol kar check kiya"
6. Open the website → add 2 items → Place order → Order #1001 + Pay via UPI
7. Dashboard → the order, "Payment mil gayi?", readiness + next step
