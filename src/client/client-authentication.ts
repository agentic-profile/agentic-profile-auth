import { signAsync } from "@noble/ed25519";

import {
    AgenticJwsPayload,
    Attestation,
    EdDSAPrivateJWK,
    OpaqueChallenge
} from "../models.js"
import {
    byteArrayToBase64Url,
    objectToBase64Url,
    base64UrlToByteArray
} from "../b64u.js";


export function asPayload( challenge: OpaqueChallenge, attestation: Attestation ) {
    return {
        challenge,
        attest: attestation
    } as AgenticJwsPayload;
}

type Params = {
    challenge: OpaqueChallenge,
    privateJwk: EdDSAPrivateJWK,
    attestation: Attestation   
}

export async function signChallenge({ challenge, attestation, privateJwk }: Params ) {
    const payload = asPayload( challenge, attestation );
    const privateKey = base64UrlToByteArray( privateJwk.d );
    return await createJWS( payload, privateKey );  // The authToken as compact JWT
}

// Function to create a JWS (JWT without encryption)
async function createJWS( payload: any, privateKey: Uint8Array ) {
    const header = { alg: "EdDSA" };

    // Encode header & payload using base64url
    const headerB64 = objectToBase64Url(header);
    const payloadB64 = objectToBase64Url(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Sign using Ed25519
    const messageBytes = new TextEncoder().encode(message);
    const signature = await signAsync(messageBytes, privateKey);
    
    // Encode signature in base64url format
    const signatureB64 = byteArrayToBase64Url(signature);

    return `${message}.${signatureB64}`;
}
