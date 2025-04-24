import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Response, Request, NextFunction } from 'express';
import { routes } from './routes';


@Injectable()
export class IntentMiddleware implements NestMiddleware {
    
    private readonly logger = new Logger(IntentMiddleware.name);
    
    use(req: Request, res: Response, next: NextFunction) {

        let intents: string[] = Object.keys(res.req.body.request.nlu.intents);
        const command: string = res.req.body.request.command
        this.logger.log(`request: ${res.req.body.request.original_utterance}`);
        const sessionState: any = res.req.body.state.session;
        intents = intents.filter((el) => {
            return routes.intents.includes(el);
        });
        if (intents.length) {
            req.url = '/' + String(Object.keys(res.req.body.request.nlu.intents).pop());
        } else if (routes.commands.includes(command)) {
            req.url = '/command' + encodeURIComponent(command);
        } else if (sessionState && sessionState.nextHandler) {
            req.url = '/' + sessionState.nextHandler;
        } else if (command.length) {
            req.url = '/commandunknow';
        } else {
            req.url = '/';
        }
        next();
    }

}