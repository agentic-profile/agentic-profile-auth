import {
    AgenticProfile,
    AgentService,
    Base64Url,
    DID,
    FragmentID,
    JWKSet,
    matchingFragmentIds
} from "@agentic-profile/common";
import { VerificationMethod } from "did-resolver";

export function resolveVerificationKey( agentDid: DID, profile: AgenticProfile, keyring: JWKSet[] ) {
    const agent = profile.service?.find(e=>matchingFragmentIds( e.id, agentDid ) ) as AgentService;
    if( !agent )
        throw new Error("Failed to find agent service for " + agentDid );

    for( const idOrMethod of agent.capabilityInvocation ) {
        let verificationId: FragmentID;
        let verificationMethod: VerificationMethod | undefined;

        if( typeof idOrMethod === 'string' ) {
            verificationId = idOrMethod as FragmentID;
            const found = profile.verificationMethod?.find(e=>e.id===verificationId);
            if( !found ) {
                console.log( `INVALID agentic profile, verification method does not resolve for ${agentDid} verification id ${verificationId}` );
                continue;   // invalid AgenticProfile... fix!
            }
            verificationMethod = found;
        } else {
            verificationMethod = idOrMethod as VerificationMethod;
            verificationId = verificationMethod.id;
        }

        if( verificationMethod.type !== "JsonWebKey2020" ) {
            console.log( `Skipping unsupported verification type ${verificationMethod.type} for ${agentDid}` )
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

    throw new Error("Failed to find a cap " + agentDid );
}

function resolvePrivateJwk( keyring: JWKSet[], b64uPublicKey: Base64Url ) {
    return keyring.find(e=>e.b64uPublicKey===b64uPublicKey)?.privateJwk;
}