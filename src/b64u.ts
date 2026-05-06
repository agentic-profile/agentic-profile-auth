export function objectToBase64Url<T>(obj:T) {
    const json = JSON.stringify(obj);
    return byteArrayToBase64Url(new TextEncoder().encode(json));
}

export function base64UrlToObject<T>( base64url: string ) {
    const json = new TextDecoder().decode(base64UrlToByteArray(base64url));
    return JSON.parse( json ) as T;
}

export function byteArrayToBase64Url(uint8Array: Uint8Array) {
    const base64 = bytesToBase64(uint8Array);
    return base64ToBase64Url(base64);
}

export function base64UrlToByteArray(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return base64ToBytes(padded);
}

export function base64ToBase64Url( base64: string ) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function stringToByteArray(s:string) {
    return new TextEncoder().encode(s);
}

function bytesToBase64(bytes: Uint8Array): string {
    // Node.js (and many bundlers) support Buffer; prefer it for correctness/perf.
    if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes).toString("base64");
    }

    // Browser fallback: btoa expects "binary string" (Latin-1).
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64"));
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
