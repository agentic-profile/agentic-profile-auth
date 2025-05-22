export default {
    verbose: true,
    preset: 'ts-jest/presets/default-esm',
    "transformIgnorePatterns": [
        "node_modules/(?!@agentic-profile/common|jose|@noble|base58-universal|@digitalbazaar/ed25519-verification-key-2020|base64url-universal|crypto-ld)"
    ],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    }
}
