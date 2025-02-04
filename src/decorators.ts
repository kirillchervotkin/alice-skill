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

export const Data = createParamDecorator((data: any, ctx: ExecutionContext): unknown | null => {
    const request = ctx.switchToHttp().getRequest();
    const dataOfSession: unknown = request.body.state.session.data;
    if (!dataOfSession) {
        return null;
    } else {
        return dataOfSession;
    }
});

export const UserUtterance = createParamDecorator((data: any, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.body.request.command;
});

export const Time = createParamDecorator((data: any, ctx: ExecutionContext): Date => {
    const request = ctx.switchToHttp().getRequest()
    const timeZone = request.body.meta.timezone;
    let dateString: string = new Date().toLocaleString('en-US', {
        timeZone: timeZone
    });
    const date: Date = new Date(dateString);
    return date;
});

export const Handler = (handlerId: string) => {
    return applyDecorators(
        UseFilters(SkillAccessTokenExceptionFilter, BadRequestExceptionFilter),
        UseInterceptors(SkillPayloadInterceptor),
        UseFilters(SkillAccessTokenExceptionFilter),
        Post('nextHandler' + handlerId),
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

export const Slots = createParamDecorator((data: any, ctx: ExecutionContext): any | null => {
    const request = ctx.switchToHttp().getRequest();
    const intents: any = request.body.request.nlu.intents;
    const objectOfSlots: any = {};
    Object.keys(intents).forEach((keyOfIntent) => {
        Object.keys(intents[keyOfIntent].slots).forEach((keyOfSlot: string) => {
            const slot: any = intents[keyOfIntent].slots[keyOfSlot];
            objectOfSlots[keyOfSlot] = slot.value;
        });
    });
    return objectOfSlots;
});