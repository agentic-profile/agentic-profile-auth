import {
    AgenticProfile,
    AgentService,
    DID,
    EdDSAPrivateJWK,
    FragmentID,
    JWKSet,
    matchingFragmentIds,
    parseDid
} from "@agentic-profile/common";
import { VerificationMethod } from "did-resolver";
import log from "loglevel";

import { AgenticChallenge } from "../types.js";
import { signChallenge } from "./client-authentication.js";


export interface ProfileAndKeyring {
    profile: AgenticProfile,
    keyring: JWKSet[]
}

export interface VerificationKey {
    verificationId: FragmentID;
    privateJwk: EdDSAPrivateJWK;
}

type VerificationKeyResult = VerificationKey | undefined;

export type ProfileAndKeyringResolver = (did: DID) => Promise<ProfileAndKeyring>

export type GenerateAuthTokenParams = {
    agentDid: DID,
    agenticChallenge: AgenticChallenge,
    profileResolver: ProfileAndKeyringResolver
}

export async function generateAuthToken({ agentDid, agenticChallenge, profileResolver }: GenerateAuthTokenParams) {
    const { verificationId, privateJwk } = await resolveVerificationKey(agentDid, profileResolver);
    const attestation = { agentDid, verificationId };
    const { challenge } = agenticChallenge;
    return await signChallenge({ challenge, attestation, privateJwk });
}

export async function resolveVerificationKey(agentDid: DID, profileResolver: ProfileAndKeyringResolver): Promise<VerificationKey> {
    let { profile, keyring } = await profileResolver(agentDid);

    const { fragment } = parseDid(agentDid);
    if (!fragment) {
        // "naked" agent did, derive key from verificationMethods
        for (const idOrMethod of profile.verificationMethod || []) {
            if (typeof idOrMethod === 'string')
                continue; // skip references to other DID documents
            if (typeof idOrMethod !== 'object')
                throw new Error(`INVALID agentic profile, verification method is of unknown type: ${typeof idOrMethod} for ${agentDid}`);

            const verificationId = (idOrMethod as VerificationMethod).id;
            const result = resolvePrivateJwk(agentDid, idOrMethod, verificationId, keyring, profile);
            if (result)
                return result;
        }

        throw new Error("Failed to derive verification method for " + agentDid);
    }

    // Either the fragment matches a service, or a verification method in the same document
    const agent = profile.service?.find(e => matchingFragmentIds(e.id, agentDid)) as AgentService;
    if (!agent) {
        const vm = profile.verificationMethod?.find(e => matchingFragmentIds(e.id, agentDid));
        if (!vm)
            throw new Error("Failed to find agent service or verification method for " + agentDid);

        const resolution = await resolveIdOrMethod(vm, profile, keyring, profileResolver, agentDid);
        if (resolution)
            return resolution;
        else
            throw new Error("Failed to find agent service or verification method for " + agentDid);
    }

    // agent DID includes service id, so pick a verification method of the service...
    for (const idOrMethod of agent.capabilityInvocation) {
        const resolution = await resolveIdOrMethod(idOrMethod, profile, keyring, profileResolver, agentDid);
        if (resolution)
            return resolution;
    }

    throw new Error("Failed to find a verification key for " + agentDid);
}

async function resolveIdOrMethod(
    idOrMethod: string | VerificationMethod,
    profile: AgenticProfile,
    keyring: JWKSet[],
    profileResolver: ProfileAndKeyringResolver,
    agentDid: DID
): Promise<VerificationKeyResult> {
    let verificationId: FragmentID;
    let verificationMethod: VerificationMethod | undefined;

    if (typeof idOrMethod === 'string') {
        verificationId = idOrMethod as DID;     // (might reference key in another DID Document!)

        // follow to another document?
        const { did: documentId, fragment } = parseDid(verificationId);
        if (documentId.length > 0 && documentId !== profile.id) {
            log.debug(`resolveVerificationKey() using linked profile ${documentId} of ${verificationId}`);
            ({ profile, keyring } = await profileResolver(documentId));
        }

        // Agentic profile requires verification method ids to be just fragments
        if (!fragment)
            throw new Error(`Failed to extract fragment id from ${verificationId} in ${profile.id}`);
        const fragmentId = '#' + fragment;

        const found = profile.verificationMethod?.find(e => e.id === fragmentId);
        if (!found) {
            log.warn(`INVALID agentic profile, verification method does not resolve for ${agentDid} verification id ${verificationId}`);
            return undefined;   // invalid AgenticProfile... fix!  (and keep looking for now...)
        }
        verificationMethod = found;
    } else if (typeof idOrMethod === 'object') {
        verificationMethod = idOrMethod as VerificationMethod;
        verificationId = verificationMethod.id;
    } else
        throw new Error(`INVALID agentic profile, verification method is of unknown type: ${typeof idOrMethod} for ${profile.id}`);

    return resolvePrivateJwk(agentDid, verificationMethod, verificationId, keyring, profile);
}

function resolvePrivateJwk(
    agentDid: DID,
    verificationMethod: VerificationMethod,
    verificationId: FragmentID,
    keyring: JWKSet[],
    profile: AgenticProfile,
    failOnUnavailableKey: boolean = true
): VerificationKeyResult {
    if (verificationMethod.type !== "JsonWebKey2020") {
        log.warn(`Skipping unsupported verification type ${verificationMethod.type} for ${profile.id}`)
        return undefined;
    }

    const b64uPublicKey = verificationMethod.publicKeyJwk?.x;    // Only for JsonWebKey2020!
    if (!b64uPublicKey)
        throw new Error(`Failed to find public key for ${agentDid} verificationMethod ${verificationId}`);

    const privateJwk = keyring.find(e => e.b64uPublicKey === b64uPublicKey)?.privateJwk
    if (!privateJwk)
        if (failOnUnavailableKey)
            throw new Error(`Failed to find private key for ${agentDid} public key ${b64uPublicKey}`);
        else
            return undefined;

    return { verificationId, privateJwk };
}
