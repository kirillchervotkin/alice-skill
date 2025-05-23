import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { map, Observable } from 'rxjs';
import { SkillTokenExpiredException } from './exceptions';
import { AItransform, YandexGPTClient } from './skill/skill.service';


@Injectable()
export class SkillPayloadInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) { }

  async intercept(context: ExecutionContext, handler: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    try {
      const accessToken = request.body.session.user.access_token;
      const payload = await this.jwtService.verifyAsync(accessToken);
      const currentTime = Math.floor(Date.now() / 1000);
      const exp = payload.exp;
      if (currentTime > exp) {
        throw new SkillTokenExpiredException('Token has expired');
      }
      request.body.payload = payload;
    } catch (error) {
      request.body.payload = null;
    }
    return handler.handle()
      .pipe(map((data: any) => data))
  }
}

@Injectable()
export class TransformUserUtteranceToMinutesInterceptor implements NestInterceptor {
  constructor(
    @Inject() private readonly gptClient: YandexGPTClient
  ) { }

  async intercept(context: ExecutionContext, handler: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const command: string = request.body.request.command;
    try {
  
      const time: number | null = await this.gptClient.textoMinutes(command);
      request.body.request.command = time;
      request.body.request.original_utterance  = time;
    } catch (error) {
      throw error;
    }
    return handler.handle()
      .pipe(map((data: any) => data))
  }
}