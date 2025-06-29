import {
    DID,
    FragmentID,
    UserID
} from "@agentic-profile/common/schema";

export type OpaqueChallenge = any;

//
// Challenge when no Authorization token provided, or it is invalid
//

export const AGENTIC_CHALLENGE_TYPE = "agentic-challenge/0.6";

// Body of HTTP 401 response for endpoint that requires authentication
export interface AgenticChallenge {
    type: "agentic-challenge/0.6",
    challenge: OpaqueChallenge,  // opaque string or object
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
// Client Session Management
// On the remote/server side, session tracks client/agent that is communicating with the server
//

export interface ClientAgentSession {
    id: number,
    created: Date,
    challenge: string,
    agentDid: DID,           // SHOULD include agent/service qualifier fragment, e.g. did:web:example.com:dave#agent-7
    authToken: string        // compact JWT presented by client as HTTPS "Authorization: Agentic <authToken>"
}

export interface ClientAgentSessionUpdates {
    agentDid?: DID,
    authToken?: string
}

export interface ClientAgentSessionStore  {
    createClientAgentSession( challenge:string ): Promise<number>,
    fetchClientAgentSession( id:number ): Promise<ClientAgentSession | undefined>,
    updateClientAgentSession( id:number, updates:ClientAgentSessionUpdates ): Promise<void>
}


//
// Remote Session Management
// on client side, session/agent token for communicating with remote/server agent
//

export interface RemoteAgentSessionKey {
    uid: UserID
    userAgentDid: DID,
    peerAgentDid?: DID,
    peerServiceUrl?: string // HTTP(S) endpoint of service
}

export interface RemoteAgentSession extends RemoteAgentSessionKey {
    created: Date,
    authToken: string       // auth token to use for HTTPS "Authorization: Agentic <authToken>"
}

export interface RemoteAgentSessionUpdate {
    authToken: string       // auth token to use for HTTPS "Authorization: Agentic <authToken>"
}

export interface RemoteAgentSessionStore {
    fetchRemoteAgentSession( key: RemoteAgentSessionKey ): Promise<RemoteAgentSession | undefined>,
    updateRemoteAgentSession( key: RemoteAgentSessionKey, update: RemoteAgentSessionUpdate ): Promise<void>,
    deleteRemoteAgentSession( key: RemoteAgentSessionKey ): Promise<void>,
}
