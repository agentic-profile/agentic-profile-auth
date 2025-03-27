import crypto from "crypto";
import {
    agentHooks,
    AgentService,
    AgenticProfile,
    CommonHooks,
    DID,
    FragmentID
} from "@agentic-profile/common";
import { VerificationMethod } from "did-resolver";

import { verify } from "../ed25519.js";

import {
    AgenticChallenge,
    AgenticJwsHeader,
    AgenticJwsPayload,
    AGENTIC_CHALLENGE_TYPE,
    ClientAgentSession,
    ClientAgentSessionStorage,
    ClientAgentSessionUpdates
} from "../models.js"

import {
    base64UrlToObject,
    base64ToBase64Url,
    ensure,
    isObject,
    matchingFragmentIds
} from "../util.js";


export async function createChallenge( store: ClientAgentSessionStorage ) {
    const secret = base64ToBase64Url( crypto.randomBytes(32).toString("base64") );   
    const id = await store.createClientAgentSession( secret );
    return { 
        type: AGENTIC_CHALLENGE_TYPE,
        challenge: { id, secret }
    } as AgenticChallenge;
}

function unpackCompactJws( jws: string ) {
    const [ b64uHeader, b64uPayload, b64uSignature ] = jws.split('.');
    const header = base64UrlToObject<AgenticJwsHeader>( b64uHeader );
    const payload = base64UrlToObject<AgenticJwsPayload>( b64uPayload );

    return { header, payload, b64uSignature };
}

// authorization: "Agent <JSON encoded auth token>"
// JSON encoded token: { id: number, sessionKey: string }
export async function handleAuthorization( authorization: string, store: ClientAgentSessionStorage ): Promise<ClientAgentSession> {
    const tokens = authorization.trim().split(/\s+/);
    ensure( tokens[0].toLowerCase() === "agentic", "Unsupported authorization type: ", tokens[0] );
    ensure( tokens.length >= 2, "Missing Agentic authorization token" );
    const authToken = tokens[1];

    let payload;
    try {
        ({ payload } = unpackCompactJws( authToken ));
    } catch( err: any ) {
        throw new Error('Failed to parse agentic token. ' + err.message + " token: " + authToken );
    }

    const challengeId = payload?.challenge?.id;
    ensure( challengeId, "Agent token missing payload.challenge.id", payload );
    const session = await store.fetchClientAgentSession( challengeId );
    ensure( session, "Failed to find agent session", challengeId );

    if( !session!.authToken ) {
        // session not started yet, so validate auth token
        return validateAuthToken( authToken, session!, store );  
    }

    if( session!.authToken !== authToken )
        throw new Error("Incorrect authorization token; Does not match one used for validation");
    else
        return session!;
}

async function validateAuthToken( authToken: string, session: ClientAgentSession, store: ClientAgentSessionStorage ): Promise<ClientAgentSession> {
    const { header, payload } = unpackCompactJws( authToken );
    ensure( header?.alg === 'EdDSA', 'Only EdDSA JWS is currently supported' );
    const { challenge, attest } = payload;
    ensure( challenge, "Missing 'challenge' from agentic JWS payload" );
    ensure( attest, "Missing 'attest' from agentic JWS payload");
    const { agentDid, verificationId } = attest;
    ensure( agentDid, "Missing 'attest.agentDid' from agentic JWS payload");
    ensure( verificationId, "Missing 'attest.verificationId' from agentic JWS payload");

    const expectedChallenge = session!.challenge;
    const signedChallenge = challenge.secret;
    ensure( expectedChallenge === signedChallenge, 'Signed challenge is different than expected:', signedChallenge, '!=', expectedChallenge );

    // verify publicKey in signature is from user specified in agentDid
    const { didDocument, didResolutionMetadata } = await agentHooks<CommonHooks>().didResolver.resolve( agentDid );
    const { error } = didResolutionMetadata;
    ensure( !error, 'Failed to resolve agentic profile from DID', error );
    ensure( didDocument, "DID resolver failed to return agentic profile" );

    const profile = didDocument as AgenticProfile;

    const verificationMethod = resolveVerificationMethod( profile!, agentDid, verificationId );
    ensure( verificationMethod?.type === 'JsonWebKey2020','Unsupported verification type, please use JsonWebKey2020 for agents');
    const { publicKeyJwk } = verificationMethod!;
    ensure( publicKeyJwk, "Missing 'publicKeyJwk' property in verification method");
    const { kty, alg, crv, x: b64uPublicKey } = publicKeyJwk!;
    ensure( kty === 'OKP', "JWK kty must be OKP");
    ensure( alg === 'EdDSA', "JWK alg must be EdDSA");
    ensure( crv === 'Ed25519', "JWK crv must be Ed25519");
    ensure( b64uPublicKey, "JWK must provide 'x' as the public key");

    const [ b64uHeader, b64uPayload, b64uSignature ] = authToken.split('.');
    const message = b64uHeader + '.' + b64uPayload;
    const isValid = await verify( b64uSignature!, message, b64uPublicKey! );
    ensure( isValid, "Invalid signed challenge and attestation", authToken, b64uPublicKey );

    const sessionUpdates = { agentDid, authToken } as ClientAgentSessionUpdates;
    await store.updateClientAgentSession( challenge.id, sessionUpdates );

    return { ...session, ...sessionUpdates } as ClientAgentSession;
}


//
// Utility
//

function resolveVerificationMethod( profile: AgenticProfile, agentDid: DID, verificationId: FragmentID ) {
    // find agent
    const agent = profile.service?.find(e=>matchingFragmentIds( e.id, agentDid ) ) as AgentService;
    if( !agent )
        throw new Error('Failed to find agent service for ' + agentDid );

    // does this agent have the indicated verification?
    let methodOrId = agent.capabilityInvocation?.find(e=>matchingFragmentIds(e, verificationId));
    ensure( methodOrId, "Verification id does not match any entries in the agents capabilityInvocation list:", verificationId );
    if( isObject( methodOrId ) ) {
        // if the verification method is scoped to the agent/service, then simply return it
        return methodOrId as VerificationMethod;
    }
    else if( typeof methodOrId !== 'string' )
        throw new Error("Unexpected capabilityInvocation type: " + methodOrId );

    // does the verification method exist in the general verificationMethod list?
    console.log( 'searching for verification method',JSON.stringify({
        profile,
        verificationId
    },null,4));
    const verificationMethod = profile.verificationMethod?.find(e=>matchingFragmentIds(e.id, verificationId ) );
    ensure( verificationMethod, "Verification id does not match any listed verification methods:", verificationId );

    return verificationMethod;
}
