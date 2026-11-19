"""Saheli AI API.  Run locally:  python -m uvicorn app.main:app --reload --port 8000"""
import contextvars
import logging
import os
import time
import uuid
import threading
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from anyio import to_thread
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import account, agent, auth, catalog, config, db, editor, enquiries, godaddy, landing, launch, mailer, orders, resilience, sitegen, sitestore, storefront, voice

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s rid=%(request_id)s %(message)s")
_request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


for _h in logging.getLogger().handlers:
    _h.addFilter(_RequestIdFilter())
log = logging.getLogger("saheli")

_problems = config.production_problems()
if _problems:  # refuse to run an unsafe production server
    raise RuntimeError("Unsafe production settings:\n  - " + "\n  - ".join(_problems))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Claude calls block a worker thread for up to ~100 s; give the pool room so login/health stay responsive
    to_thread.current_default_thread_limiter().total_tokens = int(os.getenv("WORKER_THREADS", "100"))
    if os.getenv("AUTO_WARMUP", "1") != "0":
        landing.warm_up_in_background()
    yield


app = FastAPI(title="Saheli AI", lifespan=lifespan)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Every request gets an id (returned as X-Request-ID, included in error bodies and logs) and an access log line."""
    rid = request.headers.get("x-request-id", "")[:32] or uuid.uuid4().hex[:12]
    token = _request_id.set(rid)
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:  # pragma: no cover - handled by exception handlers below
        log.exception("unhandled error %s %s", request.method, request.url.path)
        response = JSONResponse(resilience.ServiceError("internal", 500, resilience.MSG["internal"]).public(rid), status_code=500)
    finally:
        _request_id.reset(token)
    response.headers["X-Request-ID"] = rid
    if request.url.path.startswith(("/api/", "/mcp/")):
        log.info("%s %s %s %dms", request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
    return response


@app.middleware("http")
async def private_site_files(request: Request, call_next):
    """Local dev serves sites from /sites/<slug>/ — never expose the owner's profile or customer enquiries."""
    path = request.url.path
    if path.startswith("/sites/") and (path.endswith("/site.json") or path.endswith(".jsonl") or path.endswith(".db")):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    return await call_next(request)


@app.exception_handler(resilience.ServiceError)
async def service_error(request: Request, exc: resilience.ServiceError):
    return JSONResponse(exc.public(request.headers.get("x-request-id") or _request_id.get()), status_code=exc.status,
                        headers={"Retry-After": "15"} if exc.retryable and exc.status in (429, 503) else None)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    log.exception("unexpected error on %s", request.url.path)
    return JSONResponse(resilience.ServiceError("internal", 500, resilience.MSG["internal"]).public(_request_id.get()), status_code=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    # generated sites (localhost:8000 locally, *.<DOMAIN> in production) post enquiries and orders here
    allow_origin_regex=config.cors_origin_regex(),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Idempotency-Key", "X-Request-ID"],
)

config.SITES_DIR.mkdir(parents=True, exist_ok=True)


def _fail(exc: Exception, label: str):
    """Log the full error server-side; send the user only a classified, friendly error (no internals)."""
    if isinstance(exc, HTTPException):
        raise exc
    err = resilience.classify(exc, "claude")
    log.error("%s failed code=%s: %r", label, err.code, exc, exc_info=not isinstance(exc, resilience.ServiceError))
    raise err from exc


def _drills(request: Request, user: dict):
    """Admins can rehearse failures live with header X-Saheli-Fault: claude | godaddy | timeout (comma-separated)."""
    raw = request.headers.get("x-saheli-fault", "")
    if raw and user.get("email", "").lower() in config.admin_emails():
        log.warning("failure drill active: %s", raw)
        return resilience.set_faults({x.strip() for x in raw.split(",")})
    return None


def _site_exists(slug: str) -> bool:
    return bool(sitegen.SLUG_RE.match(slug or "")) and sitestore.exists(slug)


# In-process sliding-window rate limits (one API container). Old keys are swept so memory stays bounded.
_recent: dict[str, deque] = {}
_recent_lock = threading.Lock()
_last_sweep = 0.0
MAX_WINDOW = 3600


