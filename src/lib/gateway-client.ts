// Client helper per chiamare il gateway dal frontend (lato server)

export async function gatewayGet<T = any>(
    feature: string,
    params?: { id?: string;[key: string]: any }
): Promise<T> {
    const searchParams = new URLSearchParams();
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
    }

    const url = `/api/gateway/${feature}${searchParams.toString() ? `?${searchParams}` : ''}`;
    const response = await fetch(`http://localhost:3000${url}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Gateway error: ${response.status}`);
    }

    return response.json();
}

export async function gatewayPost<T = any>(
    feature: string,
    data: any,
    params?: { id?: string }
): Promise<T> {
    const searchParams = new URLSearchParams();
    if (params?.id) searchParams.append('id', params.id);

    const url = `/api/gateway/${feature}${searchParams.toString() ? `?${searchParams}` : ''}`;
    const response = await fetch(`http://localhost:3000${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Gateway error: ${response.status}`);
    }

    return response.json();
}

export async function gatewayPut<T = any>(
    feature: string,
    data: any,
    params?: { id?: string }
): Promise<T> {
    const searchParams = new URLSearchParams();
    if (params?.id) searchParams.append('id', params.id);

    const url = `/api/gateway/${feature}${searchParams.toString() ? `?${searchParams}` : ''}`;
    const response = await fetch(`http://localhost:3000${url}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Gateway error: ${response.status}`);
    }

    return response.json();
}

export async function gatewayDelete<T = any>(
    feature: string,
    params: { id: string }
): Promise<T> {
    const response = await fetch(`http://localhost:3000/api/gateway/${feature}?id=${params.id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Gateway error: ${response.status}`);
    }

    return response.json();
}

// Helper per listare tutte le feature disponibili (debug)
export async function listGatewayFeatures() {
    return gatewayGet('/_list');
}
