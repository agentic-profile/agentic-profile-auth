import {
    CompactSign,
    generateKeyPair,
    exportJWK,
    importJWK,
    SignJWT,
    jwtVerify
} from "jose";
import { VerificationMethod } from "did-resolver";
import {
    DID,
    FragmentID,
    resolveDocumentPartId,
    resolveFragmentId,
    setAgentHooks
} from "@agentic-profile/common";

import {
    createChallenge,
    handleAuthorization,
    handleLogin,
} from "../src/server/server-authentication";
import {
    asPayload,
    signChallenge,
} from "../src/client/client-authentication";
import {
    OpaqueChallenge,
    VerificationKey
} from "../src/models";
import {
    authStore,
    prettyJSON
} from "./util";
import {
    createEdDsaJwk,
    sign,
    verify
} from "../src/ed25519";


// Ugh, agentHooks are outside testing scope...
const agenticProfileMap = new Map<DID,AgenticProfile>();
function registerProfile( profile: AgenticProfile ) {
    agenticProfileMap.set( profile.id, profile );
    console.log( 'registered profile', profile.id );
}
const didResolver = {
    resolve: ( did: DID ) => {
        const id = did.split('#')[0];

        const didDocument = agenticProfileMap.get( id );
        console.log( 'resolve', id, !!didDocument );

        const didResolutionMetadata = didDocument ? { contentType: "application/json" }
            : {
                error: `Failed to resolve DID document ${id}`,
                message: "DID does not have a document",
            };

        return {
            didDocument,
            didDocumentMetadata: {},
            didResolutionMetadata
        }
    }
}
setAgentHooks({ didResolver });

let nextUserId = 1;
function nextDid() {
    return `did:web:example.com:${nextUserId++}`;
}

describe("Agent Authentication with JWS and DID based Agentic Profiles", () => {

    test("compare signatures", async () => {
        const { challenge } = await createChallenge( authStore );

        const did = nextDid();
        const { localKeys, joseKeys } = await createKeys( did );

        const attestation = {
            agentDid: did + "#myagent",
            verificationId: "#my-agent-key"
        } as Attestation;

        const joseSignedLocal = await joseSignChallenge({
            challenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });
        //console.log( "joseSignedLocal", prettyJSON( joseSignedLocal ));

        const localSignedLocal = await signChallenge({
            challenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });
        //console.log( "localSignedLocal", prettyJSON( localSignedLocal ));

        expect( joseSignedLocal ).toBe( localSignedLocal );

        // Use Jose keys, and see if both jose and local signers agree

        const joseSignedJose = await joseSignChallenge({
            challenge,
            privateJwk: joseKeys.privateJwk,
            attestation
        });
        //console.log( "joseSignedJose", prettyJSON( joseSignedJose ));

        const localSignedJose = await signChallenge({
            challenge,
            privateJwk: joseKeys.privateJwk,
            attestation
        });
        //console.log( "localSignedJose", prettyJSON( localSignedJose ));

        expect( joseSignedJose ).toBe( localSignedJose );
    });

    test("handle login with top-level verification method", async () => {
        // create a server style challenge sent to the client
        const { challenge } = await createChallenge( authStore );

        const did = nextDid();
        const { localKeys, localVerificationMethod, joseKeys } = await createKeys( did );

        const { agentService, attestation } = craftAgentService( did, localVerificationMethod.id );

        // as the client, sign the challenge
        const authToken = await signChallenge({
            challenge,
            attestation,
            privateJwk: localKeys.privateJwk
        });

        const agenticProfile = {
            ...craftAgenticProfile( did ),
            verificationMethod: [
                localVerificationMethod
            ],
            service:[
                agentService
            ]
        };
        registerProfile( agenticProfile );

        const options = { mocks: { agenticProfile } };
        const session = await handleAuthorization( "Agentic " + authToken, authStore );
        expect( !!session ).toBe( true );
    });

    test("handle login with service scoped verification method", async () => {
        // create a server style challenge sent to the client
        const { challenge } = await createChallenge( authStore );

        const did = nextDid();
        const { localKeys, localVerificationMethod, joseKeys } = await createKeys( did );

        const { agentService, attestation } = craftAgentService( did, localVerificationMethod );

        // as the client, sign the challenge
        const authToken = await joseSignChallenge({
            challenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });

        const agenticProfile = {
            ...craftAgenticProfile( did ),
            service:[
                agentService
            ]
        };
        registerProfile(  agenticProfile );

        const session = await handleAuthorization( "Agentic " + authToken, authStore );
        expect( !!session ).toBe( true );
    });
});

async function createKeys( did:DID ) {
    const localKeys = await createEdDsaJwk();
    const localVerificationMethod = {
        id: did + "#vm-local",
        type: "JsonWebKey2020",
        publicKeyJwk: localKeys.publicJwk
    };

    const joseKeys = await createJoseJwk();
    const joseVerificationMethod = {
        id: did + "#vm-jose",
        type: "JsonWebKey2020",
        publicKeyJwk: joseKeys.publicJwk
    };

    return {
        localKeys,
        localVerificationMethod,
        joseKeys,
        joseVerificationMethod
    }
}

type Params = {
    challenge: OpaqueChallenge,
    privateJwk: EdDSAPrivateJWK,
    attestation: Attestation   
}

// returns the JWS string
async function joseSignChallenge({ challenge, privateJwk, attestation }: Params ) {
    const payload = asPayload( challenge, attestation );
    const payloadBytes = new TextEncoder().encode( JSON.stringify( payload ) );
    return await new CompactSign( payloadBytes )
        .setProtectedHeader({ alg: "EdDSA" })
        .sign(privateJwk);
}

async function createJoseJwk() {
    // 1. Generate an Ed25519 key pair
    const { publicKey, privateKey } = await generateKeyPair( "Ed25519", { extractable: true } );
    //console.log( "createJoseJWK", publicKey, privateKey );

    // 2. Export the private and public key in JWK format
    const privateJwk = await exportJWK(privateKey);
    privateJwk.alg = "EdDSA";       // Add the algorithm for JWS signing
    privateJwk.key_ops = ["sign"];  // Specify key operations
    privateJwk.use = "sig";         // Key usage for signing

    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = "EdDSA";        // Required for verification
    publicJwk.key_ops = ["verify"]; // Specify key operations
    publicJwk.use = "sig";          // Key usage for verification

    const result = { publicJwk, privateJwk };
    //console.log( "jose jwk", prettyJSON( result ) );

    return result;
}

function craftAgenticProfile( id: DID ) {
    return {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/jws-2020/v1",
            "https://iamagentic.org/ns/agentic-profile/v1"
        ],
        id,
        name: "Dave"
    };
}

function craftAgentService( did: DID, verificationMethod: FragmentID | VerificationMethod ) {
    //console.log('craftAgenticService',did,verificationMethod);

    const agentService = {
        id: did + "#agentic-chat",
        type: "Agentic/Chat",
        serviceEndpoint: "https://localhost:3003/v1/agent-chat",
        capabilityInvocation: [
            verificationMethod
        ]
    };

    const verificationId = resolveDocumentPartId( verificationMethod );

    const attestation = {
        agentDid: agentService.id,
        verificationId
    } as Attestation;

    return { agentService, attestation };
}