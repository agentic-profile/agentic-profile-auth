// Flip a random position to A, or if already A, then B
export function mutateBase64(base64:string) {
    let p = Math.floor(Math.random() * base64.length);
    while( base64[p] === '=' )
        p--;

    let replacement = base64.charAt(p) === 'A' ? 'B' : 'A';
    return base64.substring(0, p) + replacement + base64.substring(p + 1);
}

export const BASE_64_REGEX = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}|[A-Za-z0-9+/]{3})?$/;

export function isBase64key( base64: string ) {
    // e.g. GY3f8Qqyf6K+Oc/XeXVf64h67PMge5s6nM/6bavNHX8
    if( !base64 || base64.length !== 43 )
        return false;
    else
        return BASE_64_REGEX.test( base64 );
}