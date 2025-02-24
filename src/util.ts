export function objectToBase64<T>(obj:T) {
    const json = JSON.stringify(obj);
    return clean64( btoa( json ) );
}

export function base64toObject<T>(s:string) {
    const json = atob( s );
    return JSON.parse( json ) as T;
}

export function byteArrayToBase64(uint8Array: Uint8Array) {
    const base64 = btoa(String.fromCharCode(...uint8Array));
    return clean64( base64 );
}

export function base64toByteArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export function clean64( base64: string ) {
    return base64.replace(/=+$/, '');
}

export function stringToByteArray(s:string) {
    return new TextEncoder().encode(s);
}