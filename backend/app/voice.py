"""Saheli's voice, a woman's Hindi voice from the server.

Two engines: Azure neural TTS (hi-IN-SwaraNeural) when AZURE_SPEECH_KEY is set, otherwise the open-source Piper
voice hi_IN-priyamvada, which runs inside this container (no key, no cost; the model is downloaded at build time).
Saheli writes Hinglish in Roman letters, which a Hindi voice reads with an English accent, so the text is first
rewritten in Devanagari by the fast Claude model. Audio is cached in memory.
If no engine works, the endpoint returns 503 and the browser falls back to its own voice.
"""
import hashlib
import io
import re
import threading
import wave
from collections import OrderedDict
from xml.sax.saxutils import escape

import httpx

from . import claude, config

TIMEOUT = httpx.Timeout(10.0, connect=4.0)
MAX_CACHE = 300
_cache: OrderedDict[str, tuple[bytes, str]] = OrderedDict()
_lock = threading.Lock()

LATIN = re.compile(r"[A-Za-z]")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")


class VoiceUnavailable(Exception):
    pass


def _azure() -> bool:
    return bool(config.AZURE_SPEECH_KEY and config.AZURE_SPEECH_REGION)


def _piper_ready() -> bool:
    return config.PIPER_MODEL.is_file()


def enabled() -> bool:
    return _azure() or _piper_ready()


def engine() -> str | None:
    return "azure" if _azure() else "piper" if _piper_ready() else None


_piper = None
_piper_lock = threading.Lock()


def _piper_wav(text: str) -> bytes:
    global _piper
    from piper import PiperVoice  # only in the Docker image (requirements-voice.txt)
    buf = io.BytesIO()
    with _piper_lock:  # one model in memory, one synthesis at a time
        if _piper is None:
            _piper = PiperVoice.load(str(config.PIPER_MODEL))
        with wave.open(buf, "wb") as wav:
            _piper.synthesize_wav(text, wav)
    return buf.getvalue()


def clean(text: str) -> str:
    text = re.sub(r"\*\*|__|`", "", text)
    text = re.sub(r"https?://\S+", "link", text)
    text = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def to_devanagari(text: str, everything: bool = False) -> str:
    """Hinglish in Roman letters -> Devanagari, so the voice pronounces it like a Hindi speaker.
    English stays English, unless `everything` (Piper's Hindi voice can only read Devanagari)."""
    if not LATIN.search(text):
        return text
    resp = claude.client().messages.create(
        model=config.CLAUDE_FAST_MODEL, max_tokens=1500,
        system=("You prepare text for a Hindi text-to-speech voice. If the text is Hindi or Hinglish written in Roman "
                "letters, rewrite all of it in Devanagari script, including the English words in it (website -> वेबसाइट), "
                "keeping the exact words and meaning. Write numbers and ₹ amounts as they are. "
                + ("Do the same for plain English text: write its words in Devanagari as an Indian would say them. "
                   if everything else "If the text is plain English, return it unchanged. ")
                + "Output only the text, nothing else."),
        messages=[{"role": "user", "content": text}],
    )
    out = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
    return out or text


def _ssml(text: str) -> str:
    lang = "hi-IN" if DEVANAGARI.search(text) or config.TTS_VOICE.startswith("hi-") else "en-IN"
    return (f'<speak version="1.0" xml:lang="{lang}"><voice name="{config.TTS_VOICE}">'
            f'<prosody rate="-4%">{escape(text)}</prosody></voice></speak>')


def synthesize(text: str) -> tuple[bytes, str]:
    """(audio, media type) of `text` in Saheli's voice. Raises VoiceUnavailable on any failure."""
    which = engine()
    if not which:
        raise VoiceUnavailable("speech not configured")
    text = clean(text)[:1500]
    if not text:
        raise VoiceUnavailable("nothing to say")
    key = hashlib.sha256(f"{which}|{config.TTS_VOICE}|{text}".encode()).hexdigest()
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    try:
        spoken = to_devanagari(text, everything=which == "piper")
    except Exception:  # noqa: BLE001 - speaking the Roman text is better than staying silent
        spoken = text
    try:
        result = (_azure_mp3(spoken), "audio/mpeg") if which == "azure" else (_piper_wav(spoken), "audio/wav")
    except Exception as exc:  # noqa: BLE001
        raise VoiceUnavailable(f"{which}: {exc}") from exc
    with _lock:
        _cache[key] = result
        while len(_cache) > MAX_CACHE:
            _cache.popitem(last=False)
    return result


def _azure_mp3(text: str) -> bytes:
    with httpx.Client(timeout=TIMEOUT) as http:
        r = http.post(f"https://{config.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1",
                      content=_ssml(text).encode(),
                      headers={"Ocp-Apim-Subscription-Key": config.AZURE_SPEECH_KEY,
                               "Content-Type": "application/ssml+xml",
                               "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
                               "User-Agent": "saheli-ai"})
    r.raise_for_status()
    return r.content
