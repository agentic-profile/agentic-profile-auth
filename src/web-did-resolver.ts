import axios from "axios";
import { 
    DIDDocument,
    DIDResolutionResult,
    DIDResolver,
    parse,
    ParsedDID
} from "did-resolver";

export function getResolver(): Record<string, DIDResolver> {
    async function resolve(did: string, parsed: ParsedDID): Promise<DIDResolutionResult> {
        let url;
        try {
            url = webDidToUrl( did, parsed );
            const { data } = await axios.get(url);
            const didDocument = data as DIDDocument;

            const contentType = didDocument?.["@context"] ? "application/did+ld+json" : "application/did+json";
            return {
                didDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: { contentType },
            }
        } catch (error: any) {
            return {
                didDocument: null,
                didDocumentMetadata: {},
                didResolutionMetadata: {
                    error: `Failed to resolve DID document ${url ? 'from ' + url : ''}`,
                    message: error.message,
                }
            }
        }
    }

    return { web: resolve }
}

function selectProtocol( path: string ) {
    return path.startsWith("localhost") ? "http" : "https";
}

export function webDidToUrl( did: string, parsed?: ParsedDID | null ) {
    parsed = parsed ?? parse( did );
    if( !parsed )
        throw new Error("Failed to parse DID: " + did );
    if( parsed.method !== 'web' )
        throw new Error("Only did:web is supported");

    const idParts = parsed.id.split(":")
    let path = idParts.map(decodeURIComponent).join("/");

    if( parsed.path )
        throw new Error("Web DIDs do not support paths");
        //path += parsed.path;

    path += (idParts.length > 1 || parsed.path) ? "/did.json" : "/.well-known/did.json";

    if( parsed.query )
        path += '?' + parsed.query;

    return `${selectProtocol(idParts[0])}://${path}`
}
