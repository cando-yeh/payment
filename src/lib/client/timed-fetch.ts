type FetchInput = RequestInfo | URL;

export async function timedFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
    const start = performance.now();
    const response = await fetch(input, init);
    const elapsed = performance.now() - start;

    const serverTiming = response.headers.get('x-response-time');
    const target = typeof input === 'string' ? input : String(input);
    const suffix = serverTiming ? ` (server ${serverTiming})` : '';

    console.info(`[API] ${target} ${response.status} ${elapsed.toFixed(1)}ms${suffix}`);
    return response;
}
