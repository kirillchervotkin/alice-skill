
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
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

@Catch(BadRequestException)
export class BadRequestExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(SkillAccessTokenExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const nextHandler: string = response.req.body.state.session.nextHandler;
    const exceptionResponse: any = exception.getResponse();
    const errorMessage = exceptionResponse.message[0].error;
    response.status(HttpStatus.OK).json(
      new SkillResponseBuilder(errorMessage)
        .setNextHandler(nextHandler)
        .build());
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const nextHandler: string = response.req.body.state?.session?.nextHandler;
    this.logger.error(exception.name + ' ' + exception.message);
    response.status(HttpStatus.OK).json(
      new SkillResponseBuilder('Во мне что-то сломалось, надеюсь меня скоро починять')
        .setNextHandler(nextHandler)
        .build());
  }
}