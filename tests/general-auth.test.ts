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
import {
    authStore,
    BASE_64_REGEX,
    mutateBase64,
    isBase64key
} from "./util";

//
// Tests a general signature using a publicKey in the agenticProfile.keyring and
// NOT in an agents keyring (e.g. agenticProfile.agents[N].keyring )
//

describe("General Profile Authentication", () => {

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
            //agentUrl: "https://agents.matchwise.ai/v1/agents/7/agentic-chat"
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
            //console.log( error.message );
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
            //console.log( 'corrupted attestation', error.message );

            // when the JSON is valid, but is different than what was signed
            const isSigInvalid = error.message === "Invalid signed challenge and attestation";

            // when the base64 encoding is currupted and the JSON becomes invalid
            const isParseFailure = error.message.startsWith('Failed to parse attestation:');
            expect( isParseFailure || isSigInvalid ).toBe( true );
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