def _rate_limited(key: str, limit: int, window: int = 600) -> bool:
    global _last_sweep
    now = time.time()
    with _recent_lock:
        if now - _last_sweep > 60:
            for k in [k for k, q in _recent.items() if not q or now - q[-1] > MAX_WINDOW]:
                del _recent[k]
            _last_sweep = now
        q = _recent.setdefault(key, deque())
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return True
        q.append(now)
        return False


# ---------------------------------------------------------------- health
@app.get("/api/health")
def health():
    """Liveness + readiness: settings, database, and the state of each dependency's circuit breaker."""
    missing = config.missing_settings()
    try:
        db.one("SELECT 1 AS ok")
        database = True
    except Exception:  # noqa: BLE001
        log.exception("health: database check failed")
        database = False
    return {"ok": not missing and database, "missing_settings": missing, "model": config.CLAUDE_MODEL,
            "checks": {"database": database}, "circuits": {k: b.snapshot() for k, b in resilience.BREAKERS.items()},
            "integrations": config.integrations()}


@app.get("/api/domains/check")
def domain_check(domain: str, user: dict = Depends(auth.current_user)):
    """Quick manual test of the GoDaddy connection: /api/domains/check?domain=saheliai.com"""
    return godaddy.check_availability(domain)


# ---------------------------------------------------------------- login (email code)
class CodeRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class VerifyRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    code: str = Field(min_length=4, max_length=12)


@app.post("/api/auth/request-code")
def auth_request_code(req: CodeRequest, request: Request):
    ip = request.client.host if request.client else "-"
    if _rate_limited(f"otp-ip:{ip}", limit=10, window=3600):
        raise HTTPException(429, "Bahut saare login codes maange gaye. Thodi der baad try kijiye.")
    return auth.request_code(req.email)


@app.post("/api/auth/verify")
def auth_verify(req: VerifyRequest, request: Request, response: Response):
    ip = request.client.host if request.client else "-"
    if _rate_limited(f"verify-ip:{ip}", limit=30, window=3600):
        raise HTTPException(429, "Bahut saari koshishein. Thodi der baad try kijiye.")
    user, token = auth.verify_code(req.email, req.code, request.headers.get("user-agent", ""))
    auth.set_cookie(response, token)
    return {"user": user}


@app.get("/api/auth/me")
def auth_me(user: dict | None = Depends(auth.optional_user)):
    return {"user": auth.public_user(user) if user else None}


class NameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@app.post("/api/auth/name")
def auth_name(req: NameRequest, user: dict = Depends(auth.current_user)):
    db.run("UPDATE users SET name = ? WHERE id = ?", req.name.strip(), user["id"])
    return {"user": {**auth.public_user(user), "name": req.name.strip()}}


class DeleteAccountRequest(BaseModel):
    confirm_email: str = Field(min_length=5, max_length=254)


@app.get("/api/account/export")
def account_export(user: dict = Depends(auth.current_user)):
    """Everything Saheli holds about her, as one downloadable JSON file."""
    return JSONResponse(account.export(user), headers={"Content-Disposition": 'attachment; filename="saheli-my-data.json"'})


@app.post("/api/account/delete")
def account_delete(req: DeleteAccountRequest, response: Response, user: dict = Depends(auth.current_user)):
    """Erase her account and all her data. She must type her own email to confirm (irreversible)."""
    if req.confirm_email.strip().lower() != user["email"].lower():
        raise HTTPException(400, "Email match nahi hua. Account delete nahi kiya gaya.")
    if _rate_limited(f"delete:{user['id']}", limit=3, window=3600):
        raise HTTPException(429, "Thodi der baad try kijiye")
    result = account.delete(user)
    response.delete_cookie(auth.COOKIE, path="/")
    return result


@app.post("/api/auth/logout")
def auth_logout(request: Request, response: Response):
    auth.logout(request, response)
    return {"ok": True}


# ---------------------------------------------------------------- chat agent
class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=80)
    profile: dict | None = None
    lang: Literal["hi", "en"] = "hi"  # the app's language switch: only a hint for when her own language is unclear


@app.post("/api/chat")
def chat(req: ChatRequest, request: Request, user: dict = Depends(auth.current_user)):
    missing = config.missing_settings()
    if missing:
        log.error("chat refused: missing settings %s", missing)
        raise resilience.ServiceError("claude_config", 503, resilience.MSG["claude_config"], False, "claude")
    if req.messages[-1].role != "user":
        raise HTTPException(400, "Last message must be from the user")
    if _rate_limited(f"chat:{user['id']}", limit=120, window=3600):
        raise HTTPException(429, "Bahut saari baatein ek saath. Thodi der baad try kijiye.")
    drill = _drills(request, user)
    try:
        return agent.chat([m.model_dump() for m in req.messages], req.profile, req.lang)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        _fail(exc, "Agent")
    finally:
        if drill is not None:
            resilience.reset_faults(drill)


