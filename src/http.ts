import {
    getLogger,
    prettyJson,
    ServerError
} from "@agentic-profile/common";
import { AGENTIC_CHALLENGE_TYPE, AgenticChallenge } from "./types.js";
import { base64UrlToObject } from "./b64u.js";

const log = getLogger("auth.http");

export function parseChallengeFromWwwAuthenticate(wwwAuthenticate: string | null | undefined, url?: string) {
    if (!wwwAuthenticate)
        throw new Error(`No WWW-Authenticate header from agentic service ${url}`);
    log.debug('WWW-Authenticate', wwwAuthenticate);
    const [scheme, b64uChallenge] = wwwAuthenticate.trim().split(/\s+/);
    if (scheme.toLowerCase() !== 'agentic')
        throw new ServerError({
            kind:'InvalidParameters',
            message:`Unexpected WWW-Authenticate scheme ${scheme} from agentic service ${url}`
        });

    const challenge = base64UrlToObject<AgenticChallenge>(b64uChallenge);
    if (challenge.type !== AGENTIC_CHALLENGE_TYPE)
        throw new ServerError({
            kind:'InvalidParameters',
            message:`Unexpected agentic challenge type from agentic service ${url} - ${prettyJson(challenge)}`
        });

    return challenge;
}