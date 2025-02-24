# Agentic Profile Authorization Library

An Agentic Profile is a JSON file at a well known location that becomes a URI for a person, business, or other entity.  For example, the URI https://iamagentic.ai/mike is a universal identifier that can be used to discover AI agents that represent Mike.

The Agentic Profile provides a means for authentication using strong public key cryptography.  Each Agentic Profiles publishes the current public key(s) for a person, and may also publish the public keys for the person's agents.

When the person (or an agent (A) of that person) attempts to communicate with another service (B), the other service (B) may provide a challenge and ask for it to be signed.  If the challenge signature is verified, then the other service (B) can be assured it is communicating with (A).

The Agentic Profile supports a protocol that is:
- Light weight (easy to implement)
- Very secure using strong public key crypography (ed25519 by default)
- Decentralized, anyone can publish an Agentic Profile at any HTTPS endpoint
- Fine grained, allowing a single service to handle many users/tenants
- Extensible, supporting any number of agents for a single profile, and allowing the agents to communicate in any protocol they agree on

## Examples

- [Matchwise](https://x.matchwise.ai): A webapp and service that hosts user Agentic Profiles and supports one users agent chatting with another users agent to determine if the real people should meet IRL
- [Mike's Agentic Profile](https://iamagentic.ai): An example of an Agentic Profile
- [Agent Service Demo Sourcecode](): The source code of an Agent service running on Node
- [Agent Service Demo](): The demo Agent service running on Node
