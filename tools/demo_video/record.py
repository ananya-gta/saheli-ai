"""Records the Saheli product walkthrough: the REAL frontend UI and the REAL generated achaar website + order system,
with scripted sample replies standing in for live Claude/GoDaddy (this machine has no internet or API keys).
Frames come from the Chrome DevTools screencast (crisp 1920x1080); scene times are logged for captions."""
import asyncio, base64, json, sqlite3, time, pathlib, urllib.parse
from playwright.async_api import async_playwright

OUT = pathlib.Path("/home/claude/video/frames"); OUT.mkdir(exist_ok=True)
for f in OUT.glob("*"): f.unlink()
APP, SITE = "http://127.0.0.1:8770/", "http://127.0.0.1:8768/demo-homefood/"
FONT = pathlib.Path("/home/claude/video/fraunces.woff2").read_bytes()
IMG = pathlib.Path("/tmp/demo_test/demo-homefood/img")
WOMEN = {k: "data:image/jpeg;base64," + base64.b64encode((pathlib.Path("/home/claude/saheli-ai/frontend/public/women") / f"{k}.jpg").read_bytes()).decode()
         for k in ("homefood", "beauty", "bakery", "education")}
frames, marks = [], []
T0 = None

def mark(name):
    marks.append((name, time.time()))
    print(f"  [{time.time() - T0:6.1f}s] {name}")

# ---------------------------------------------------------------- sample data (clearly labelled in the video)
PROFILE1 = {"category": "homefood", "city": "Jaipur", "delivery_area": "All India"}
PROFILE = {"owner_name": "Sonali", "business_name": "Sonali's Achaar", "category": "homefood", "city": "Jaipur",
           "delivery_area": "All India", "whatsapp": "9829012345", "upi_id": "sonali@okaxis",
           "products": [{"name": "Raw mango pickle", "price_inr": 250, "unit": "500 g"}, {"name": "Lemon pickle", "price_inr": 220, "unit": "500 g"},
                        {"name": "Stuffed red chilli", "price_inr": 280, "unit": "500 g"}]}
TURNS = [
    {"reply": "Waah, 20 tarah ke achaar — ye to kamaal hai! Chaliye, pehle aapke 3 sabse zyada bikne wale achaar aur unke daam jaan lete hain. (jaise: aam ka achaar ₹250 / 500 g)",
     "events": [{"tool": "save_business_profile", "input": {"category": "homefood", "city": "Jaipur"}, "output": {"ok": True}}], "profile": PROFILE1},
    {"reply": "Shukriya Sonali ji! Aapka business profile taiyaar hai — ek baar dekh lijiye. Aapke achaar bahut acche lag rahe hain. Inki photos bhejiye, ek sundar catalogue banate hain.",
     "events": [{"tool": "save_business_profile", "input": {"business_name": "Sonali's Achaar", "category": "homefood", "city": "Jaipur"}, "output": {"ok": True}}], "profile": PROFILE},
    {"reply": "Chaliye, ab aapke business ka naam sochte hain! Ye naam GoDaddy par abhi available hain. Daam pehle saal ka hai — kharidna zaroori nahi, website pehle free Saheli address par banegi.",
     "events": [{"tool": "suggest_domains", "input": {"query": "sonalis achaar"}, "output": {"suggestions": [
         {"domain": "sonalisachaar.com", "available": True, "price": {"amount": 12.99, "currency": "USD", "approx_inr": 1100}},
         {"domain": "sonaliachaar.in", "available": True, "price": {"amount": 7.99, "currency": "USD", "approx_inr": 680}},
         {"domain": "jaipurachaar.com", "available": False, "price": None}]}},
                {"tool": "check_domain", "input": {"domain": "sonalisachaar.com"}, "output": {"domain": "sonalisachaar.com", "available": True}}], "profile": PROFILE},
    {"reply": "Bahut sundar naam chuna aapne! Website abhi free address par banegi: sonalis-achaar.saheliai.com — aaj ka kharcha ₹0. Neeche ek baar dekh lijiye; aapki 'haan' ke bina main kuch nahi karungi.",
     "events": [{"tool": "propose_website", "input": {"slug": "sonalis-achaar", "business_name": "Sonali's Achaar"}, "output": {"ok": True}}], "profile": PROFILE,
     "approval": {"type": "website", "slug": "sonalis-achaar", "business_name": "Sonali's Achaar", "url": "https://sonalis-achaar.saheliai.com", "cost": "Free"}},
]
CATALOG = {"business_guess": "Homemade pickles", "items": [
    {"photo_id": f"p{i}", "photo_index": i, "name": n, "name_hi": "", "description": d, "category": "Pickles", "unit_guess": "500 g", "photo_ok": True}
    for i, (n, d) in enumerate([("Raw mango pickle", "Sun-cured raw mango in mustard oil"), ("Lemon pickle", "Sweet and sour, sun-cured"), ("Stuffed red chilli", "Fiery Rajasthani stuffed chillies")])]}
