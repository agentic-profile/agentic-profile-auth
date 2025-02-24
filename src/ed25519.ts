import {
    signAsync,
    verifyAsync,
    getPublicKeyAsync,
    utils
} from "@noble/ed25519";

import {
    base64toByteArray,
    byteArrayToBase64,
    stringToByteArray
} from "./util.js"

import { Keypair } from "./models.js"

async function createKeypair() {
    const _privateKey = utils.randomPrivateKey();
    const privateKey = byteArrayToBase64( _privateKey );
    const publicKey = byteArrayToBase64( await getPublicKeyAsync( _privateKey ) );
    return { type: "ed25519", privateKey, publicKey } as Keypair;
}

async function sign( message:string, base64privateKey:string ) {
    const privateKey = base64toByteArray( base64privateKey );
    const signature = await signAsync( stringToByteArray( message ), privateKey );
    return byteArrayToBase64( signature );
}

async function verify( base64signature:string, message:string, base64publicKey:string ) {
    const publicKey = base64toByteArray( base64publicKey );
    const signature = base64toByteArray( base64signature );
    return await verifyAsync( signature, stringToByteArray( message ), publicKey );
}

export {
    createKeypair,
    sign,
    verify,
}