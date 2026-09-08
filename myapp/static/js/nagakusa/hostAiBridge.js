(function () {
    "use strict";
    const pending = new Map();
    const requestType = "nagakusa:interop:request";
    const responseType = "nagakusa:interop:response";
    const action = "ai.send_message";

    function requestId() {
        return window.crypto.randomUUID();
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
        if (data.type !== responseType || data.version !== 1 || data.action !== action) return;
        const item = pending.get(String(data.request_id || ""));
        if (!item) return;
        pending.delete(String(data.request_id));
        window.clearTimeout(item.timer);
        if (data.ok === true && data.result && typeof data.result === "object") item.resolve(data.result);
        else item.reject(new Error(String((data.error || {}).code || "interop_failed")));
    });

    window.NagakusaAiBridge = Object.freeze({ action: action, sendMessage: sendMessage });
}());