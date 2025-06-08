import {
    createTimer,
    prettyJson
} from "@agentic-profile/common";
import {
    AgenticChallenge,
    AGENTIC_CHALLENGE_TYPE,
    RemoteAgentSessionKey,
    RemoteAgentSessionStore
} from "../models.js";
import { base64UrlToObject } from "../b64u.js";

type SendAgenticPayloadParams = {
    authToken?: string,
    fetchImpl?: typeof fetch,
    method?: "PUT" | "POST",
    payload: any,
    resolveAuthToken?: ( agenticChallenge: AgenticChallenge )=>Promise<string>,
    sessionKey?: RemoteAgentSessionKey,
    store: RemoteAgentSessionStore,
    url: string
}

export async function sendAgenticPayload({
    authToken,
    fetchImpl,
    method = "PUT",
    payload,
    resolveAuthToken,
    sessionKey,
    store,
    url 
}: SendAgenticPayloadParams) {
    if( sessionKey && sessionKey.peerServiceUrl && sessionKey.peerServiceUrl != url )
        throw new Error(`sendAgenticPayload() sessionKey.peerServiceUrl != url for ${url}`);

    let fetchResponse: any;
    const { elapsed } = createTimer(`sendAgenticPayload(${url})`);

    if( !authToken && sessionKey ) {
        const session = await store.fetchRemoteAgentSession( sessionKey );
        elapsed( "fetched remote agent session", !!session, sessionKey );
        if( session )
            authToken = session.authToken;
    }

    if( authToken ) {
        // if we were given an auth token, give it a try...
        fetchResponse = await fetchJson( url, payload, {
            fetchImpl,
            dontThrow: true,
            method,
            headers: {
                "Authorization": 'Agentic ' + authToken,
            },
        });
        elapsed( "initial fetch with authToken", fetchResponse.response.ok, url );

        // simple case, ok :)
        if( fetchResponse.response.ok )
            return fetchResponse;

        // auth didn't work, so...
        // get rid of this session with invalid auth token
        if( sessionKey ) {
            await store.deleteRemoteAgentSession( sessionKey );
            elapsed( "deleted remote agent session; initial auth failed" );
        }
    } else {
        // no authToken provided, do a request that might work, or might return a 401 with an agentic challenge
        fetchResponse = await fetchJson( url, payload, {
            fetchImpl,
            dontThrow: true,
            method,
        });
        elapsed( "initial fetch with NO authToken", fetchResponse.response.ok, url );

        if( fetchResponse.response.ok )
            return fetchResponse;   // No auth needed, and that's ok :)
    }

    // ensure we got an agentic challenge in WWW-Authenticate header
    const { data, response } = fetchResponse;
    const { status, statusText, headers } = response;
    if( status !== 401 )
        throw new Error(`Unexpected response ${status} ${statusText} from agentic service ${url} - ${prettyJson(data)}`); 

    const challenge = parseChallengeFromWwwAuthenticate( headers?.get('WWW-Authenticate'), url );
    if( !resolveAuthToken )
        throw new Error(`Cannot resolve authorization for challenge from ${url} - missing callback`);
    authToken = await resolveAuthToken( challenge );
    
    elapsed( "resolved authToken", abbreviate( authToken ), "Retrying request..." );

    // 2nd try with auth new token - may throw an Error on response != ok
    fetchResponse = await fetchJson( url, payload, {
        fetchImpl,
        method,
        headers: {
            "Authorization": 'Agentic ' + authToken,
        },
    });
    elapsed( "second fetch with new authToken", fetchResponse.response.ok, url );

    // if authToken worked, then remember it
    if( fetchResponse.response.ok && sessionKey ) {
        await store.updateRemoteAgentSession( sessionKey, { authToken } );
        elapsed( "updated remote agent session", fetchResponse.response.ok );
    }

    return fetchResponse;
}

export function parseChallengeFromWwwAuthenticate( wwwAuthenticate: string | null | undefined, url?: string ) {
    if( !wwwAuthenticate )
        throw new Error(`No WWW-Authenticate header from agentic service ${url}`);
    console.log( 'WWW-Authenticate', wwwAuthenticate );
    const [ scheme, b64uChallenge ] = wwwAuthenticate.trim().split(/\s+/);
    if( scheme.toLowerCase() !== 'agentic')
        throw new Error(`Unexpected WWW-Authenticate scheme ${scheme} from agentic service ${url}`);

    const challenge = base64UrlToObject<AgenticChallenge>( b64uChallenge );
    if( challenge.type !== AGENTIC_CHALLENGE_TYPE )
        throw new Error(`Unexpected agentic challenge type from agentic service ${url} - ${prettyJson(challenge)}`);

    return challenge;
}

function abbreviate( s: string ) {
    return s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;
}

type FetchJsonOptions = {
    method?: "GET" | "PUT" | "POST",
    headers?: any,
    dontThrow?: boolean, // if true, return { data, response } instead of throwing an error
    fetchImpl?: typeof fetch
}

export async function getJson( url: string, options: FetchJsonOptions = {} ) {
    return fetchJson( url, undefined, { ...options, method: "GET" } );
}

export async function putJson( url: string, payload: any, options: FetchJsonOptions = {} ) {
    return fetchJson( url, payload, { ...options, method: "PUT" } );
}

export async function postJson( url: string, payload: any, options: FetchJsonOptions = {} ) {
    return fetchJson( url, payload, { ...options, method: "POST" } );
}

export async function fetchJson( url: string, payload: any, options: FetchJsonOptions = {} ) {
    const { dontThrow, fetchImpl = fetch, ...fetchOptions } = options;
    const config = {
        method: "GET",
        headers: {},
        ...fetchOptions
    } as any;

    if( !config.body && !!payload ) {
        config.body = JSON.stringify( payload );
        if( !hasHeader( config, "content-type") )
            config.headers['Content-Type'] = "application/json";
        if( config.method !== "PUT" && config.method !== "POST" )
            throw new Error(`Invalid HTTP method ${config.method} for fetchJson with payload: ${url}`)
    }
    config.headers["Accept"] = "application/json";

    let response: Response | undefined;
    try {
        response = await fetchImpl( url, config );
    } catch( error ) {
        console.log('fetchJson() failed to fetch', url, error);
        if( options.dontThrow ) {
            return {
                data: undefined,
                response: { ok: false, status: 500, statusText: `Failed to fetch: ${config.method} ${url}` }
            };
        } else {
            throw new Error(`Failed to fetch ${url} - ${error}`)
        }
    }
    
    // handle responses with no body (e.g. 401 with agentic challenge)
    const responseText = await response.text();
    let data;
    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.log( 'Bad response data, not JSON', responseText );
            const message = (e as Error).message;
            const statusText = `Bad response data, not JSON from ${config.method} ${url} - ${response.status} ${response.statusText} - ${message}`;
            if( options.dontThrow ) {
                return {
                    data: responseText,
                    response: { ok: false, status: 500, statusText }
                };
            } else {
                throw new Error( statusText );
            }
        }
    }

    /*
    if( !response.ok && options.dontThrow !== true ) {
        console.log( 'Bad response data', prettyJson( data ) );
        const message = data?.failure?.message ?? response?.statusText;
        throw new Error(`Failed to fetch ${url} - ${response?.status} ${message}`)
    }*/

    return { data, response };
}

function hasHeader( config: any, type: string ) {
    const headers = config.headers;
    if( !headers )
        return false;
    for( const key in headers )
        if( key.toLowerCase() === type )
            return true;

    return false;
}
