// static/js/asyncCommunicator/asynchronousCommunication.js

import { request } from './request.js';

export async function asynchronousCommunication(options = {}) {
    const response = await request({
        ...options,
        accept: 'application/json',
    });

    if (!response) {
        return null;
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        console.warn('Non-JSON response:', text);

        if (!response.ok) {
            throw new Error(text || `HTTP ${response.status}`);
        }

        throw new Error('Expected JSON but got non-JSON response');
    }

    const payload = await response.json().catch(() => {
        throw new Error('Invalid JSON response');
    });

    if (!response.ok) {
        const message = payload?.message || `HTTP ${response.status}`;
        throw new Error(message);
    }

    if (payload?.status && payload.status !== 'success') {
        throw new Error(payload?.message || 'Server returned non-success status');
    }

    return payload;
}