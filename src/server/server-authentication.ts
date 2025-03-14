import crypto from "crypto";
import {
    Resolver,
    VerificationMethod
} from "did-resolver";

import { verify } from "../ed25519.js";

import {
    AgentAuthStore,
    AuthToken,
    AgenticChallenge,
    AgenticLoginRequest,
    AgenticProfile,
    AgenticJwsHeader,
    AgenticJwsPayload,
    AgentService,
    DID,
    FragmentID
} from "../models.js"

import {
    base64UrlToObject,
    base64ToBase64Url,
    ensure,
    isObject,
    objectToBase64Url,
    resolveFragmentId
} from "../util.js";
import { getResolver } from "../web-did-resolver.js";

const webResolver = getResolver();
const DEFAULT_DID_RESOLVER = new Resolver( webResolver );

export interface LoginMocks {
    agenticProfile?: AgenticProfile
}

export interface LoginOptions {
    mocks?: LoginMocks,
    didResolver?: Resolver
}

export async function createChallenge( store: AgentAuthStore ) {
    const challenge = base64ToBase64Url( crypto.randomBytes(32).toString("base64") );   
    const id = await store.saveChallenge( challenge );
    return { 
        type: "agentic-challenge/0.2",
        challenge: `${id}:${challenge}`,    // opaque
        login: "/agent-login"
    } as AgenticChallenge;
}

function unpackCompactJws( jws: string ) {
    const [ headerB64u, payloadB64u, signatureB64u ] = jws.split('.');
    const header = base64UrlToObject<AgenticJwsHeader>( headerB64u );
    const payload = base64UrlToObject<AgenticJwsPayload>( payloadB64u );

    return { header, payload, signatureB64u };
}

export async function handleLogin( agenticLogin: AgenticLoginRequest, store: AgentAuthStore, options?: LoginOptions ) {
    const { jwsSignedChallenge } = agenticLogin;
    ensure( jwsSignedChallenge, "Missing Java Web signature property 'jwsSignedChallenge'");
    const { header, payload } = unpackCompactJws( jwsSignedChallenge );
    ensure( header?.alg === 'EdDSA', 'Only EdDSA JWS is currently supported' );
    const { challenge, attest: attestation } = payload;
    ensure( challenge, "Missing 'challenge' from agentic JWS payload" );
    ensure( attestation, "Missing 'attest' from agentic JWS payload");
    const { agentDid, verificationId } = attestation;
    ensure( agentDid, "Missing 'attest.agentDid' from agentic JWS payload");
    ensure( verificationId, "Missing 'attest.verificationId' from agentic JWS payload");

    const challengeId = parseInt( challenge.split(":")[0] );
    const record = await store.fetchChallenge( challengeId );
    ensure( record,'Invalid or expired challenge:', challenge );
    const expectedChallenge = challengeId + ':' + record!.challenge;
    ensure( expectedChallenge === challenge, 'Signed challenge is different than offered:', expectedChallenge, '!=', challenge );

    // verify publicKey in signature is from user specified in agentDid
    let profile = options?.mocks?.agenticProfile;
    if( !profile ) {
        const didResolver = options?.didResolver ?? DEFAULT_DID_RESOLVER;
        const { didDocument, didResolutionMetadata } = await didResolver.resolve( agentDid );
        const { error, message } = didResolutionMetadata;
        ensure( !error, 'Failed to resolve agentic profile from DID', error, message );

        profile = didDocument as AgenticProfile;
    }

    const verificationMethod = resolveVerificationMethod( profile!, agentDid, verificationId );
    ensure( verificationMethod?.type === 'JsonWebKey2020','Unsupported verification type, please use JsonWebKey2020 for agents');
    const { publicKeyJwk } = verificationMethod!;
    ensure( publicKeyJwk, "Missing 'publicKeyJwk' property in verification method");
    const { kty, alg, crv, x: publicKeyB64u } = publicKeyJwk!;
    ensure( kty === 'OKP', "JWK kty must be OKP");
    ensure( alg === 'EdDSA', "JWK alg must be EdDSA");
    ensure( crv === 'Ed25519', "JWK crv must be Ed25519");
    ensure( publicKeyB64u, "JWK must provide 'x' as the public key");

    const [ headerB64u, payloadB64u, signatureB64u ] = jwsSignedChallenge.split('.');
    const message = headerB64u + '.' + payloadB64u;
    const isValid = await verify( signatureB64u!, message, publicKeyB64u! );
    ensure( isValid, "Invalid signed challenge and attestation", jwsSignedChallenge, publicKeyB64u );

    const sessionKey = createBase64UrlSessionKey();
    const id = await store.saveClientSession( sessionKey, agentDid );
    const authToken = objectToBase64Url<AuthToken>({ id, sessionKey }); // prepare for use in HTTP authorization header

    // clean up
    await store.deleteChallenge( challengeId );

    return { authToken };  // agent token is base64url of JSON of AgentToken
}