BUILD = {"slug": "sonalis-achaar", "url": SITE, "content": {"business_name": "Sonali's Achaar", "tagline_en": "Pickles the way Nani made them", "archetype": "homefood"},
         "design": {"archetype": "homefood", "palette": "terracotta"}, "photos": {"count": 16, "sources": ["Openverse"]}, "integrations": {"photos": True, "email": True},
         "agent": {"mcp_url": "https://saheliai.com/mcp/sonalis-achaar", "agent_card": "x"},
         "verification": {"ok": True, "status": 200, "ms": 92, "url": SITE, "checks": {"page_loads": True, "https": True, "has_title": True, "mobile_ready": True, "enquiry_form": True}},
         "readiness": {"score": 68, "message": "Sonali ji, aapki website live hai! Agla kadam: link 5 purane customers ko WhatsApp par bhejiye — pehla order yahin dikhega.",
                       "sections": [], "next_steps": [{"label": "First customer order received", "done": False, "points": 5, "tip": "x", "action": "share"}]}}
USER = {"id": 1, "email": "sonali@example.com", "name": "Sonali"}
INTEG = {"photos": True, "email": True, "claude": True, "godaddy_domains": True, "https": True, "payment_gateway": False, "domain_purchase": False, "custom_domain_connect": False}

FAKE = """
window.__sr = null;
window.webkitSpeechRecognition = function(){ const r=this; window.__sr=r; r.start=()=>{ r.onstart&&r.onstart(); }; r.stop=()=>{ r.onend&&r.onend(); }; r.abort=()=>{}; };
window.SpeechRecognition = window.webkitSpeechRecognition;
window.__say = (words, final) => { const r=window.__sr; if(!r) return; r.onresult&&r.onresult({resultIndex:0,results:[Object.assign([{transcript:words}],{isFinal:!!final})]}); if(final){ r.onend&&r.onend(); } };
speechSynthesis.speak = (u) => { setTimeout(()=>{ u.onend&&u.onend(); }, 2600); };
speechSynthesis.cancel = () => {};
// guided cursor so viewers can follow every tap
const mk = () => { if (document.getElementById('__cur')) return; const c=document.createElement('div'); c.id='__cur';
  c.style.cssText='position:fixed;left:640px;top:420px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(91,31,74,.22);border:2px solid rgba(91,31,74,.85);z-index:2147483647;pointer-events:none;transition:left .55s cubic-bezier(.2,.7,.2,1),top .55s cubic-bezier(.2,.7,.2,1),transform .15s';
  document.documentElement.appendChild(c); };
document.addEventListener('DOMContentLoaded', mk); if (document.readyState !== 'loading') mk();
window.__move = (x,y) => { mk(); const c=document.getElementById('__cur'); c.style.left=x+'px'; c.style.top=y+'px'; };
window.__tap = () => { const c=document.getElementById('__cur'); c.style.transform='scale(.7)'; setTimeout(()=>c.style.transform='',160); };
"""


async def fonts(route):
    url = route.request.url
    if "fonts.googleapis.com" in url:
        fams = [urllib.parse.unquote_plus(f.split(":")[0]) for f in urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("family", [])]
        css = ""
        for fam in fams:
            serif = fam in ("Fraunces", "Rozha One", "Cormorant Garamond", "Playfair Display", "DM Serif Display", "Gloock", "Tiro Devanagari Hindi", "Caveat")
            src = "url(https://fonts.gstatic.com/local/fraunces.woff2) format('woff2')" if serif else "local('Inter')"
            css += f"@font-face{{font-family:'{fam}';src:{src};font-weight:100 900;font-display:block}}\n"
        await route.fulfill(body=css, content_type="text/css")
    elif url.endswith("/local/fraunces.woff2"):
        await route.fulfill(body=FONT, content_type="font/woff2")
    else:
        await route.fulfill(status=404, body="")


