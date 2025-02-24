import { sign } from "../ed25519.js";

import {
    AgenticChallenge,
    SignedChallenge,
    Keypair
} from "../models.js"

// This is done client/initiator side
// challenge: opaque string, maybe <id>:<rawchallenge>, or maybe not ;)
export async function signChallenge( agenticChallenge: AgenticChallenge, keypair: Keypair, profileUri: string, agentUrl?: string ) {
    const { publicKey, privateKey } = keypair;
    const signature = await sign( agenticChallenge.challenge, privateKey! );
    return {
        challenge: agenticChallenge.challenge,
        publicKey,
        signature,
        profileUri, // e.g."https://public.matchwise.ai/people/1"
        agentUrl
    } as SignedChallenge;
}