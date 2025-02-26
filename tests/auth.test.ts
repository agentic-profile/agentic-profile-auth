import { createKeypair } from "../src/ed25519";

import {
    createChallenge,
    handleAuthorization,
    handleLogin,
} from "../src/server/server-authentication";
import {
    signChallenge,
} from "../src/client/client-authentication";
import {
    ChallengeRecord,
    ClientAgentSession,
    AgentAuthStore
} from "../src/models"

const sessionMap = new Map<number,ClientAgentSession>();
let nextSessionId = 1;
const challengeMap = new Map<number,ChallengeRecord>();
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

async function sessionLifecycle() {
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

    return true;
}

describe("Authentication", () => {
    test('session lifecycle', async () => {
        await expect( sessionLifecycle() ).resolves.toBe(true);
    });
})

function asDuration(time:number) {
    return (Date.now() - time) + 'ms';
}