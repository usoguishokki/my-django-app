(function () {
    "use strict";
    const pending = new Map();
    const requestType = "nagakusa:interop:request";
    const responseType = "nagakusa:interop:response";
    const action = "ai.send_message";

    function requestId() {
        if (typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
    }

    function isObject(value) {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }

    function sendMessage(options) {
        const input = options && typeof options === "object" ? options : {};
        const message = String(input.message || "").trim();
        if (!message || !window.parent || window.parent === window) {
            return Promise.reject(new Error("bridge_unavailable"));
        }
        if (pending.size >= 2) {
            return Promise.reject(new Error("bridge_busy"));
        }
        const id = requestId();
        return new Promise(function (resolve, reject) {
            const timer = window.setTimeout(function () {
                pending.delete(id);
                reject(new Error("bridge_timeout"));
            }, 330000);
            pending.set(id, { resolve: resolve, reject: reject, timer: timer });
            const payload = { message: message, source_screen: "nika_ai_chat", context_snapshot: {} };
            if (input.conversation_id) payload.conversation_id = String(input.conversation_id);
            window.parent.postMessage({ type: requestType, version: 1, action: action, request_id: id, payload: payload }, window.location.origin);
        });
    }

    window.addEventListener("message", function (event) {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const data = event.data || {};
        if (!isObject(data) || data.type !== responseType || data.version !== 1 || data.action !== action) return;
        const item = pending.get(String(data.request_id || ""));
        if (!item) return;
        pending.delete(String(data.request_id));
        window.clearTimeout(item.timer);
        if (data.ok === true && isObject(data.result)) item.resolve(data.result);
        else {
            const detail = data.error || {};
            const error = new Error(typeof detail.message === "string" ? detail.message : "interop_failed");
            error.code = typeof detail.code === "string" ? detail.code : "interop_failed";
            error.hostMessage = typeof detail.message === "string" ? detail.message : "";
            error.retryable = detail.retryable === true;
            if (Number.isFinite(detail.retry_after_seconds) && detail.retry_after_seconds >= 0) {
                error.retry_after_seconds = detail.retry_after_seconds;
            }
            item.reject(error);
        }
    });

    window.NagakusaAiBridge = Object.freeze({ action: action, sendMessage: sendMessage });
}());