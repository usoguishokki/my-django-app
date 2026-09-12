"""Browser-relative URLs that preserve an unknown reverse-proxy mount prefix."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def relative_plugin_url(target: str, path_info: str) -> str:
    """Relate a local root URL to the upstream request directory.

    The proxy strips its mount prefix before forwarding to Django. Only the
    upstream path_info is used; Host headers never become authentication input.
    External URLs and fragments are left unchanged. No HTML base tag is needed.
    """
    if not target.startswith('/') or target.startswith('//'):
        return target
    directory = path_info.rsplit('/', 1)[0]
    depth = len([part for part in directory.split('/') if part])
    return ('../' * depth or './') + target.lstrip('/')


def versioned_plugin_url(target: str, path_info: str, version: str) -> str:
    """Return a mount-relative asset URL keyed by a stable plugin release."""
    relative_target = relative_plugin_url(target, path_info)
    if not version:
        return relative_target
    parts = urlsplit(relative_target)
    query = [
        item
        for item in parse_qsl(parts.query, keep_blank_values=True)
        if item[0] != 'v'
    ]
    query.append(('v', version))
    return urlunsplit(parts._replace(query=urlencode(query)))
