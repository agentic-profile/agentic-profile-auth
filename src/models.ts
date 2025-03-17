import {
    DIDDocument,
    JsonWebKey,
    Service,
    VerificationMethod
} from "did-resolver";

export type DID = string;           // MAY include a fragment, or not 
export type FragmentID = string;    // may be full DID, or just the fragment part, such as "#key-7"
export type Base64Url = string;


//
// Auth
//

export const AGENTIC_CHALLENGE_TYPE = "agentic-challenge/0.2";

// Body of HTTP 401 response for endpoint that requires authentication
export interface AgenticChallenge {
    type: "agentic-challenge/0.2",
    challenge: any,  // opaque string or object
    login: string       // URL to POST JWS signed challenge to, may be relative to endpoint that requested authentication
}

// Body of HTTP POST /agent-login
export interface AgenticLoginRequest {
    jwsSignedChallenge: string,    // compact encoding, <header>.<payload>.<signature>
}

// Body of HTTP login response
export interface AgenticLoginResponse {
    authToken: string  // base64url of JSON of AuthToken, opaque to client, used for HTTP authorization header
}

// Example of an auth token; JSON encoding is used to wrap HTTP authorization header value after 'Agentic'
export interface AuthToken {
    id: number,
    sessionKey: string
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
    agentDid: DID               // scopes to the agent that is being verified, MUST include DID of user idenitity
    verificationId: FragmentID  // the verification method used to sign this JWS
}


//
// Agentic Profile (Overlays DID document)
//

export interface AgentService extends Service {
    // id: string,
    // type: string,               // e.g. "AgenticChat",
    // serviceEndpoint: string,    // e.g. `https://agents.matchwise.ai/agent-chat`,
    name: string,                  // friendly name
    capabilityInvocation: (FragmentID | VerificationMethod)[]
}

export interface AgenticProfile extends DIDDocument {
    name: string      // nickname, not globally unique
    ttl?: number      // TTL in seconds, default is 86400 (one day)
}


//
// Session Management
//

// On the remote/server side, session tracks client that is communicating with them
export interface ClientAgentSession {
    id: number,
    created: Date,
    agentDid: DID,           // SHOULD include agent/service qualifier fragment, e.g. did:web:example.com:dave#agent-7
    sessionKey: string
}

// on client side, session/agent token for communicating with remote/server agentUrl
export interface RemoteAgentSession {
    uid: number,
    userAgentDid: DID,
    peerAgentDid: DID,      // agent we are communicating with, including fragment
    peerServiceUrl: string, // HTTP(S) endpoint of service
    created: Date,
    authToken: string       // opaque auth token (actually base64url of JSON of {id,sessionKey})
}

export interface ChallengeRecord {
    id: number,
    challenge: string,
    created: Date
}


//
// Storage
//

export interface AgentAuthStore {
    // Manage sessions with clients that are calling our HTTP endpoints
    saveClientSession: ( sessionKey: string, did: DID )=>Promise<number>
    fetchClientSession: (id:number)=>Promise<ClientAgentSession | undefined> 

    // For the remote agent server, to track challenges that have been issued
    saveChallenge: (challenge:string)=>Promise<number>
    fetchChallenge: (id:number)=>Promise<ChallengeRecord | undefined>
    deleteChallenge: (id:number)=>void
}
