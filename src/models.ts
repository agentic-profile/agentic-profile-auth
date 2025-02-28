//
// Auth
//

export type CanonicalURI = string;
export type AliasURI = string;
export type ProfileURI = CanonicalURI | AliasURI;

// Body of HTTP 401 response for endpoint that requires authentication
export interface AgenticChallenge {
    type: "agentic-challenge/1.0",
    challenge: string,  // opaque identifier
    login: string       // URL to POST signed challenge to, may be relative to endpoint that requested authentication
}

export interface Attestation {
    canonicalUri: CanonicalURI,
    agentUrl?: string,  // optional, specific agent doing signing
}

// Body of HTTP login POST request
export interface SignedChallenge {
    publicKey: string,      // base64
    challenge: string,      // opaque
    attestation: string,    // base64(toJson(Attestation))
    signature: string       // base64 of sign(challenge.payload)
}

// JSON encoding is used to wrap HTTP authorization value after 'Agentic'
export interface AgentToken {
    id: number,
    sessionKey: string
}

export interface LoginResult {
    agentToken: string  // base 64 of JSON from AgentToken
}

//
// Session
//

// On the remote/server side, session tracks who is communicating with them... profileUri+optional agentUrl
export interface ClientAgentSession {
    id: number,
    created: Date,
    canonicalUri: CanonicalURI, // uri of user/agent about/profile
    agentUrl?: string,          // optional agentUrl when agent keyring used, this is usually the endpoint I provide
    sessionKey: string
}

// on client side, session/agent token for communicating with remote/server agentUrl
export interface RemoteAgentSession {
    uid: number,            // implicit client canonicalUri
    created: Date,
    remoteAgentUrl: string, // endpoint we are communicating with
    agentToken: string      // opaque token (actually base64 JSON of {id,sessionKey})
}

//
// Agentic Profile
//

export interface Keypair {
    type: "ed25519",
    publicKey: string,                  // base64
    privateKey: string | undefined,     // base64   
}

export interface AgentKey extends Keypair {
    name?: string,
    created?: Date,
    expires: Date,
}

export interface AgentService {
    type: string,   // e.g. "chat",
    url: string,    // e.g. `https://agents.matchwise.ai/agents/${uid}/chat`,
    name: string,
    keyring?: AgentKey[]
}

export interface PersonaMeta {
    label: string,
    details?: string,
    goals?: string
}

export interface Persona {
    uid: number,
    pid: number,
    created: Date,
    updated: Date,
    hidden: boolean
    meta: PersonaMeta
}

export interface AgenticProfile {
    uid: number,
    name: string,
    alias?: string,
    ttl: number,    // seconds, default 1 day/86400 seconds
    canonicalUri?: CanonicalURI,
    aliasUris?: AliasURI[],
    keyring: AgentKey[],
    agents: AgentService[],
    personas: Persona[]
}

//
// Storage
//

export interface ChallengeRecord {
    id: number,
    challenge: string,
    created: Date
}

export interface AgentAuthStore {
    // Manage sessions with clients that are calling our HTTP endpoints
    saveClientSession: ( sessionKey: string, canonicalUri: CanonicalURI, agentUrl?: string )=>Promise<number>
    fetchClientSession: (id:number)=>Promise<ClientAgentSession | undefined> 

    // For the remote agent server, to track challenges that have been issued
    saveChallenge: (challenge:string)=>Promise<number>
    fetchChallenge: (id:number)=>Promise<ChallengeRecord | undefined>
    deleteChallenge: (id:number)=>void
}