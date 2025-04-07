import {
    agentHooks,
    prettyJson
} from "@agentic-profile/common";
import {
    AgenticChallenge,
    AGENTIC_CHALLENGE_TYPE,
    RemoteAgentSessionKey,
    RemoteAgentSessionStorage
} from "../models.js";

type SendAuthorizedPayloadParams = {
    authToken?: string,
    method?: "PUT" | "POST",
    payload: any,
    resolveAuthToken?: ( agenticChallenge: AgenticChallenge )=>Promise<string>,
    sessionKey?: RemoteAgentSessionKey,
    url: string
}

export async function sendAgenticPayload({ authToken, method = "PUT", payload, resolveAuthToken, sessionKey, url }: SendAuthorizedPayloadParams) {
    let fetchResponse: any;

    if( !authToken && sessionKey ) {
        const session = await agentHooks<RemoteAgentSessionStorage>().fetchRemoteAgentSession?.( sessionKey );
        if( session ) {
            if( session.peerServiceUrl !== url ) {
                // peer service url has changed... prepare to start new session 
                await agentHooks<RemoteAgentSessionStorage>().deleteRemoteAgentSession?.( sessionKey );
            } else
                authToken = session.authToken;
        }
    }

    if( authToken ) {
        // if we were given an auth token, give it a try...
        fetchResponse = await fetchJson( url, payload, {
            dontThrow: true,
            method,
            headers: {
                "Authorization": 'Agentic ' + authToken,
            },
        });

        // simple case, ok :)
        if( fetchResponse.response.ok )
            return fetchResponse;

        // auth didn't work, so...
        // get rid of this session with invalid auth token
        if( sessionKey )
            await agentHooks<RemoteAgentSessionStorage>().deleteRemoteAgentSession?.( sessionKey );
    } else {
        if( !resolveAuthToken )
            throw new Error(`Cannot fetch ${url} without an authorization token`);

        // no authToken provided, so dummy request to get agentic challenge
        console.log( `No authToken provided, requesting challenge from ${url}` );
        fetchResponse = await fetchJson( url, undefined, {
            dontThrow: true,
            method,
        });
    }

    // ensure we got an agentic challenge
    const { data, response } = fetchResponse;
    const { status, statusText } = response;
    if( status !== 401 || data?.type !== AGENTIC_CHALLENGE_TYPE )
        throw new Error(`Unexpected response ${status} ${statusText} from agentic service ${url} - ${prettyJson(data)}`); 

    if( !resolveAuthToken )
        throw new Error(`Cannot resolve authorization for challenge from ${url} - missing callback`);

    authToken = await resolveAuthToken( data as AgenticChallenge );
    console.log( "Resolved authToken", abbreviate( authToken ), "Retrying request..." );

    // 2nd try with auth new token - may throw an Error on response != ok
    fetchResponse = await fetchJson( url, payload, {
        method,
        headers: {
            "Authorization": 'Agentic ' + authToken,
        },
    });

    // if authToken worked, then remember it
    if( fetchResponse.response.ok && sessionKey )
        await agentHooks<RemoteAgentSessionStorage>().updateRemoteAgentSession?.( sessionKey, { authToken } );

    return fetchResponse;
}

function abbreviate( s: string ) {
    return s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;
}


type FetchJsonOptions = {
    method?: "GET" | "PUT" | "POST",
    headers?: any,
    dontThrow?: boolean
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
    const config = {
        method: "GET",
        headers: {},
        ...options
    } as any;

    if( options.dontThrow )
        delete config.dontThrow;    // remove extra options from config

    if( !config.body && !!payload ) {
        config.body = JSON.stringify( payload );
        if( !hasHeader( config, "content-type") ) {
            config.headers['Content-Type'] = "application/json";
        }
        if( config.method !== "PUT" && config.method !== "POST" )
            throw new Error(`Invalid HTTP method ${config.method} for fetchJson with payload: ${url}`)
    }
    config.headers["Accept"] = "application/json";

    const response = await fetch( url, config );
    if( !response.ok && options.dontThrow !== true )
        throw new Error(`Failed to fetch ${url} - ${response.status} ${response.statusText}`)

    const data = await response.json();
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