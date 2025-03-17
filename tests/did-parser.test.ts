import { 
    parse
} from "did-resolver";

import { 
    webDidToUrl
} from "../src/web-did-resolver";

describe("Web DID to URL", () => {
    test('basic conversions', async () => {
        check( "did:web:localhost", "http://localhost/.well-known/did.json" );
        check( "did:web:localhost%3A3003", "http://localhost:3003/.well-known/did.json" );
        check( "did:web:iamagentic.ai:mike", "https://iamagentic.ai/mike/did.json" );
        check( "did:web:example.com:iam:dave", "https://example.com/iam/dave/did.json" );
        //check( "did:web:example.com:iam/mike", "https://example.com/iam/mike/did.json" );
        //check( "did:web:example.com/iam/sam", "https://example.com/iam/sam/did.json" );
    });

    test('with queries', async () => {
        check( "did:web:localhost?a=b&c=d", "http://localhost/.well-known/did.json?a=b&c=d" );
    });

    test('with fragments', async () => {
        check( "did:web:localhost#agent-1", "http://localhost/.well-known/did.json" );
        //check( "did:web:example.com:iam/mike#agent-2", "https://example.com/iam/mike/did.json" );
        check( "did:web:localhost?a=b&c=d#agent-3", "http://localhost/.well-known/did.json?a=b&c=d" );
    });
});

function check( url: string, expected: string ) {
    expect( webDidToUrl( url ) ).toBe( expected );
    expect( webDidToUrl( url, parse( url ) ) ).toBe( expected );
}