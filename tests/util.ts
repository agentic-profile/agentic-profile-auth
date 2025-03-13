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
const challengeMap = new Map<number,ChallengeRecord>();
let nextChallengeId = 1;

export const authStore = {
    saveClientSession: async ( sessionKey: string, profileUri:string, agentUrl:string )=>{
        const id = nextSessionId++;
        const session = { id, sessionKey, profileUri, agentUrl, created: new Date() } as ClientAgentSession;
        sessionMap.set( id, session );
        return id;
    },
    fetchClientSession: async (id:number)=>{
        return sessionMap.get( id );  
    },
    saveChallenge: async (challenge:string)=>{
        const id = nextChallengeId++;
        const entry = { id, challenge, created: new Date() } as ChallengeRecord;
        challengeMap.set( id, entry );
        return id;
    },
    fetchChallenge: async (id:number)=>{
        return challengeMap.get( id );
    },
    deleteChallenge: async (id:number)=>{
        challengeMap.delete( id );
    }
} as AgentAuthStore;

export function prettyJSON( obj: any ) {
    return JSON.stringify( obj, null, 4 );
}