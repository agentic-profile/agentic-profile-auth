# Agentic Profile Authentication Library

An Agentic Profile is a JSON file at a well known network location that becomes a URI for a person, business, or other entity.  For example, the URI https://iamagentic.ai/mike is a universal identifier that can be used to discover AI agents that represent Mike.

The Agentic Profile provides a means for authentication using strong public key cryptography.  Each Agentic Profile publishes the current public key(s) for a person, and may also publish the public keys for the person's agents.

When the person (or an agent (A) of that person) attempts to communicate with another service (B), the other service (B) may provide a challenge and ask for the challenge to be signed by A.  If the challenge signature is verified by B, then B can be assured it is communicating with A.

The Agentic Profile supports a protocol that is:
- Light weight (easy to implement)
- Very secure using strong public key crypography (ed25519 by default)
- Decentralized, anyone can publish an Agentic Profile at any HTTPS endpoint
- Fine grained, allowing a single service to handle many users/tenants
- Extensible, supporting any number of agents for a single profile, and allowing the agents to communicate in any protocol they agree on


## Examples

- [Matchwise](https://x.matchwise.ai): A webapp and service that hosts user Agentic Profiles and supports one user's agent chatting with another user's agent to determine if the real people should meet IRL
- [Mike's Agentic Profile](https://iamagentic.ai/mike): An example of an Agentic Profile
- [Agent Service Node Demo Sourcecode](https://github.com/agentic-profile/agentic-profile-express): The source code of an Agent service running on Node using Express
- [Agent Service Node Demo for Smarter Dating](https://agents.smarterdating.ai/v1/status): The demo Agent service running on Node
