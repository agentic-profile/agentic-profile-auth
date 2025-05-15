import {
    createEdDsaJwk,
    sign,
    verify
} from "../src/ed25519";
import { 
    mutateBase64,
    isBase64Key,
    isBase64Url
} from "./util";

describe("Ed25519", () => {
    let keypair, b64uSignature: string;
    let b64uPublicKey: string, b64uPrivateKey: string;

    const message = "spaghetti";

    beforeAll( async () => {
        keypair = await createEdDsaJwk();
        ({ b64uPublicKey, b64uPrivateKey } = keypair);

        b64uSignature = await sign( message, b64uPrivateKey );
    });

    test('validate keypair and signature format', async () => {
        expect( isBase64Key( b64uPublicKey ) ).toBe( true );
        expect( isBase64Key( b64uPrivateKey ) ).toBe( true );
        expect( isBase64Url( b64uSignature ) ).toBe( true );
    });

    test('verify signature', async () => {
        expect( await verify( b64uSignature, message, b64uPublicKey ) ).toBe( true );
    });

    // negative tests...

    test('incorrect messages', async () => {
        expect( await verify( b64uSignature, "pasta", b64uPublicKey ) ).toBe( false );
        expect( verify( b64uSignature, undefined as any, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() requires a message");
        expect( verify( b64uSignature, null as any, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() requires a message");
        expect( await verify( b64uSignature, message + '!', b64uPublicKey ) ).toBe( false );
    });

    test('incorrect signatures', async () => {
        expect( await verify( mutateBase64( b64uSignature ), message, b64uPublicKey ) ).toBe( false );
        expect( verify( null as any, message, b64uPublicKey ) ).rejects.toThrow( "Ed25519 verify() requires a signature" );
        expect( verify( undefined as any, message, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() requires a signature");
        expect( verify( 'a' + b64uSignature, message, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() failed: Uint8Array of valid length expected");
        expect( verify( '!' + b64uSignature, message, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() failed: Invalid character");
        expect( verify( b64uSignature.substring(1), message, b64uPublicKey ) ).rejects.toThrow("Ed25519 verify() failed: The string to be decoded is not correctly encoded.");
    });
});
