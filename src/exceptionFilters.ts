
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SkillInvalidAccessTokenException, SkillMissingAccessTokenException, SkillTokenExpiredException } from './exceptions'
import { Response } from 'express';
import { SkillResponseBuilder } from './response-utils';


@Catch(SkillInvalidAccessTokenException, SkillMissingAccessTokenException, SkillTokenExpiredException)
export class SkillAccessTokenExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(SkillAccessTokenExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof SkillInvalidAccessTokenException) {
      this.logger.error(exception.message);
    }
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(HttpStatus.OK).json(
      new SkillResponseBuilder('Для использования навыка необходимо авторизоваться')
        .setStartAccountLinking()
        .build());
  }
}