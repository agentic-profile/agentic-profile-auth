//
// Auth
//

// Body of HTTP 401 response for endpoint that requires authentication
export interface AgenticChallenge {
    type: "agentic-challenge/1.0",
    challenge: string,  // opaque identifier
    login: string       // URL to POST signed challenge to, may be relative to endpoint that requested authentication
}

// Body of HTTP login POST request
export interface SignedChallenge {
    profileUri: string, // uri of user/agent => about/profile
    agentUrl?: string,  // optional, specific agent doing signing
    publicKey: string,  // base64
    challenge: string,  // opaque
    signature: string   // base64
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

// session tells server who is communicating with them... profileUri+optional agentUrl
export interface ClientAgentSession {
    id: number,
    created: Date,
    profileUri: string, // uri of user/agent about/profile
    agentUrl?: string,  // optional agentUrl when agent keyring used
    sessionKey: string
}

// on client side, session/agent token for communicating with remote/server agentUrl
export interface RemoteAgentSession {
    uid: number,            // implicit profileUri
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
    handle?: string,
    ttl: number,    // seconds, default 1 day/86400 seconds
    canonicalUri?: string,
    keyring: AgentKey[],
    agents: AgentService[],
    personas: Persona[]
}

//
// Storage
//

export interface AgentAuthStore {
    saveClientSession: ( sessionKey: string, profileUri: string, agentUrl?: string )=>Promise<number>
    fetchClientSession: (id:number)=>Promise<ClientAgentSession | undefined> 
    saveChallenge: (challenge:string)=>Promise<number>
    deleteChallenge: (id:number)=>void
}