// authorization: "Agent <JSON encoded token>"
// JSON encoded token: { id: number, sessionKey: string }
export async function handleAuthorization( authorization: string, store: AgentAuthStore ) {
    const tokens = authorization.split(/\s+/);
    ensure( tokens[0].toLowerCase() === "agentic", "Unsupported authorization type: ", tokens[0] );
    ensure( tokens.length >= 2, "Missing Agentic token" );

    let id, sessionKey;
    try {
        ({ id, sessionKey } = base64UrlToObject<AuthToken>(tokens[1]));
    } catch( err: any ) {
        throw new Error('Failed to parse agentic token. ' + err.message + " token: " + tokens[1] );
    }
    ensure( sessionKey, "Agent token invalid format:", authorization );

    const session = await store.fetchClientSession( id );
    ensure( session, "Failed to find agent session", id );
    ensure( session!.sessionKey === sessionKey, "Agent auth token session key is invalid", sessionKey );

    return session!;    
}


//
// Utility
//

function parseFragmentId( fid: FragmentID ) {
    const tokens = fid.split('#');
    return { base: tokens[0], id: tokens.length > 1 ? tokens.pop() : undefined };
}

function matchingFids( vm1: FragmentID | VerificationMethod, fid2: FragmentID ) {
    const fid1 = resolveFragmentId( vm1 );
    if( !fid1 )
        return false;
    else if( fid1 === fid2 )
        return true;    // simple case

    const parsed1 = parseFragmentId( fid1 );
    const parsed2 = parseFragmentId( fid2 );
    if( !parsed1.id || !parsed2.id )
        return false;
    else
        return parsed1.id === parsed2.id;
}

function resolveVerificationMethod( profile: AgenticProfile, agentDid: DID, verificationId: FragmentID ) {
    // find agent
    const agent = profile.service?.find(e=>matchingFids( e.id, agentDid ) ) as AgentService;
    if( !agent )
        throw new Error('Failed to find agent service for ' + agentDid );

    // does this agent have the indicated verification?
    let methodOrId = agent.capabilityInvocation?.find(e=>matchingFids(e, verificationId));
    ensure( methodOrId, "Verification id does not match any entries in the agents capabilityInvocation list:", verificationId );
    if( isObject( methodOrId ) ) {
        // if the verification method is scoped to the agent/service, then simply return it
        return methodOrId as VerificationMethod;
    }
    else if( typeof methodOrId !== 'string' )
        throw new Error("Unexpected capabilityInvocation type: " + methodOrId );

    // does the verification method exist in the general verificationMethod list?
    const verificationMethod = profile.verificationMethod?.find(e=>matchingFids(e.id, verificationId ) );
    ensure( verificationMethod, "Verification id does not match any listed verification methods:", verificationId );

    return verificationMethod;
}

function createBase64UrlSessionKey(): string {
    return base64ToBase64Url( crypto.randomBytes(32).toString("base64") );
}
