(function () {
    "use strict";
    // Navigation only: being framed is never authentication evidence.
    if (window.parent !== window) return;
    document.querySelectorAll("[data-nagakusa-ai-entry]").forEach(function (link) {
        const hostUrl = link.dataset.hostPluginUrl;
        if (!hostUrl) return;
        link.href = hostUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    });
}());
