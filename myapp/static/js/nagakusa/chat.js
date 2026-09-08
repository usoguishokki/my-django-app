const root = document.querySelector("[data-nagakusa-chat]");
const status = root.querySelector("[data-chat-status]");
const messages = root.querySelector("[data-chat-messages]");
const form = root.querySelector("[data-chat-form]");
const input = root.querySelector("[data-chat-input]");
const send = root.querySelector("[data-chat-send]");
let conversationId = "";
let sending = false;

function appendMessage(kind, text) {
    const item = document.createElement("li");
    item.className = `nagakusa-chat__message nagakusa-chat__message--${kind}`;
    item.textContent = text;
    messages.append(item);
}

if (window.parent === window || !window.NagakusaAiBridge) {
    status.textContent = "AI相談はNagakusa Host内でのみ利用できます。";
    input.disabled = true;
    send.disabled = true;
} else {
    status.textContent = "Nagakusa AIに質問できます。";
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    send.disabled = true;
    appendMessage("user", text);
    input.value = "";
    status.textContent = "送信中です。";
    try {
        const result = await window.NagakusaAiBridge.sendMessage({ message: text, conversation_id: conversationId });
        conversationId = String(result.conversation_id || conversationId || "");
        appendMessage("assistant", String(result.message || result.content || "回答を受信しました。"));
        status.textContent = "回答を受信しました。";
    } catch (error) {
        status.textContent = "Nagakusa AIを利用できません。";
        appendMessage("error", "回答を取得できませんでした。");
    } finally {
        sending = false;
        send.disabled = false;
    }
});

input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});