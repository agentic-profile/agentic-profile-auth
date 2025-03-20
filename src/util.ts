import {
    FragmentID,
    parseDID,
    ParsedDID,
    VerificationMethod
} from "@agentic-profile/common";

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
/*
    did:${METHOD}:${METHOD_ID}${PARAMS}${PATH}${QUERY}${FRAGMENT}
    e.g. did:web:iamagentic.ai:mike

    interface ParsedDID {
      did: string         // always 'did:<method>:<method_id>'
      didUrl: string      // original string that was parsed
      method: string
      id: string          // method_id
      path?: string
      fragment?: string
      query?: string
      params?: Params
    }
*/

/*
interface DocumentPart {
    id: string
}
*/

export type DocumentPartOrFragmentID = VerificationMethod | FragmentID;

// Some DID document lists contain a combination of ids, or document parts which contain ids.
// This method resolves each list item to a FragmentID which can either be a full DID,
// or just the fragment ID such as '#id'
export function resolveDocumentPartId( partOrId: DocumentPartOrFragmentID ): FragmentID | undefined {
    if( !partOrId )
        return undefined;
    else if( typeof partOrId === 'string' )
        return partOrId as FragmentID;
    else
        return partOrId.id as FragmentID;
}

export function resolveFragmentId( didOrFid: string ) {
    if( didOrFid.startsWith('#') )
        return { did: null, fragment: didOrFid.slice(1) };
    else
        return parseDID( didOrFid ) as ParsedDID;
}

export function matchingFragmentIds( partOrId: DocumentPartOrFragmentID, fid2: FragmentID ) {
    //console.log( 'matchingFragmentIds', partOrId, fid2 );
    const fid1 = resolveDocumentPartId( partOrId );
    if( !fid1 )
        return false;
    else if( fid1 === fid2 )
        return true;    // simple case

    const parsed1 = resolveFragmentId( fid1 );
    const parsed2 = resolveFragmentId( fid2 );
    if( !parsed1?.fragment || !parsed2?.fragment )
        return false;   // must have fragments to match
    if( parsed1.fragment !== parsed2.fragment )
        return false;   // simple case of fragments not matching
    if( parsed1.did && parsed2.did )
        return false;

    //console.log( 'matchingFragmentIds is TRUE for', fid1, fid2 );
    return true;
}