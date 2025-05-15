export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.(js|ts|tsx)$': 'babel-jest',
    },
    verbose: true,
    "transformIgnorePatterns": [
        "node_modules/(?!@agentic-profile/common|jose|@noble|base58-universal|@digitalbazaar/ed25519-verification-key-2020|base64url-universal|crypto-ld)"
    ],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
}
