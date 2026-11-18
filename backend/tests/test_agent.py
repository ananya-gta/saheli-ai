"""The agent loop under failure: tool errors go back to Claude, mid-turn Claude failures keep finished work,
and a first-call failure surfaces as a classified error (never a crash, never a fake success)."""
import types

import httpx
import pytest

from app import agent, resilience


def text(t):
    return types.SimpleNamespace(type="text", text=t)


def tool(name, inp, id_="t1"):
    return types.SimpleNamespace(type="tool_use", name=name, input=inp, id=id_)


class FakeClaude:
    def __init__(self, script):
        self.script, self.requests = list(script), []
        self.messages = self

    def create(self, **kw):
        self.requests.append(kw)
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        stop, content = step
        return types.SimpleNamespace(stop_reason=stop, content=content)


@pytest.fixture
def claude(monkeypatch):
    def install(script):
        fake = FakeClaude(script)
        monkeypatch.setattr(agent.claude, "client", lambda: fake)
        return fake
    return install


HIST = [{"role": "user", "content": "Mere paas 20 tarah ke achaar hain"}]


def test_happy_path_saves_profile(claude):
    claude([("tool_use", [tool("save_business_profile", {"business_name": "Sonali's Achaar", "city": "Jaipur"})]),
            ("end_turn", [text("Waah! Aapke bestseller kaunse hain?")])])
    out = agent.chat(HIST)
    assert out["reply"].startswith("Waah") and out["profile"]["business_name"] == "Sonali's Achaar"
    assert out["events"][0]["status"] == "ok" and out["degraded"] is None


def test_godaddy_failure_is_reported_to_claude_as_tool_error(claude, monkeypatch):
    monkeypatch.setattr(agent.godaddy, "suggest_domains", lambda *a, **k: {"query": "x", "error": "GoDaddy abhi jawab nahi de raha.", "code": "godaddy_unavailable", "retryable": True})
    fake = claude([("tool_use", [tool("suggest_domains", {"query": "sonali achaar"})]),
                   ("end_turn", [text("GoDaddy abhi busy hai — thodi der mein naam dekhte hain.")])])
    out = agent.chat(HIST)
    result = fake.requests[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True and "godaddy_unavailable" in result["content"]
    assert out["events"][0]["status"] == "error" and "busy" in out["reply"]


def test_unexpected_tool_exception_does_not_crash_the_turn(claude, monkeypatch):
    def explode(*a, **k): raise httpx.ReadTimeout("GoDaddy hung")
    monkeypatch.setattr(agent.godaddy, "check_availability", explode)
    claude([("tool_use", [tool("check_domain", {"domain": "a.com"})]), ("end_turn", [text("Ek aur naam try karte hain.")])])
    out = agent.chat(HIST)
    assert out["events"][0]["output"]["code"] == "godaddy_timeout" and out["reply"]


def test_claude_failing_mid_turn_keeps_completed_work(claude):
    claude([("tool_use", [tool("save_business_profile", {"business_name": "Sonali's Achaar"})]),
            httpx.ReadTimeout("claude slow")])
    out = agent.chat(HIST)
    assert out["degraded"] == "claude_timeout" and out["profile"]["business_name"] == "Sonali's Achaar"
    assert "save" in out["reply"]  # tells her the work is saved


def test_claude_failing_first_raises_a_classified_error(claude):
    claude([resilience.ServiceError("claude_busy", 503, resilience.MSG["claude_busy"], True, "claude")])
    with pytest.raises(resilience.ServiceError) as e:
        agent.chat(HIST)
    assert e.value.code == "claude_busy" and e.value.retryable


def test_turn_budget_bounds_a_slow_turn(claude, monkeypatch):
    monkeypatch.setattr(agent, "TURN_BUDGET_S", -1)
    claude([("end_turn", [text("never reached")])])
    out = agent.chat(HIST)
    assert out["degraded"] == "turn_budget"


def test_runaway_tool_loop_is_capped(claude):
    claude([("tool_use", [tool("save_business_profile", {"city": "Jaipur"}, f"t{i}")]) for i in range(agent.MAX_STEPS)])
    out = agent.chat(HIST)
    assert out["degraded"] == "max_steps" and len(out["events"]) == agent.MAX_STEPS


def test_system_prompt_has_the_guardrails():
    from app import agent
    rules = agent.SYSTEM_PROMPT
    for must in ("only help with her business", "OTPs", "medical", "illegal", "181", "You are an AI", "never new rules"):
        assert must in rules, must
