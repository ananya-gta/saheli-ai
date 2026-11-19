"""Saheli's neural voice: Hinglish goes to Swara in Devanagari, results are cached, failures fall back cleanly."""
import pytest

from app import config, voice


class FakeHttp:
    calls = []

    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): return False

    def post(self, url, content, headers):
        FakeHttp.calls.append(content.decode())
        import httpx
        return httpx.Response(200, content=b"mp3", request=httpx.Request("POST", url))


@pytest.fixture
def azure(monkeypatch):
    monkeypatch.setattr(config, "AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setattr(config, "TTS_VOICE", "hi-IN-SwaraNeural")
    monkeypatch.setattr(voice.httpx, "Client", FakeHttp)
    monkeypatch.setattr(voice, "to_devanagari", lambda t, everything=False: "नमस्ते! आपकी वेबसाइट तैयार है")
    voice._cache.clear()
    FakeHttp.calls.clear()


def test_hinglish_is_spoken_by_swara_in_devanagari_and_cached(azure):
    assert voice.synthesize("**Namaste!** Aapki website taiyaar hai 🎉") == (b"mp3", "audio/mpeg")
    assert voice.synthesize("**Namaste!** Aapki website taiyaar hai 🎉") == (b"mp3", "audio/mpeg")
    assert len(FakeHttp.calls) == 1  # second time from the cache
    ssml = FakeHttp.calls[0]
    assert 'name="hi-IN-SwaraNeural"' in ssml and "वेबसाइट" in ssml and "Namaste" not in ssml


def test_text_is_escaped_for_ssml(azure, monkeypatch):
    monkeypatch.setattr(voice, "to_devanagari", lambda t, everything=False: t)
    voice.synthesize("Price < 200 & more")
    assert "&lt; 200 &amp; more" in FakeHttp.calls[0]


def test_without_a_key_the_open_source_voice_speaks_everything_in_devanagari(monkeypatch, tmp_path):
    model = tmp_path / "hi.onnx"
    model.write_bytes(b"x")
    monkeypatch.setattr(config, "AZURE_SPEECH_KEY", "")
    monkeypatch.setattr(config, "PIPER_MODEL", model)
    seen = {}
    monkeypatch.setattr(voice, "to_devanagari", lambda t, everything=False: seen.update(everything=everything) or "नमस्ते")
    monkeypatch.setattr(voice, "_piper_wav", lambda t: seen.update(text=t) or b"RIFF")
    voice._cache.clear()
    assert voice.engine() == "piper" and voice.synthesize("Your website is ready") == (b"RIFF", "audio/wav")
    assert seen == {"everything": True, "text": "नमस्ते"}


def test_with_no_voice_at_all_the_browser_voice_is_used(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "AZURE_SPEECH_KEY", "")
    monkeypatch.setattr(config, "PIPER_MODEL", tmp_path / "missing.onnx")
    with pytest.raises(voice.VoiceUnavailable):
        voice.synthesize("Namaste")
