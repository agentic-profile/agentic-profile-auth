import { prettyJSON } from "@agentic-profile/common";
import {
    AgenticChallenge,
    AGENTIC_CHALLENGE_TYPE
} from "../models.js";

type SendAuthorizedPayloadParams = {
    authToken?: string,
    method?: "PUT" | "POST",
    payload: any,
    resolveAuthToken?: ( agenticChallenge: AgenticChallenge )=>Promise<string>,
    url: string
}

export async function sendAuthorizedPayload({ authToken, method = "PUT", payload, resolveAuthToken, url }: SendAuthorizedPayloadParams) {
    let fetchResponse: any;
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
    } else {
        if( !resolveAuthToken )
            throw new Error(`Cannot fetch ${url} without an authorization token`);

        // no authToken provided, so dummy request to get agentic challenge
        fetchResponse = await fetchJson( url, undefined, {
            dontThrow: true,
            method,
        });
    }

    // ensure we got an agentic challenge
    console.log( "ensureAgenticChallenge", prettyJSON(fetchResponse) );
    const { data } = fetchResponse;
    const { status, statusCode } = response;
    if( statusCode !== 401 || data?.type !== AGENTIC_CHALLENGE_TYPE )
        throw new Error(`Unexpected response ${statusCode} ${status} from agentic service ${url} - ${prettyJSON(data)}`); 

    if( !resolveAuthToken )
        throw new Error(`Cannot resolve authorization for challenge from ${url} - missing callback`);

    authToken = await resolveAuthToken( data as AgenticChallenge );

    // 2nd try with auth new token - may throw an Error on response != ok
    return await fetchJson( url, payload, {
        method,
        headers: {
            "Authorization": 'Agentic ' + authToken,
        },
    });
}

type FetchJsonOptions = {
    method?: "GET" | "PUT" | "POST",
    headers?: any,
    dontThrow?: boolean
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