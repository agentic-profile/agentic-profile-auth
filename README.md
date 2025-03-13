# Agentic Profile Authentication Library

An Agentic Profile is a JSON-LD/DID Document at a well known network location that becomes a DID URI for a person, business, or other entity.  DID URIs can resolve to an HTTPS endpoint, on a blockchain, and many other services that are definbed by the DID specification.  For example, the URI did:web:iamagentic.ai/mike is a universal identifier that can be used to discover AI agents that represent Mike.

The Agentic Profile provides a means for authentication using strong public key cryptography.  Each Agentic Profile publishes the current public key(s) for a person, and may also publish the public keys for the person's agents.

When the person (or an agent (A) of that person) attempts to communicate with another agent/service (B), the other agent (B) may provide a challenge and ask for the challenge to be signed by A.  If the challenge signature is verified by B, then B can be assured it is communicating with A.

The Agentic Profile supports a protocol that is:
- Open source
- Light weight (easy to implement)
- Very secure using strong public key cryptography (ed25519 by default)
- Decentralized, anyone can publish an Agentic Profile DID resolvable service
- Fine grained/multi-tenant, allowing a single service to handle many users/agents/tenants
- Extensible, supporting any number of agents for a single profile, and allowing the agents to communicate in any protocol they agree on


## Examples

- [Mike's Agentic Profile](https://iamagentic.ai/mike): An example of an Agentic Profile at did:web:iamagentic.ai/mike
- [Agent Service Node Express Demo Sourcecode](https://github.com/agentic-profile/agentic-profile-express): The source code of an Agent service running on Node using Express
- [Agent Service Node Demo for Smarter Dating](https://agents.smarterdating.ai/v1/status): The AWS Lamdba demo Agent service running on AWS
- [Matchwise](https://x.matchwise.ai): A webapp and service that hosts user Agentic Profiles and supports one user's agent chatting with another user's agent to determine if the real people should meet IRL

## Quickstart

Clone the [Agentic Profile Express Github repo](https://github.com/agentic-profile/agentic-profile-express/blob/main/README.md) for an easy to use demo.  This project can also be extended to create a production grade agentic service in the cloud.