# ---------------------------------------------------------------- Saheli's voice
class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)


@app.get("/api/tts")
def tts_status():
    return {"enabled": voice.enabled(), "engine": voice.engine()}


@app.post("/api/tts")
def tts(req: SpeakRequest, user: dict = Depends(auth.current_user)):
    """MP3 of the text in Saheli's neural voice; 503 tells the browser to use its own voice instead."""
    if _rate_limited(f"tts:{user['id']}", limit=300, window=3600):
        raise HTTPException(429, "Bahut saari baatein ek saath. Thodi der baad try kijiye.")
    try:
        audio, media_type = voice.synthesize(req.text)
    except voice.VoiceUnavailable as exc:
        log.warning("tts unavailable: %s", exc)
        raise HTTPException(503, "Voice abhi available nahi hai") from exc
    return Response(audio, media_type=media_type, headers={"Cache-Control": "private, max-age=86400"})


# ---------------------------------------------------------------- photos -> catalog
class PhotoUpload(BaseModel):
    images: list[str] = Field(min_length=1, max_length=catalog.MAX_PHOTOS)  # data URLs (compressed in the browser)


def _own_photos(ids: list[str], user: dict) -> list[str]:
    if not ids:
        return []
    marks = ",".join("?" * len(ids))
    owned = {r["photo_id"] for r in db.all_(f"SELECT photo_id FROM photos WHERE owner_id = ? AND photo_id IN ({marks})", user["id"], *ids)}
    return [i for i in ids if i in owned]


@app.post("/api/photos")
def upload_photos(req: PhotoUpload, request: Request, user: dict = Depends(auth.current_user)):
    if _rate_limited(f"photos:{request.client.host if request.client else '-'}", limit=40):
        raise HTTPException(429, "Too many uploads, please wait a few minutes")
    ids, errors = [], []
    for i, data in enumerate(req.images):
        try:
            pid = catalog.save_photo(data)
            db.run("INSERT INTO photos(photo_id, owner_id) VALUES (?, ?)", pid, user["id"])
            ids.append(pid)
        except ValueError as exc:
            errors.append({"index": i, "error": str(exc)})
    if not ids:
        raise HTTPException(400, errors[0]["error"] if errors else "No photos received")
    return {"photo_ids": ids, "errors": errors}


@app.get("/api/photos/{photo_id}")
def get_photo(photo_id: str, user: dict = Depends(auth.current_user)):
    path = catalog.photo_path(photo_id)
    if not path or not _own_photos([photo_id], user):
        raise HTTPException(404, "Photo not found")
    return FileResponse(path, media_type="image/jpeg")


class AnalyzeRequest(BaseModel):
    photo_ids: list[str] = Field(min_length=1, max_length=catalog.MAX_PHOTOS)
    context: str = Field(default="", max_length=500)


@app.post("/api/catalog/analyze")
def analyze_catalog(req: AnalyzeRequest, user: dict = Depends(auth.current_user)):
    ids = _own_photos(req.photo_ids, user)
    if not ids:
        raise HTTPException(404, "Photos nahi mili")
    try:
        return catalog.analyze(ids, req.context)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        _fail(exc, "Photo analysis error")


# ---------------------------------------------------------------- websites
class BuildRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=40)
    profile: dict


