import { Injectable, NestMiddleware } from "@nestjs/common";
import { Response, Request, NextFunction, urlencoded } from 'express';
import { routes } from './routes';


@Injectable()
export class IntentMiddleware implements NestMiddleware {

    use(req: Request, res: Response, next: NextFunction) {
        let intents: string[] = Object.keys(res.req.body.request.nlu.intents);
        const command: string = res.req.body.request.command
        const sessionState: any = res.req.body.state.session;
        intents = intents.filter((el) => {
            return routes.intents.includes(el);
        });
        if (intents.length) {
            req.url = '/' + String(Object.keys(res.req.body.request.nlu.intents).pop());
        } else if (routes.commands.includes(command)) {
            console.log(command);
            req.url = '/command' + encodeURIComponent(command);
        } else if (sessionState && sessionState.nextHandler) {
            req.url = '/' + sessionState.nextHandler;
        } else {
            req.url = '/';
        }
        next();
    }

}