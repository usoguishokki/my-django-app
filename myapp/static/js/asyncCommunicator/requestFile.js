// static/js/asyncCommunicator/requestFile.js

import { request } from './request.js';

function getFilenameFromDisposition(contentDisposition, fallback = 'download.csv') {
    if (!contentDisposition) return fallback;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const simpleMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (simpleMatch?.[1]) {
        return simpleMatch[1];
    }

    return fallback;
}

function downloadBlobFile(blob, filename) {
    const objectUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.URL.revokeObjectURL(objectUrl);
}

function buildFormData(data = {}) {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;

        if (Array.isArray(value)) {
            value.forEach((item) => formData.append(key, item));
            return;
        }

        formData.append(key, value);
    });

    return formData;
}

export async function requestFile(options = {}) {
    const {
        fallbackFilename = 'download.csv',
        data,
        ...requestOptions
    } = options;

    const response = await request({
        ...requestOptions,
        data: buildFormData(data),
    });

    if (!response) {
        return null;
    }

    if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
    }

    const blob = await response.blob();

    const filename = getFilenameFromDisposition(
        response.headers.get('Content-Disposition'),
        fallbackFilename
    );

    downloadBlobFile(blob, filename);

    return {
        status: 'success',
        filename,
    };
}