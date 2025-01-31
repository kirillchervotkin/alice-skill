import { applyDecorators, createParamDecorator, ExecutionContext, Post, UseFilters, UseInterceptors } from "@nestjs/common";
import { BadRequestExceptionFilter, SkillAccessTokenExceptionFilter } from "./exceptionFilters";
import { SkillPayloadInterceptor } from "./interceptors";


export const UserId = createParamDecorator((data: any, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.body.payload) {
        return null;
    } else {
        return request.body.payload.userId;
    }
});

export const Handler = (handlerId: string) => {
    return applyDecorators(
        UseFilters(SkillAccessTokenExceptionFilter, BadRequestExceptionFilter),
        UseInterceptors(SkillPayloadInterceptor),
        UseFilters(SkillAccessTokenExceptionFilter),
        Post('nextHandler:' + handlerId),
        UseFilters(SkillAccessTokenExceptionFilter)
    )
}

export const Intent = (intentId: string = '') => {
    return applyDecorators(
        UseFilters(SkillAccessTokenExceptionFilter, BadRequestExceptionFilter),
        UseInterceptors(SkillPayloadInterceptor),
        UseFilters(SkillAccessTokenExceptionFilter),
        Post(intentId),
        UseFilters(SkillAccessTokenExceptionFilter)
    )
}

