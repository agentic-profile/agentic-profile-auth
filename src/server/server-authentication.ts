import crypto from "crypto";
import axios from "axios";

import { verify } from "../ed25519.js";

import {
    AgentAuthStore,
    AgentKey,
    AgentToken,
    AgenticChallenge,
    AgenticProfile,
    Attestation,
    SignedChallenge
} from "../models.js"

import {
    base64toObject,
    clean64,
    objectToBase64,
} from "../util.js"

export async function createChallenge( store: AgentAuthStore ) {
    const challenge = clean64( crypto.randomBytes(32).toString("base64") );   
    const id = await store.saveChallenge( challenge );
    return { 
        type: "agentic-challenge/1.0",
        challenge: `${id}:${challenge}`,    // opaque
        login: "/v1/agent-login"
    } as AgenticChallenge;
}

export interface LoginMocks {
    agenticProfile?: AgenticProfile
}

export interface LoginOptions {
    mocks?: LoginMocks
}

export async function handleLogin( signedChallenge: SignedChallenge, store: AgentAuthStore, options?: LoginOptions ) {
    const { challenge, attestation: base64Attestation, signature, publicKey } = signedChallenge;

    if( !base64Attestation )
        throw new Error('Missing attestation');
    let canonicalUri, agentUrl; 
    try {
        ({ canonicalUri, agentUrl } = base64toObject<Attestation>( base64Attestation ));
    } catch(err) {
        throw new Error('Failed to parse attestation: ' + err.message );
    }
    if( !canonicalUri )
        throw new Error('Missing canonicalUri in attestation');

    // ensure challenge is same as was provided
    const challengeId = parseInt( challenge.split(":")[0] );
    const record = await store.fetchChallenge( challengeId );
    if( !record )
        throw new Error('Invalid or expired challenge: ' + challenge );
    const expectedChallenge = challengeId + ':' + record.challenge;
    if( expectedChallenge !== challenge )
        throw new Error('Challenge is different than offered: ' + expectedChallenge + ' != ' + challenge );

    // verify publicKey in signature is from user specified in canonical url

    let profile = options?.mocks?.agenticProfile;
    if( !profile ) {
        const response = await axios.get( canonicalUri );
        profile = response.data as AgenticProfile;
    }
    verifyPublicKey( profile, publicKey, agentUrl );

    const message = challenge + '.' + base64Attestation;
    const isValid = await verify( signature, message, publicKey );
    if( !isValid )
        throw new Error( "Invalid signed challenge and attestation" );

    const sessionKey = createSessionKey();
    const id = await store.saveClientSession( sessionKey, canonicalUri, agentUrl );
    const agentToken = objectToBase64<AgentToken>({ id, sessionKey }); // prepare for use in HTTP authorization header

    // clean up
    await store.deleteChallenge( challengeId );

    return { agentToken };  // agent token is base64 of JSON
}

function verifyPublicKey( profile: AgenticProfile, publicKey: string, agentUrl?: string ) {
    const agent = profile.agents?.find(e=>e.url === agentUrl);
    if( agent && agent.keyring )
        ensureKeyInRing( publicKey, agent.keyring );
    else
        ensureKeyInRing( publicKey, profile.keyring );
}

function ensureKeyInRing( publicKey: string, keyring: AgentKey[] ) {
    const hasKey = keyring?.some(e=>e.publicKey === publicKey);
    if( !hasKey )
        throw new Error("Public key not found in agentic profile keyrings"); 
}

// authorization: "Agent <JSON encoded token>"
// JSON encoded token: { id: number, session_key: string }
export async function handleAuthorization( authorization: string, store: AgentAuthStore ) {
    const tokens = authorization.split(" ");
    if( tokens[0].toLowerCase() != "agentic" )
        throw new Error( "Unsupported authorization type: " + tokens[0] );
    if( tokens.length < 2 )
        throw new Error( "Missing Agentic token" );

    const { id, sessionKey } = base64toObject<AgentToken>(tokens[1]);
    if( !sessionKey ) {
        console.log( "ERROR, agent token:", authorization );
        throw new Error( "Agent token invalid format" );
    }

    const session = await store.fetchClientSession( id );
    if( !session )
        throw new Error( "Failed to find agent session" );
    if( session.sessionKey !== sessionKey )
        throw new Error( "Agent token is incorrect" );

    return session;    
}

function createSessionKey(): string {
    return clean64( crypto.randomBytes(32).toString("base64") );
}