async def main():
    global T0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5)
        await ctx.add_init_script(FAKE)
        await ctx.route("https://fonts.googleapis.com/**", fonts)
        await ctx.route("https://fonts.gstatic.com/**", fonts)
        pg = await ctx.new_page()
        state = {"logged": True, "turn": 0, "orders": []}

        # ---------------- API mocks (sample data)
        await pg.route("**/api/health", lambda r: r.fulfill(json={"ok": True, "missing_settings": [], "integrations": INTEG}))
        await pg.route("**/api/auth/me", lambda r: r.fulfill(json={"user": USER}))
        await pg.route("**/api/showcase", lambda r: r.fulfill(json={"sites": []}))
        await pg.route("**/api/landing", lambda r: r.fulfill(json={"photos": {}, "pricing": {"domain": "anayabakehouse.com", "live": False}}))
        await pg.route("**/demo/saheli-demo.mp4", lambda r: r.fulfill(status=404, body=""))

        async def chat(r):
            t = TURNS[min(state["turn"], len(TURNS) - 1)]; state["turn"] += 1
            await asyncio.sleep(1.3)
            await r.fulfill(json={"approval": None, "growth_plan": None, **t})
        await pg.route("**/api/chat", chat)
        await pg.route("**/api/photos", lambda r: r.fulfill(json={"photo_ids": ["p0", "p1", "p2"], "errors": []}))
        async def photo(r):
            i = r.request.url.rstrip("/").split("/")[-1].replace("p", "")
            await r.fulfill(path=str(IMG / f"p{i}-0-800.jpg"))
        await pg.route("**/api/photos/p*", photo)
        async def analyze(r): await asyncio.sleep(2.2); await r.fulfill(json=CATALOG)
        await pg.route("**/api/catalog/analyze", analyze)
        async def build(r): await asyncio.sleep(5.5); await r.fulfill(json=BUILD)
        await pg.route("**/api/sites/build", build)
        SITE_ROW = {"slug": "demo-homefood", "name": "Sonali's Achaar", "url": SITE, "archetype": "homefood", "created_at": "2026-11-17", "mcp_url": "https://saheliai.com/mcp/sonalis-achaar", "thumb": None}
        await pg.route("**/api/sites", lambda r: r.fulfill(json={"sites": [SITE_ROW]}))
        await pg.route("**/api/sites/*/enquiries", lambda r: r.fulfill(json={"enquiries": []}))
        await pg.route("**/api/sites/*/marketing", lambda r: r.fulfill(json={"items": []}))
        await pg.route("**/api/sites/*/readiness", lambda r: r.fulfill(json={**BUILD["readiness"], "score": 73,
            "message": "Sonali ji, pehla order aa gaya! Agla kadam: apne achaar ki asli photos bhejiye, taaki customers ko aur bharosa ho.",
            "next_steps": [{"label": "Your own product photos", "done": False, "points": 8, "tip": "Camera button se apne achaar ki asli photos bhejiye", "action": "chat"},
                           {"label": "Launch posts / messages ready", "done": False, "points": 6, "tip": "Assistant se Instagram posts banwaiye", "action": "assist"}]}))
        async def orders(r):
            await r.fulfill(json={"orders": state["orders"], "stats": {"count": len(state["orders"]), "paid_total": 0, "order_value": sum(o["total"] for o in state["orders"])}})
        await pg.route("http://127.0.0.1:8770/api/sites/*/orders", orders)

        # ---------------- screencast
        cdp = await ctx.new_cdp_session(pg)
        def on_frame(ev):
            n = len(frames); fn = OUT / f"f{n:05d}.jpg"
            fn.write_bytes(base64.b64decode(ev["data"])); frames.append((ev["metadata"]["timestamp"], fn.name))
            asyncio.ensure_future(cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]}))
        cdp.on("Page.screencastFrame", on_frame)

        async def move_to(loc, tap=True):
            await loc.scroll_into_view_if_needed()
            bb = await loc.bounding_box()
            await pg.evaluate(f"window.__move({bb['x'] + bb['width'] / 2},{bb['y'] + bb['height'] / 2})")
            await pg.wait_for_timeout(620)
            if tap: await pg.evaluate("window.__tap()"); await pg.wait_for_timeout(140)

        async def click(loc):
            await move_to(loc); await loc.click()

        async def say(text, wpm=0.11):
            words = text.split()
            for i in range(1, len(words) + 1):
                await pg.evaluate("([w,f]) => window.__say(w,f)", [" ".join(words[:i]), i == len(words)])
                await pg.wait_for_timeout(int(wpm * 1000) if i < len(words) else 500)

        async def card(html, ms):
            await pg.set_content(f"""<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#FBF7F2;font-family:Inter,sans-serif">
              <style>@font-face{{font-family:F;src:url(https://fonts.gstatic.com/local/fraunces.woff2)}} .r{{opacity:0;animation:r .9s cubic-bezier(.2,.7,.2,1) forwards}} @keyframes r{{from{{opacity:0;transform:translateY(14px)}}to{{opacity:1;transform:none}}}}</style>
              <div style="text-align:center">{html}</div></body></html>""")
            await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(ms)

        LOGO = '<svg viewBox="0 0 48 48" width="{s}" height="{s}"><rect width="48" height="48" rx="14" fill="#5B1F4A"/><g transform="translate(24 25) scale(1.1) translate(-24 -25)"><path d="M23.2 38.5C14.6 35.6 10.2 27.4 12.6 14.2C20.6 17.4 24.6 25.4 23.2 38.5Z" fill="#FBF7F2"/><path d="M24.8 38.5C33.4 35.6 37.8 27.4 35.4 14.2C27.4 17.4 23.4 25.4 24.8 38.5Z" fill="#F2C9D2"/><circle cx="24" cy="11.2" r="3.1" fill="#E3A447"/></g></svg>'

        await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 90, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
        T0 = time.time()

        # 1. intro (also the video's cover image)
        mark("intro")
        tiles = "".join(f'<div class="r" style="animation-delay:{.15+i*.12}s;border-radius:22px;overflow:hidden;background:url({WOMEN[k]}) {pos}/cover"></div>'
                        for i, (k, pos) in enumerate([("homefood", "center 30%"), ("beauty", "center"), ("bakery", "center 25%"), ("education", "center 35%")]))
        await card(f'''<div style="display:grid;grid-template-columns:1fr 1.05fr;gap:56px;align-items:center;width:1120px;text-align:left">
            <div><div class="r">{LOGO.format(s=64)}</div>
              <p class="r" style="animation-delay:.3s;font-family:F;font-size:58px;line-height:1.08;color:#24161F;margin:26px 0 0">Har ghar mein<br>ek hunar chhupa hai.</p>
              <p class="r" style="animation-delay:.7s;font-size:22px;color:#75636D;margin:22px 0 0;line-height:1.5">Sonali, Jaipur · 20 tarah ke ghar ke achaar.<br>Aaj tak sirf mohalle mein.</p></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:250px 250px;gap:14px">{tiles}</div></div>''', 4200)

        # 2. landing
        await pg.goto(APP); await pg.wait_for_timeout(400)
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.evaluate("document.fonts.ready")
        mark("landing"); await pg.wait_for_timeout(3600)

        # 3. voice
        mark("voice"); await click(pg.locator("button:has-text('Saheli se baat karein')").first)
        await pg.wait_for_timeout(900)
        await say("Mere paas 20 tarah ke achaar hain. Main Jaipur se poore India mein bhejna chahti hoon.")
        mark("understand"); await pg.wait_for_timeout(2600)
        await pg.wait_for_selector("text=Saheli bol rahi hai", timeout=6000); await pg.wait_for_timeout(2200)

        # 4. one question at a time -> answer -> profile
        mark("questions")
        ta = pg.locator("textarea"); await click(ta)
        await ta.type("Aam, nimbu aur bharwa lal mirch. ₹250, ₹220, ₹280 — 500 g. WhatsApp 98290 12345, UPI sonali@okaxis", delay=22)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(2600)
        mark("profile"); await pg.wait_for_timeout(1500)
        await click(pg.locator("button:has-text('Haan, sahi hai')").last); await pg.wait_for_timeout(1800)

        # 5. photos -> catalogue
        mark("catalog")
        cam = pg.locator("button[aria-label*='hoto'], button[aria-label*='amera']").first
        await move_to(cam)
        await pg.locator("input[type=file]").set_input_files([str(IMG / f"p{i}-0-800.jpg") for i in range(3)])
        await pg.wait_for_selector("input[aria-label^='Price for']", timeout=15000); await pg.wait_for_timeout(900)
        for i, price in enumerate(["250", "220", "280"]):
            f = pg.locator("input[aria-label^='Price for']").nth(i); await click(f); await f.type(price, delay=90)
        await pg.wait_for_timeout(500)
        done_btn = pg.locator("button:has-text('dukaan'), button:has-text('Catalogue'), button:has-text('jodo')").last
        await click(done_btn); await pg.wait_for_timeout(1600)

        # 6. GoDaddy domains + costs
        mark("domains")
        await click(ta); await ta.type("Naam aur domain dikhao", delay=40); await pg.keyboard.press("Enter")
        await pg.wait_for_selector("button:has-text('sonalisachaar.com')", timeout=8000); await pg.wait_for_timeout(500)
        await pg.locator("button:has-text('sonalisachaar.com')").first.scroll_into_view_if_needed(); await pg.wait_for_timeout(3400)

        # 7. approval
        mark("approval")
        await click(pg.locator("button:has-text('sonalisachaar.com')").first); await pg.wait_for_timeout(3200)
        appr = pg.locator("button:has-text('Haan, banao')").last
        await appr.scroll_into_view_if_needed(); await pg.wait_for_timeout(2200)
        await click(appr)

        # 8. build -> verify
        mark("build"); await pg.wait_for_timeout(5600)
        mark("verify"); await pg.wait_for_timeout(600)
        await pg.locator("text=Saheli ne khud website khol kar check kiya").scroll_into_view_if_needed(); await pg.wait_for_timeout(3800)

        # 9. the real website + a real order
        mark("website")
        await pg.goto(SITE); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(2800)
        for _ in range(6): await pg.mouse.wheel(0, 260); await pg.wait_for_timeout(260)
        await pg.wait_for_timeout(1200)
        mark("order")
        await click(pg.locator("[data-ctl='0'] button.add").first); await pg.wait_for_timeout(500)
        await click(pg.locator("[data-ctl='2'] button.add").first); await pg.wait_for_timeout(600)
        await click(pg.locator("#fab")); await pg.wait_for_timeout(900)
        for sel, val in [("#cname", "Priya Sharma"), ("#cphone", "9876543210"), ("#cpin", "302021"), ("#caddr", "Vaishali Nagar, Jaipur")]:
            f = pg.locator(sel); await click(f); await f.type(val, delay=22)
        await click(pg.locator("#sendOrder")); await pg.wait_for_timeout(1200)
        mark("placed"); await pg.locator("#done").scroll_into_view_if_needed(); await pg.wait_for_timeout(3400)

        # real order from the real order system -> show it in the owner's dashboard
        db = sqlite3.connect("/tmp/bt/data/saheli.db"); db.row_factory = sqlite3.Row
        o = dict(db.execute("SELECT * FROM orders WHERE slug='demo-homefood' ORDER BY id DESC LIMIT 1").fetchone())
        o["items"] = json.loads(o["items"]); o["code"] = f"#{o['number']}"
        state["orders"] = [o]

        # 10. dashboard
        mark("dashboard")
        await pg.goto(APP); await pg.wait_for_timeout(700)
        await click(pg.locator("header button:has-text('Dashboard')").first); await pg.wait_for_timeout(1800)
        if await pg.locator("text=Launch readiness").count() == 0:
            await click(pg.locator("text=Sonali's Achaar").first); await pg.wait_for_timeout(1500)
        await move_to(pg.locator(f"button:has-text('{o['code']}')").first, tap=False); await pg.wait_for_timeout(1800)
        await click(pg.locator(f"button:has-text('{o['code']}')").first); await pg.wait_for_timeout(1200)
        await pg.evaluate("[...document.querySelectorAll('b')].find(b=>/^#10/.test(b.textContent)).scrollIntoView({block:'start',behavior:'smooth'})"); await pg.wait_for_timeout(3600)

        # 11. outro
        mark("outro")
        strip = "".join(f'<div class="r" style="animation-delay:{.9+i*.1}s;width:150px;height:150px;border-radius:50%;background:url({WOMEN[k]}) center 30%/cover;border:4px solid #FBF7F2;margin-left:{0 if i==0 else -26}px"></div>'
                        for i, k in enumerate(("homefood", "beauty", "bakery", "education")))
        await card(f'''<div class="r">{LOGO.format(s=64)}</div>
            <p class="r" style="animation-delay:.25s;font-family:F;font-size:62px;color:#24161F;margin:22px 0 4px">Bas boliye.</p>
            <p class="r" style="animation-delay:.55s;font-family:F;font-size:62px;color:#5B1F4A;margin:0">Baaki Saheli sambhalegi.</p>
            <div style="display:flex;justify-content:center;margin:34px 0 26px">{strip}</div>
            <p class="r" style="animation-delay:1.4s;font-size:21px;color:#75636D;margin:0">saheliai.com · Powered by Anthropic × GoDaddy</p>''', 4800)
        mark("end")
        await cdp.send("Page.stopScreencast")
        await b.close()

    json.dump({"frames": frames, "marks": marks, "t0": T0}, open("/home/claude/video/timeline.json", "w"))
    print("frames:", len(frames), "duration:", round(marks[-1][1] - T0, 1), "s")

asyncio.run(main())
