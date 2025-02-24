import { createKeypair } from "../dist/ed25519.js";

import {
    createChallenge,
    handleAuthorization,
    handleLogin,
} from "../dist/server/agentic-server-authentication.js"
import {
    signChallenge,
} from "../dist/client/agentic-client-authentication.js"

import {
    SignedChallenge,
    ClientAgentSession,
    AgentAuthStore
} from "../dist/models.js"

interface ChallengeEntry {
    id: number,
    challenge: string,
    created: Date
}

const sessionMap = new Map<number,ClientAgentSession>();
let nextSessionId = 1;
const challengeMap = new Map<number,ChallengeEntry>();
let nextChallengeId = 1;

const authStore = {
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
        const entry = { id, challenge, created: new Date() } as ChallengeEntry;
        challengeMap.set( id, entry );
        return id;
    },
    deleteChallenge: async (id:number)=>{
        challengeMap.delete( id );
    }
} as AgentAuthStore;

export async function agentTest() {
    console.log('Starting agent tests...');

    let start = Date.now();
    const keypair = await createKeypair();
    console.log( 'Generated keys', asDuration( start ), keypair );

    const agentChallenge = await createChallenge( authStore );
    console.log( "Created challenge", agentChallenge );

    start = Date.now();
    const signedChallenge = await signChallenge( agentChallenge, keypair, "https://public.matchwise.ai/people/1", "https://agents.matchwise.ai/v1/agent/1/chat" );
    console.log( 'Signed challenge', asDuration( start ), { signedChallenge } );

    start = Date.now();
    const { agentToken } = await handleLogin( signedChallenge, authStore );
    console.log( 'Logged in', asDuration( start ), { agentToken } );

    const session = await handleAuthorization( 'Agentic ' + agentToken, authStore );
    console.log( "Verified login/session", { session } );
}

function asDuration(time:number) {
    return (Date.now() - time) + 'ms';
}