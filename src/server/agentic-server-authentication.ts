import crypto from "crypto";
import axios from "axios";

import { sign, verify } from "../ed25519.js";

import {
    AgentAuthStore,
    AgentToken,
    AgenticChallenge,
    AgenticProfile,
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

export async function handleLogin( signedChallenge: SignedChallenge, store: AgentAuthStore ) {
    // verify publicKey in signature is from user specified in url
    const { signature, challenge, publicKey, profileUri, agentUrl } = signedChallenge;

    /*
    const response = await axios.get( signedChallenge.url );
    const user = response.data as PublicUser;
    const { keyring } = data as PublicUser;
    const hasKey = keyring.some(e=>e.publicKey === signedChallenge.publicKey);
    if( !hasKey )
        throw new ServerError([4,1],"Public key not found on users keyring");
        */

    const isValid = await verify( signature, challenge, publicKey );
    if( !isValid )
        throw new Error( "Invalid signed challenge" );

    const sessionKey = createSessionKey();
    const id = await store.saveClientSession( sessionKey, profileUri, agentUrl );
    const agentToken = objectToBase64<AgentToken>({ id, sessionKey }); // prepare for use in HTTP authorization header

    // clean up
    const challengeId = parseInt( challenge.split(":")[0] );
    await store.deleteChallenge( challengeId );

    return { agentToken };  // agent token is base64 of JSON
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
