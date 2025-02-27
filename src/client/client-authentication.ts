import { sign } from "../ed25519.js";

import {
    AgenticChallenge,
    Attestation,
    SignedChallenge,
    Keypair
} from "../models.js"

import { objectToBase64 } from "../util.js";

type Params = {
    agenticChallenge: AgenticChallenge,
    keypair: Keypair,
    attestation: Attestation   
}

// This is done client/initiator side
// challenge: opaque string, maybe <id>:<rawchallenge>, or maybe not ;)
// attestation includes the clients canonicalUri, and optionaly the agentUrl
export async function signChallenge({ agenticChallenge, keypair, attestation }: Params) {
    const { publicKey, privateKey } = keypair;
    const { challenge } = agenticChallenge;
    if( !attestation )
        throw new Error('Cannot sign challenge; missing attestation');
    const base64Attestation = objectToBase64( attestation );
    const message = challenge + '.' + base64Attestation;
    const signature = await sign( message, privateKey! );
    return {
        challenge,
        attestation: base64Attestation,
        publicKey,
        signature
    } as SignedChallenge;
}