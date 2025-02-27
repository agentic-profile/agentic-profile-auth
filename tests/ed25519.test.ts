import { createKeypair, sign, verify } from "../src/ed25519";
import { BASE_64_REGEX, mutateBase64, isBase64key } from "./util";

describe("Ed25519", () => {
    let keypair;
    let publicKey, privateKey, signature;

    beforeAll( async () => {
        keypair = await createKeypair();
        //console.log( 'keypair', toJSON(keypair) );
        ({ publicKey, privateKey } = keypair);
    });

    test('validate keypair', async () => {
        expect( isBase64key( publicKey ) ).toBe( true );
        expect( isBase64key( privateKey ) ).toBe( true );
    });

    let message = "spaghetti";

    test('sign message', async () => {
        signature = await sign( message, privateKey );
        //console.log( 'signature', signature );

        expect( BASE_64_REGEX.test( signature ) ).toBe( true );
    });

    test('verify signature', async () => {
        const isVerified = await verify( signature, message, publicKey );
        expect( isVerified ).toBe( true );
    });

    // negative tests...

    test('incorrect message', async () => {
        // invalid message
        const isVerified = await verify( signature, "pasta", publicKey );
        expect( isVerified ).toBe( false );
    });

    test('incorrect signature', async () => {
        // invalid signature
        const mutated = mutateBase64( signature );
        const isVerified = await verify( mutated, message, publicKey );
        expect( mutated == signature ).toBe( false );
        expect( isVerified ).toBe( false );
    });
})

function toJSON( obj:any ) {
    return JSON.stringify(obj,null,4);
}
 