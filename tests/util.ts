// Flip a random position to A, or if already A, then B
export function mutateBase64(base64:string) {
    let p = Math.floor(Math.random() * base64.length);
    while( base64[p] === '=' )
        p--;

    let replacement = base64.charAt(p) === 'A' ? 'B' : 'A';
    return base64.substring(0, p) + replacement + base64.substring(p + 1);
}

export const BASE64URL_REGEX = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}|[A-Za-z0-9_-]{3})?$/;

export function isBase64Key( base64url: string, length: number = 43 ) {
    // e.g. GY3f8Qqyf6K+Oc/XeXVf64h67PMge5s6nM/6bavNHX8
    if( typeof base64url !== 'string' || base64url.length !== length )
        return false;
    else
        return BASE64URL_REGEX.test( base64url );
}

export function isBase64Url( base64url: string ) {
    return BASE64URL_REGEX.test( base64url );
}

const sessionMap = new Map<number,ClientAgentSession>();
let nextSessionId = 1;

export const authStore = {
    createClientAgentSession: async (challenge:string)=>{
        const id = nextSessionId++;
        const session = { id, challenge, created: new Date() } as ClientAgentSession;
        sessionMap.set( id, session );
        return id;
    },
    fetchClientAgentSession: async (id:number)=>{
        return sessionMap.get( id );  
    },
    updateClientAgentSession: async ( id:number, updates:ClientAgentSessionUpdates )=>{
        const session = sessionMap.get( id );
        if( !session )
            throw new Error("Failed to find client session by id: " + id );
        else
            sessionMap.set( id, { ...session, ...updates } );
    }
} as AgentAuthStore;
