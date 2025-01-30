import { Injectable, NestMiddleware } from "@nestjs/common";
import { Response, Request, NextFunction } from 'express';


@Injectable()
export class IntentMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const intents: string[] = Object.keys(res.req.body.request.nlu.intents);
        const sessionState: any = res.req.body.state.session;
        if (sessionState && sessionState.nextHandler) {
            req.url = '/' + sessionState.nextHandler;
        } else if (intents.length) {
            req.url = '/' + String(Object.keys(res.req.body.request.nlu.intents).pop());
        } else {
            req.url = '/';
        }
        next();
    }
}