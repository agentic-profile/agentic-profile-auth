import { ServerError } from "@agentic-profile/common";

export function ensure( truth: any, ...props:any[] ) {
    if( !!truth )
        return;

    const message = props.map(e=>typeof e === 'object' ? JSON.stringify(e) : ''+e).join(' ');
    throw new ServerError({
        kind: 'Conflict',
        message: message
    });
}