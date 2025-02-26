export default {
    verbose: true,
    "transformIgnorePatterns": [
        "node_modules/(?!@noble/ed25519)"
    ],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
}
