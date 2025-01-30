import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { SkillInvalidAccessTokenException, SkillMissingAccessTokenException, SkillTokenExpiredException } from "./exceptions";
import { JsonWebTokenError, JwtService } from "@nestjs/jwt";


@Injectable()
export class SkillAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    async verify(accessToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync(accessToken);
            const currentTime = Math.floor(Date.now() / 1000);
            const exp = payload.exp;
            if (currentTime > exp) {
                throw new SkillTokenExpiredException('Token has expired');
            }
            return payload;
        } catch (error) {
            if (error instanceof JsonWebTokenError) {
                throw new SkillInvalidAccessTokenException('Access token is invalid')
            }
            if (error instanceof SkillTokenExpiredException) {
                throw new SkillTokenExpiredException(error.message)
            }
        }
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const accessToken = request.body.session.user.access_token;
        if (!accessToken) {
            throw new SkillMissingAccessTokenException('The request does not contain an access token');
        }
        try {
            return request.body.payload = await this.verify(accessToken);
        } catch (error) {
            throw error;
        }
    }
}
