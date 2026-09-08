from __future__ import annotations

import threading
import time
from collections import deque
from contextlib import contextmanager


MAX_JSON_BODY_BYTES = 64 * 1024
AI_RATE_LIMIT_PER_MINUTE = 30
_tool_call_slots = threading.BoundedSemaphore(value=4)
_rate_lock = threading.Lock()
_rate_events: dict[str, deque[float]] = {}


def clear_load_safety_state() -> None:
    with _rate_lock:
        _rate_events.clear()


def request_body_is_within_limit(request) -> bool:
    content_length = request.META.get("CONTENT_LENGTH", "")
    try:
        if content_length and int(content_length) > MAX_JSON_BODY_BYTES:
            return False
    except ValueError:
        return False
    return len(request.body) <= MAX_JSON_BODY_BYTES


def request_rate_is_allowed(request, *, scope: str) -> bool:
    remote_address = request.META.get("REMOTE_ADDR", "unknown")
    key = f"{scope}:{remote_address}"
    now = time.monotonic()

    with _rate_lock:
        events = _rate_events.setdefault(key, deque())
        while events and now - events[0] >= 60:
            events.popleft()
        if len(events) >= AI_RATE_LIMIT_PER_MINUTE:
            return False
        events.append(now)
        return True


@contextmanager
def tool_call_slot():
    acquired = _tool_call_slots.acquire(blocking=False)
    try:
        yield acquired
    finally:
        if acquired:
            _tool_call_slots.release()