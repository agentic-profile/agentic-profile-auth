import axios from "axios";
import {
    AgenticProfile,
    CanonicalURI,
    ProfileURI
} from "./models.js";

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

export async function fetchAgenticProfile( profileUri: ProfileURI ) {
    const { data } = await axios.get( profileUri );
    return data as AgenticProfile;
}

function isProfileUriCanonical( profileUri: ProfileURI ) {
    const url = new URL( profileUri );
    const lastPart = url.pathname.split('/').pop();
    if( !lastPart )
        throw new Error("Invalid agentic profile URI: " + profileUri );
    else
        return /^\d+$/.test( lastPart );    // all digits?  ...then canonical!
}

interface ProfileUriResolution {
    canonicalUri: CanonicalURI,
    aliasProfile?: AgenticProfile
}

export async function resolveCanonicalProfileUri( profileUri: ProfileURI ): Promise<ProfileUriResolution> {
    if( isProfileUriCanonical( profileUri ) )
        return { canonicalUri: profileUri as CanonicalURI };

    // <==== EXPENSIVE: TODO fix, use cached version?
    const { elapsed } = createTimer("resolveCanonicalProfileUri");
    const aliasProfile = await fetchAgenticProfile( profileUri );
    if( !aliasProfile.canonicalUri )
        throw new Error("Agentic alias profile does not include reference to canonical URI: " + profileUri );

    const canonicalUri = new URL( aliasProfile.canonicalUri, profileUri ).toString() as CanonicalURI;

    // TODO, verify aliasUris back to original profileUri

    elapsed( "resolved canonical profile uri", profileUri, '=>', canonicalUri );
    return { canonicalUri, aliasProfile };
}