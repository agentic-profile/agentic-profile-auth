import {
    AgenticProfile,
    AgentService,
    Base64Url,
    DID,
    FragmentID,
    JWKSet,
    matchingFragmentIds,
    removeFragmentId,
    resolveFragmentId
} from "@agentic-profile/common";
import { VerificationMethod } from "did-resolver";

import { AgenticChallenge } from "../models.js";
import { signChallenge } from "./client-authentication.js";


export interface ProfileAndKeyring {
    profile: AgenticProfile,
    keyring: JWKSet[]
}

export type ProfileAndKeyringResolver = ( did: DID ) => Promise<ProfileAndKeyring>

export type GenerateAuthTokenParams = {
    agentDid: DID,
    agenticChallenge: AgenticChallenge,
    profileResolver: ProfileAndKeyringResolver
}

export async function generateAuthToken({ agentDid, agenticChallenge, profileResolver }: GenerateAuthTokenParams) {
    /*
    const { profile, keyring } = await loadProfileAndKeyring( profileDir );
    if( !profile )
        throw new Error(`Failed to load agentic profile from ${profileDir}/did.json`);
    if( !keyring )
        throw new Error(`Failed to load agentic keyring from ${profileDir}/keyring.json`);
    
    const agentDid = `${profile.id}#agent-${agentSubtype}`;
    */

    const { verificationId, privateJwk } = await resolveVerificationKey( agentDid, profileResolver );
    const attestation = { agentDid, verificationId };
    const { challenge } = agenticChallenge;
    return await signChallenge({ challenge, attestation, privateJwk });
}

export async function resolveVerificationKey( agentDid: DID, profileResolver: ProfileAndKeyringResolver ) {

    let { profile, keyring } = await profileResolver( agentDid );

    const agent = profile.service?.find(e=>matchingFragmentIds( e.id, agentDid ) ) as AgentService;
    if( !agent )
        throw new Error("Failed to find agent service for " + agentDid );

    for( const idOrMethod of agent.capabilityInvocation ) {
        let verificationId: FragmentID;
        let verificationMethod: VerificationMethod | undefined;

        if( typeof idOrMethod === 'string' ) {
            verificationId = idOrMethod as DID;     // (might reference key in another DID Document!)

            // follow to another document?
            const documentId = removeFragmentId( verificationId );
            if( documentId.length > 0 && documentId !== profile.id ) {
                console.log( `Redirecting to linked profile ${documentId} of ${verificationId}` );
                ({ profile, keyring } = await profileResolver( documentId ));
            }

            // Agentic profile requires verification method ids to be just fragments
            const { fragment } = resolveFragmentId( verificationId );
            if( !fragment )
                throw new Error(`Failed to extract fragment id from ${verificationId} in ${profile.id}`);
            const fragmentId = '#' + fragment;

            const found = profile.verificationMethod?.find(e=>e.id === fragmentId);
            if( !found ) {
                console.log( `INVALID agentic profile, verification method does not resolve for ${agentDid} verification id ${verificationId}` );
                continue;   // invalid AgenticProfile... fix!
            }
            verificationMethod = found;
        } else if( typeof idOrMethod === 'object' ) {
            verificationMethod = idOrMethod as VerificationMethod;
            verificationId = verificationMethod.id;
        } else
            throw new Error(`INVALID agentic profile, verification method is of unknown type: ${typeof idOrMethod} for ${profile.id}`);

        if( verificationMethod.type !== "JsonWebKey2020" ) {
            console.log( `Skipping unsupported verification type ${verificationMethod.type} for ${profile.id}` )
            continue;
        }

        const b64uPublicKey = verificationMethod.publicKeyJwk?.x;    // Only for JsonWebKey2020!
        if( !b64uPublicKey )
            throw new Error(`Failed to find public key for ${agentDid} verificationMethod ${verificationId}` );

        const privateJwk = resolvePrivateJwk( keyring, b64uPublicKey );
        if( !privateJwk )
            throw new Error(`Failed to find private key for ${agentDid} public key ${b64uPublicKey}` );

        return { verificationId, privateJwk };
    }

    throw new Error("Failed to find a verification key for " + agentDid );
}

function resolvePrivateJwk( keyring: JWKSet[], b64uPublicKey: Base64Url ) {
    return keyring.find(e=>e.b64uPublicKey===b64uPublicKey)?.privateJwk;
}