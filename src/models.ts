import {
    CommonStorage,
    DID,
    FragmentID
} from "@agentic-profile/common";

export type Base64Url = string;
export type OpaqueChallenge = any;

//
// Challenge when no Authorization token provided, or it is invalid
//

export const AGENTIC_CHALLENGE_TYPE = "agentic-challenge/0.4";

// Body of HTTP 401 response for endpoint that requires authentication
export interface AgenticChallenge {
    type: "agentic-challenge/0.4",
    challenge: OpaqueChallenge,  // opaque string or object
}


//
// JWK
//

export interface EdDSAPublicJWK extends JsonWebKey {
    kty: "OKP",
    alg: "EdDSA",
    crv: "Ed25519",
    x: Base64Url
}

export interface EdDSAPrivateJWK extends EdDSAPublicJWK {
    d: Base64Url
}

export interface JWKSet {
    publicJwk: EdDSAPublicJWK
    b64uPublicKey: Base64Url,
    privateJwk: EdDSAPrivateJWK,
    b64uPrivateKey: Base64Url  
}


//
// JWS
//

export interface AgenticJwsHeader {
    alg: "EdDSA"
}

// Payload portion of JSON web signature
export interface AgenticJwsPayload {
    challenge: any,
    attest: Attestation
}

export interface Attestation {
    agentDid: DID               // scopes to the (client) agent that is being verified, MUST include DID of user idenitity
    verificationId: FragmentID  // the verification method used to sign this JWS
}

//
// Session Management
//

// On the remote/server side, session tracks client/agent that is communicating with them
export interface ClientAgentSession {
    id: number,
    created: Date,
    challenge: string,
    agentDid: DID,           // SHOULD include agent/service qualifier fragment, e.g. did:web:example.com:dave#agent-7
    authToken: string        // JWT presented by client as HTTPS "Authorization: Agentic <authToken>"
}

// on client side, session/agent token for communicating with remote/server agentUrl
export interface RemoteAgentSession {
    uid: number,
    userAgentDid: DID,
    peerAgentDid: DID,      // agent we are communicating with, including fragment
    peerServiceUrl: string, // HTTP(S) endpoint of service
    created: Date,
    authToken: string       // auth token to use for HTTPS "Authorization: Agentic <authToken>"
}


//
// Storage
//

export interface ClientAgentSessionUpdates {
    agentDid?: DID,
    authToken?: string
}

export interface ClientAgentSessionStorage extends CommonStorage {
    createClientAgentSession: ( challenge:string )=>Promise<number>,
    fetchClientAgentSession: ( id:number )=>Promise<ClientAgentSession | undefined>,
    updateClientAgentSession: ( id:number, updates:ClientAgentSessionUpdates )=>Promise<void>
}
