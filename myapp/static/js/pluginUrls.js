// This module is served from <plugin root>/static/js/pluginUrls.js.
// Module-relative resolution works at any document depth and proxy mount.
const pluginRoot = new URL('../../', import.meta.url);

export function pluginUrl(path) {
    if (!path.startsWith('/') || path.startsWith('//')) return path;
    return new URL(path.slice(1), pluginRoot).href;
}
