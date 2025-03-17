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
    createChallenge,
    handleAuthorization,
    handleLogin,
} from "../src/server/server-authentication";
import {
    asPayload,
    signChallenge,
} from "../src/client/client-authentication";
import {
    DID,
    FragmentID,
    VerificationKey
} from "../src/models";
import {
    resolveDocumentPartId,
    resolveFragmentId
} from "../src/util";
import {
    authStore,
    prettyJSON
} from "./util";
import {
    createEdDsaJwk,
    sign,
    verify
} from "../src/ed25519";


describe("Agent Authentication with JWS and DID based Agentic Profiles", () => {

    const did = "did:web:localhost%3A3003:iam:7"
    let localKeys, joseKeys;
    let localVerificationMethod, joseVerificationMethod;

    beforeAll( async () => {
        localKeys = await createEdDsaJwk();
        localVerificationMethod = {
            id: did + "#vm-local",
            type: "JsonWebKey2020",
            publicKeyJwk: localKeys.publicJwk
        };

        joseKeys = await createJoseJwk();
        joseVerificationMethod = {
            id: did + "#vm-jose",
            type: "JsonWebKey2020",
            publicKeyJwk: joseKeys.publicJwk
        };
    });

    test("compare signatures", async () => {
        const agenticChallenge = await createChallenge( authStore );

        const attestation = {
            agentDid: did + "#myagent",
            verificationId: "#my-agent-key"
        } as Attestation;

        const joseSignedLocal = await joseSignChallenge({
            agenticChallenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });
        //console.log( "joseSignedLocal", prettyJSON( joseSignedLocal ));

        const localSignedLocal = await signChallenge({
            agenticChallenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });
        //console.log( "localSignedLocal", prettyJSON( localSignedLocal ));

        expect( joseSignedLocal ).toBe( localSignedLocal );

        // Use Jose keys, and see if both jose and local signers agree

        const joseSignedJose = await joseSignChallenge({
            agenticChallenge,
            privateJwk: joseKeys.privateJwk,
            attestation
        });
        //console.log( "joseSignedJose", prettyJSON( joseSignedJose ));

        const localSignedJose = await signChallenge({
            agenticChallenge,
            privateJwk: joseKeys.privateJwk,
            attestation
        });
        //console.log( "localSignedJose", prettyJSON( localSignedJose ));

        expect( joseSignedJose ).toBe( localSignedJose );
    });

    test("handle login with top-level verification method", async () => {
        // create a server style challenge sent to the client
        const agenticChallenge = await createChallenge( authStore );

        const { agentService, attestation } = craftAgentService( did, localVerificationMethod.id );

        // as the client, sign the challenge
        const jwsSignedChallenge = await signChallenge({
            agenticChallenge,
            privateJwk: localKeys.privateJwk,
            attestation
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
        //console.log( "agentic profile", prettyJSON( agenticProfile ) );

        // simulate login using the JWS signed challenge
        const options = { mocks: { agenticProfile } };
        const { authToken } = await handleLogin({ jwsSignedChallenge }, authStore, options );

        const session = await handleAuthorization( "Agentic " + authToken, authStore );
        expect( !!session ).toBe( true );
    });

    test("handle login with service scoped verification method", async () => {
        // create a server style challenge sent to the client
        const agenticChallenge = await createChallenge( authStore );

        const { agentService, attestation } = craftAgentService( did, localVerificationMethod );

        // as the client, sign the challenge
        const jwsSignedChallenge = await joseSignChallenge({
            agenticChallenge,
            privateJwk: localKeys.privateJwk,
            attestation
        });

        const agenticProfile = {
            ...craftAgenticProfile( did ),
            service:[
                agentService
            ]
        };
        //console.log( "agentic profile with scoped service keys", prettyJSON( agenticProfile ) );

        // simulate login using the JWS signed challenge
        const options = { mocks: { agenticProfile } };
        const { authToken } = await handleLogin({ jwsSignedChallenge }, authStore, options );

        //const session = await handleAuthorization( "Agentic " + agentToken, authStore );
    });
});

type Params = {
    agenticChallenge: AgenticChallenge,
    privateJwk: EdDSAPrivateJWK,
    attestation: Attestation   
}

// returns the JWS string
async function joseSignChallenge({ agenticChallenge, privateJwk, attestation }: Params ) {
    const payload = asPayload( agenticChallenge, attestation );
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
        type: "AgenticChat",
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