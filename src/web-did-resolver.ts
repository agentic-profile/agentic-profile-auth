import axios from "axios";
import { 
    DIDDocument,
    DIDResolutionResult,
    DIDResolver,
    ParsedDID
} from "did-resolver";

export function getResolver(): Record<string, DIDResolver> {
    async function resolve(did: string, parsed: ParsedDID): Promise<DIDResolutionResult> {
        const id = parsed.id.split(':')
        const path = id.length > 1 ?
            id.map(decodeURIComponent).join('/') + '/did.json'
            : decodeURIComponent( parsed.id ) + "/.well-known/did.json"

        const url = `https://${path}`
        try {
            const { data } = await axios.get(url);
            const didDocument = data as DIDDocument;

            const contentType = didDocument?.['@context'] ? 'application/did+ld+json' : 'application/did+json';
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
                    error: `Failed to web fetch DID document from ${url}`,
                    message: error.message,
                }
            }
        }
    }

    return { web: resolve }
}
