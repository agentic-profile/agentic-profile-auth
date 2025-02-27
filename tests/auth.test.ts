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
    objectToBase64,
} from "../src/util";
import {
    AgentAuthStore,
    AgenticProfile,
    ChallengeRecord,
    ClientAgentSession
} from "../src/models"
import { BASE_64_REGEX, mutateBase64, isBase64key } from "./util";

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

describe("Agent Authentication", () => {

    let keypair, keyring, agenticProfile, agenticChallenge, signedChallenge;

    beforeEach( async () => {
        keypair = await createKeypair();
        keyring = [
            {
                publicKey: keypair.publicKey,
                expires: new Date('2030-4-1')
            }
        ];
        agenticProfile = {
            name: 'James',
            keyring
        } as AgenticProfile;

        agenticChallenge = await createChallenge( authStore );

        const attestation = {
            canonicalUri: "https://iamagentic.ai/people/7",
            agentUrl: "https://agents.matchwise.ai/v1/agents/7/agentic-chat"
        };
        signedChallenge = await signChallenge({ agenticChallenge, keypair, attestation });
    });

    test('handle login', async () => {
        const options = { mocks: { agenticProfile } };
        const loginResult = await handleLogin( signedChallenge, authStore, options );
        const agentToken = loginResult.agentToken;

        const session = await handleAuthorization( 'Agentic ' + agentToken, authStore );
    });

    test('missing attestation', async () => {
        expect.assertions(1);
        try {
            await signChallenge({ agenticChallenge, keypair });
        } catch(error) {
            expect(error.message).toBe('Cannot sign challenge; missing attestation')
        }
    });

    test('corrupted signature', async () => {
        const options = { mocks: { agenticProfile } };
        const badChallenge = {
            ...signedChallenge,
            signature: mutateBase64( signedChallenge.signature )
        }

        expect.assertions(1);
        try {
            await handleLogin( badChallenge, authStore, options );
        } catch(error) {
            expect(error.message).toBe('Invalid signed challenge and attestation')
        }
    });

    test('corrupted attestation', async () => {
        const options = { mocks: { agenticProfile } };
        const badChallenge = {
            ...signedChallenge,
            attestation: mutateBase64( signedChallenge.attestation )
        }

        expect.assertions(1);
        try {
            await handleLogin( badChallenge, authStore, options );
        } catch(error) {
            expect(error.message.startsWith('Failed to parse attestation:')).toBe( true );
        }
    });

    test('missing canonical URI in attestation', async () => {
        const options = { mocks: { agenticProfile } };
        const badChallenge = {
            ...signedChallenge,
            attestation: objectToBase64({foo:"bar"})
        }

        expect.assertions(1);
        try {
            await handleLogin( badChallenge, authStore, options );
        } catch(error) {
            expect(error.message).toBe( "Missing canonicalUri in attestation" );
        }
    });
});
