import {
    Response,
    Request
} from "express";

import {
    ClientAgentSession,
    AgentAuthStore
} from "../models.js";

import {
    createChallenge,
    handleAuthorization,
} from "./agentic-server-authentication.js";

// returns:
// - agent session
// - null if request handled by 401/challenge
// - or throws an Error
export async function resolveAgentSession( req: Request, res: Response, authStore: AgentAuthStore ): Promise<ClientAgentSession | null> {
    const { authorization } = req.headers;
    if( !authorization ) {
        const challenge = await createChallenge( authStore );
        res.status(401).send( challenge );
        return null;
    } else
        return await handleAuthorization( authorization, authStore );
}