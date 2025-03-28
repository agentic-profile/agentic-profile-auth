import {
    signAsync,
    verifyAsync,
    getPublicKeyAsync,
    utils
} from "@noble/ed25519";

import {
    base64UrlToByteArray,
    byteArrayToBase64Url,
    ensure,
    stringToByteArray
} from "./util.js"

import {
    EdDSAPrivateJWK,
    EdDSAPublicJWK,
    JWKSet
} from "./models.js";


export async function createEdDsaJwk() {
    const privateKey = utils.randomPrivateKey();

    const b64uPrivateKey = byteArrayToBase64Url( privateKey );
    const b64uPublicKey = byteArrayToBase64Url( await getPublicKeyAsync( privateKey ) );

    const publicJwk = {
        kty: "OKP",
        alg: "EdDSA",
        crv: "Ed25519",
        x: b64uPublicKey
    } as EdDSAPublicJWK;

    const privateJwk = {
        ...publicJwk,
        d: b64uPrivateKey
    } as EdDSAPrivateJWK;

    return { publicJwk, b64uPublicKey, privateJwk, b64uPrivateKey } as JWKSet;
}

export async function sign( message:string, base64UrlPrivateKey:string ) {
    ensure( message, "Ed25519 sign() requires a message" );
    ensure( base64UrlPrivateKey, "Ed25519 sign() requires a private key" );
    try {
        const privateKey = base64UrlToByteArray( base64UrlPrivateKey );
        const signature = await signAsync( stringToByteArray( message ), privateKey );
        return byteArrayToBase64Url( signature );
    } catch( err: any ) {
        throw new Error("Ed25519 sign() failed: " + err.message );
    }
}

export async function verify( base64UrlSignature:string, message:string, base64UrlPublicKey:string ) {
    ensure( base64UrlPublicKey, "Ed25519 verify() requires a public key" );
    ensure( base64UrlSignature, "Ed25519 verify() requires a signature" );
    ensure( message, "Ed25519 verify() requires a message" );
    try {
        const publicKey = base64UrlToByteArray( base64UrlPublicKey );
        const signature = base64UrlToByteArray( base64UrlSignature );
        return await verifyAsync( signature, stringToByteArray( message ), publicKey );
    } catch( err: any ) {
        throw new Error("Ed25519 verify() failed: " + err.message );
    }
}
