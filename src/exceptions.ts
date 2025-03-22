
import { UnauthorizedException, } from '@nestjs/common';


export class SkillMissingAccessTokenException extends UnauthorizedException {
    
    constructor(public message: string, public statusCode?: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export class SkillInvalidAccessTokenException extends UnauthorizedException {
    
    constructor(public message: string, public statusCode?: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export class SkillTokenExpiredException extends UnauthorizedException {
    
    constructor(public message: string, public statusCode?: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export class DocumentFlowClientIBSessionException extends UnauthorizedException {
    
    constructor(public message: string, public statusCode?: number) {
        super(message);
        this.statusCode = statusCode;
    }
}