@app.post("/api/sites/build")
def build_site(req: BuildRequest, user: dict = Depends(auth.current_user)):
    """Called when she taps 'Haan, banao' on the approval card. The site belongs to the logged-in user."""
    if _rate_limited(f"build:{user['id']}", limit=10, window=3600):
        raise HTTPException(429, "Ek ghante mein bahut saari websites. Thodi der baad try kijiye.")
    try:
        profile = agent.clean_profile(req.profile) or {}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    # only her own uploaded photos may be used
    products = [dict(p) for p in profile.get("products") or [] if isinstance(p, dict)]
    owned = set(_own_photos([p["photo_id"] for p in products if p.get("photo_id")], user))
    for p in products:
        if p.get("photo_id") and p["photo_id"] not in owned:
            p.pop("photo_id")
    profile["products"] = products
    # Notifications go only to her verified login email: a client-supplied address would let anyone
    # use our mailbox to send messages to strangers.
    profile["email"] = user["email"]
    slug = req.slug.strip().lower()
    if not sitegen.SLUG_RE.match(slug):
        raise HTTPException(400, "Use 3-40 lowercase letters, numbers or hyphens (e.g. sonali-achaar).")
    try:  # reserve the name for her first, so two people can't build the same address at once
        auth.assign_site(slug, user["id"])
    except auth.SiteTaken:
        raise HTTPException(400, "This name is already taken on Saheli. Try another.")
    if sitestore.exists(slug):
        raise HTTPException(400, "Aapki is naam ki website pehle se bani hai.")
    try:
        result = sitegen.build_site(slug, profile)
    except Exception as exc:
        auth.release_site(slug, user["id"])
        if isinstance(exc, ValueError):  # bad or taken slug
            raise HTTPException(400, str(exc)) from exc
        _fail(exc, "Site build error")
    try:
        storefront.write_files(slug)
        # Saheli opens the published site herself to confirm it really works
        verification = launch.verify(config.site_url(slug))
        launch.record_verification(slug, verification)
        result["verification"] = verification
        result["readiness"] = launch.readiness(slug)
        result["agent"] = {"mcp_url": config.mcp_url(slug),
                           "agent_card": config.site_url(slug).rstrip("/") + "/.well-known/agent-card.json"}
        return result
    except Exception:  # noqa: BLE001 - the site is live; only the post-publish extras failed
        log.exception("post-build step failed for %s", slug)
        result["verification"] = {"ok": False, "error": "verification pending"}
        return result


@app.get("/api/sites")
def list_sites(user: dict = Depends(auth.current_user)):
    """The logged-in owner's websites."""
    out = []
    for slug in auth.user_sites(user["id"]):
        folder = sitestore.folder(slug)
        try:
            data = sitestore.load(slug)
        except Exception:  # noqa: BLE001 - a reserved name whose build is still running, or a broken site
            continue
        c = data.get("content") or {}
        hero = (data.get("images") or {}).get("hero") or []
        out.append({"slug": folder.name, "name": c.get("business_name"), "tagline": c.get("tagline_en"),
                    "archetype": c.get("archetype"), "url": config.site_url(folder.name),
                    "thumb": config.site_url(folder.name).rstrip("/") + "/" + hero[0]["src_small"] if hero else None,
                    "products": len(c.get("products") or []), "enquiries": enquiries.count(folder.name),
                    "mcp_url": config.mcp_url(folder.name),
                    "updated": datetime.fromtimestamp(folder.stat().st_mtime, timezone.utc).isoformat()})
    return {"sites": out}


class EditRequest(BaseModel):
    instruction: str = Field(min_length=2, max_length=600)


@app.post("/api/sites/{slug}/edit")
def edit_site(slug: str, req: EditRequest, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    try:
        return editor.edit(slug, req.instruction)
    except Exception as exc:
        _fail(exc, "Edit error")


class SitePhoto(BaseModel):
    photo_id: str = Field(max_length=64)
    name: str = Field(min_length=1, max_length=120)
    price_inr: float | None = None
    unit: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=600)


class SitePhotos(BaseModel):
    items: list[SitePhoto] = Field(min_length=1, max_length=editor.MAX_NEW_PHOTOS)


@app.post("/api/sites/{slug}/photos")
def add_site_photos(slug: str, req: SitePhotos, user: dict = Depends(auth.current_user)):
    """Her own product photos on a live website (from the dashboard camera button)."""
    auth.require_owner(slug, user)
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    owned = set(_own_photos([i.photo_id for i in req.items], user))
    items = [i.model_dump() for i in req.items if i.photo_id in owned]
    if not items:
        raise HTTPException(404, "Photos nahi mili")
    try:
        return editor.add_photos(slug, items)
    except Exception as exc:
        _fail(exc, "Photo update error")


