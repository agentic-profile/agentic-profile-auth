import {
    VerificationMethod 
} from "did-resolver";

import {
    FragmentID
} from "./models.js";

//
// General
//

export function createTimer(name:string) {
    let start = Date.now();
    let recent = start;

    return {
        elapsed: function( label:string, ...props:any[] ) {
            const now = Date.now();
            console.log(`Timer(${name}:${label}) ${now-recent}ms, ${now-start}ms total`, ...props);
            recent = now;
        }
    };
}

export function ensure( truth: any, ...props:any[] ) {
    if( !truth )
        throw new Error( props.join(' ') );
}

export function isObject( variable: any ) {
    return typeof variable === 'object' && variable !== null;
}


//
// Object, base64url, and byte array conversions
//

export function objectToBase64Url<T>(obj:T) {
    const json = JSON.stringify(obj);
    return stringToBase64Url( json );
}

export function base64UrlToObject<T>( base64url: string ) {
    const json = base64UrltoString( base64url );
    return JSON.parse( json ) as T;
}

export function byteArrayToBase64Url(uint8Array: Uint8Array) {
    const s = String.fromCharCode(...uint8Array);
    return stringToBase64Url( s );
}

export function base64UrlToByteArray(base64url: string): Uint8Array {
    const binaryString = base64UrltoString( base64url );
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function base64UrltoString( base64url: string ) {
    return atob( base64url.replace(/-/g, '+').replace(/_/g, '/') );
}

function stringToBase64Url( s: string ) {
    const base64 = btoa( s );
    return base64ToBase64Url( base64 );
}

export function base64ToBase64Url( base64: string ) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function stringToByteArray(s:string) {
    return new TextEncoder().encode(s);
}

//
// DID tools
//

export function resolveFragmentId( vm: FragmentID | VerificationMethod ) {
    if( !vm )
        return undefined;
    else if( typeof vm === 'string' )
        return vm as FragmentID;
    else
        return vm.id as FragmentID;
}
