// static/js/asyncCommunicator/request.js

function getCSRFToken() {
    return (
        document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1] ||
        ''
    );
}

function buildUrl(url, params) {
    if (!params || typeof params !== 'object') return url;

    const usp = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
            value.forEach((item) => usp.append(key, String(item)));
            return;
        }

        usp.append(key, String(value));
    });

    const query = usp.toString();
    if (!query) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${query}`;
}

function buildRequestBody(data, headers) {
    if (data == null) return undefined;

    if (data instanceof FormData) {
        return data;
    }

    headers.set('Content-Type', 'application/json');
    return JSON.stringify(data);
}

export async function request(options = {}) {
    const startedAt = performance.now();

    const {
        url,
        method = 'GET',
        params,
        data,
        timeout = 15000,
        redirectOnAuthError = true,
        headers: customHeaders = {},
        accept,
    } = options;

    if (!url) {
        throw new Error('request: url is required');
    }

    const upperMethod = String(method).toUpperCase();
    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod);
    const finalUrl = buildUrl(url, params);

    const headers = new Headers({
        'X-Requested-With': 'XMLHttpRequest',
        ...customHeaders,
    });

    if (accept) {
        headers.set('Accept', accept);
    }

    let body;
    if (hasBody && data != null) {
        body = buildRequestBody(data, headers);

        const csrfToken = getCSRFToken();
        if (csrfToken) {
            headers.set('X-CSRFToken', csrfToken);
        }
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
        console.warn('[request] timeout fired', {
            url: finalUrl,
            method: upperMethod,
            timeout,
            elapsedMs: Math.round(performance.now() - startedAt),
        });
        controller.abort();
    }, timeout);

    let response;
    try {
        response = await fetch(finalUrl, {
            method: upperMethod,
            headers,
            body: hasBody ? body : undefined,
            credentials: 'same-origin',
            signal: controller.signal,
        });

        console.log('[request] success', {
            url: finalUrl,
            method: upperMethod,
            status: response.status,
            elapsedMs: Math.round(performance.now() - startedAt),
        });
    } catch (error) {
        console.error('[request] failed', {
            url: finalUrl,
            method: upperMethod,
            elapsedMs: Math.round(performance.now() - startedAt),
            errorName: error?.name,
            errorMessage: error?.message,
        });

        if (error?.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    } finally {
        window.clearTimeout(timerId);
    }

    if (response.status === 401 || response.status === 403) {
        if (redirectOnAuthError) {
            alert('セッションが切れました。再度ログインしてください。');
            window.location.href = '/login/';
            return null;
        }

        throw new Error(`Auth error: ${response.status}`);
    }

    return response;
}