@app.get("/api/sites/{slug}/readiness")
def site_readiness(slug: str, lang: Literal["hi", "en"] = "hi", user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    return launch.readiness(slug, lang)


@app.post("/api/sites/{slug}/verify")
def site_verify(slug: str, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    result = launch.verify(config.site_url(slug))
    launch.record_verification(slug, result)
    return result


class AssistRequest(BaseModel):
    task: Literal["instagram", "whatsapp", "festival", "order_confirmation", "improve", "custom"]
    request: str = Field(default="", max_length=600)


@app.post("/api/sites/{slug}/assist")
def site_assist(slug: str, req: AssistRequest, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    if req.task == "custom" and not req.request.strip():
        raise HTTPException(400, "Bataiye kya chahiye")
    if _rate_limited(f"assist:{user['id']}", limit=30, window=3600):
        raise HTTPException(429, "Thodi der baad try kijiye")
    try:
        return launch.assist(slug, req.task, req.request)
    except Exception as exc:
        _fail(exc, "Assistant error")


@app.get("/api/sites/{slug}/marketing")
def site_marketing(slug: str, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    return {"items": list(reversed(sitestore.field(slug, "marketing", default=[])))}


@app.get("/api/showcase")
def showcase():
    """Public: the demo websites, shown on the landing page."""
    out = []
    for key in ("bakery", "homefood", "boutique", "beauty", "education"):
        folder = sitestore.folder(f"demo-{key}")
        if sitestore.exists(folder.name):
            data = sitestore.load(folder.name)
            c, imgs = data.get("content") or {}, data.get("images") or {}
            # a real photo from the site (story photo first: it usually shows the craft/people)
            photo = next((v[0] for k in ("story", "hero", "gallery") if (v := imgs.get(k))), None)
            url = config.site_url(folder.name)
            out.append({"slug": folder.name, "name": c.get("business_name"), "tagline": c.get("tagline_en"),
                        "archetype": c.get("archetype"), "url": url,
                        "image": (url.rstrip("/") + "/" + photo["src_small"].lstrip("/")) if photo and photo.get("src_small") else None,
                        "readiness": _safe_score(folder.name)})
    return {"sites": out}


def _safe_score(slug: str) -> dict | None:
    try:
        r = launch.readiness(slug)
        items = [i for s in r["sections"] for i in s["items"]]
        return {"score": r["score"], "done": sum(i["done"] for i in items), "total": len(items),
                "done_labels": [i["label"] for i in items if i["done"]],
                "next": [{"label": n["label"], "points": n["points"]} for n in r["next_steps"]]}
    except Exception:
        return None


@app.get("/api/landing")
def landing_data():
    """Public: real category photos (with credits) and a live GoDaddy example price."""
    return {"photos": landing.photos(), "pricing": landing.example_price()}


@app.get("/api/landing/photo/{name}")
def landing_photo(name: str):
    path = landing.photo_file(name)
    if not path:
        raise HTTPException(404, "Not found")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=604800"})


@app.get("/api/sites/{slug}/enquiries")
def list_enquiries(slug: str, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    return {"enquiries": enquiries.load(slug)}


@app.get("/api/sites/{slug}/summary")
def enquiry_summary(slug: str, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    try:
        return editor.summary(slug, enquiries.load(slug))
    except Exception as exc:
        _fail(exc, "Summary error")


class Enquiry(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=6, max_length=20)
    email: str | None = Field(default=None, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    interest: str | None = Field(default=None, max_length=200)
    date: str | None = Field(default=None, max_length=20)
    area: str | None = Field(default=None, max_length=120)
    grade: str | None = Field(default=None, max_length=60)
    website: str | None = None  # honeypot: real people never fill this


class ContactMessage(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str | None = Field(default=None, max_length=20)
    topic: Literal["question", "help", "partnership", "press", "other"] = "question"
    message: str = Field(min_length=5, max_length=3000)
    website: str | None = None  # honeypot: real people never fill this


@app.get("/api/contact")
def contact_info():
    return {"email": config.CONTACT_EMAIL or None}


@app.post("/api/contact")
def contact(msg: ContactMessage, request: Request):
    """The saheliai.com contact form: saved first, then emailed to the platform mailbox in the background."""
    if msg.website:
        return {"ok": True, "email_queued": False}
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(f"contact:{ip}", limit=5, window=3600):
        raise HTTPException(429, "Too many messages. Please try again later.")
    db.run("INSERT INTO contact_messages(name, email, phone, topic, message) VALUES (?, ?, ?, ?, ?)",
           msg.name.strip(), msg.email.strip(), (msg.phone or "").strip() or None, msg.topic, msg.message.strip())
    body = (f"New message from the saheliai.com contact form\n\nName: {msg.name}\nEmail: {msg.email}\n"
            f"Phone: {msg.phone or '-'}\nTopic: {msg.topic}\n\n{msg.message}\n")
    queued = mailer.send_later(config.CONTACT_EMAIL, f"[Saheli AI] {msg.topic}: {msg.name}", body, reply_to=msg.email, what="contact")
    return {"ok": True, "email_queued": queued}


@app.post("/api/sites/{slug}/enquiry")
def site_enquiry(slug: str, enq: Enquiry, request: Request):
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    if enq.website:  # bot filled the hidden field: pretend success, store nothing
        return {"ok": True}
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(f"enq:{slug}:{ip}", limit=5):
        raise HTTPException(429, "Too many messages. Please try again in a few minutes or use WhatsApp.")
    return enquiries.save_and_notify(slug, enq.model_dump(exclude={"website"}), channel="website")


# ---------------------------------------------------------------- agent-ready storefront (MCP)
class OrderItem(BaseModel):
    index: int = Field(ge=0, le=500)
    qty: int = Field(ge=1, le=99)
    name: str | None = Field(default=None, max_length=200)


class OrderIn(BaseModel):
    items: list[OrderItem] = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=6, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    pincode: str | None = Field(default=None, max_length=10)
    payment_method: Literal["upi", "cod"] = "upi"
    website: str | None = None  # honeypot


@app.post("/api/sites/{slug}/orders")
def place_order(slug: str, o: OrderIn, request: Request,
                idempotency_key: str | None = Header(default=None, max_length=64)):
    """Public: a customer places an order on a generated website."""
    if not _site_exists(slug):
        raise HTTPException(404, "Website not found")
    if o.website:
        raise HTTPException(400, "Could not place order")
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(f"order:{slug}:{ip}", limit=8):
        raise HTTPException(429, "Too many orders from this device. Please try again in a few minutes or use WhatsApp.")
    try:
        return orders.create(slug, [i.model_dump() for i in o.items],
                             {"name": o.name, "phone": o.phone, "address": o.address, "pincode": o.pincode}, o.payment_method,
                             idempotency_key=idempotency_key)
    except orders.OrderError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/sites/{slug}/orders")
def site_orders(slug: str, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    return {"orders": orders.list_(slug), "stats": orders.stats(slug)}


class OrderUpdate(BaseModel):
    status: Literal["new", "confirmed", "delivered", "cancelled"] | None = None
    payment_status: Literal["pending", "paid"] | None = None


@app.patch("/api/sites/{slug}/orders/{oid}")
def update_order(slug: str, oid: int, u: OrderUpdate, user: dict = Depends(auth.current_user)):
    auth.require_owner(slug, user)
    try:
        return orders.update(slug, oid, u.status, u.payment_status)
    except orders.OrderError as exc:
        raise HTTPException(404 if "not found" in str(exc) else 400, str(exc))


@app.post("/mcp/{slug}")
async def mcp(slug: str, request: Request):
    if not _site_exists(slug):
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32004, "message": "Business not found"}}, 404)
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(f"mcp:{slug}:{ip}", limit=120):
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32029, "message": "Rate limited"}}, 429)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}, 400)
    if isinstance(body, list):
        replies = [r for r in (storefront.handle(slug, m) for m in body if isinstance(m, dict)) if r]
        return JSONResponse(replies) if replies else Response(status_code=202)
    reply = storefront.handle(slug, body if isinstance(body, dict) else {})
    return JSONResponse(reply) if reply else Response(status_code=202)


@app.get("/mcp/{slug}")
def mcp_get(slug: str):
    return JSONResponse({"error": "This MCP endpoint accepts JSON-RPC over HTTP POST (no SSE stream)."}, 405)


# ---------------------------------------------------------------- Caddy on-demand TLS check (production)
@app.get("/internal/tls-allow")
def tls_allow(domain: str):
    base = config.DOMAIN
    if base and domain.endswith("." + base) and _site_exists(domain[: -len(base) - 1]):
        return {"ok": True}
    raise HTTPException(404, "unknown domain")


# Generated websites. Locally: http://localhost:8000/sites/<slug>/  (production: Caddy serves <slug>.saheliai.com)
app.mount("/sites", StaticFiles(directory=config.SITES_DIR, html=True), name="sites")
