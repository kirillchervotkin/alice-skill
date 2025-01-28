import {
  Body,
  Controller,
  Get,
  HttpException,
  Injectable,
  Post,
  Query,
  Render,
  HttpStatus,
  Res,
  ExecutionContext,
  CanActivate,
  UseGuards,
  UnauthorizedException,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  UseFilters,
  Logger,
  NestMiddleware,
  NestInterceptor,
  CallHandler,
  UseInterceptors,
  createParamDecorator,
  applyDecorators
} from '@nestjs/common';
import { AuthDto } from './dto/authDto.dto';
import { AuthFormDto } from './dto/authForm.dto';
import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import "reflect-metadata";
import { validate } from 'class-validator';
import { sha1 } from 'js-sha1';
import axios from 'axios';
import { AuthCodeDto } from './dto/update-feedback.dto';
import config from './config'
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { map, Observable } from 'rxjs';
import { request } from 'http';

class Authentication {

  public async authenticate(userName: string, password: string) {

    const hash = Buffer.from(sha1(password), 'hex');
    const hashBase64 = hash.toString('base64');
    let response: any;
    try {
      response = await axios.post('https://base.itplan.ru:7071/DO_Dev3/hs/api/auth',
        {
          userName: userName,
          passHash: hashBase64
        },
        {
          auth: {
            username: config.authDO.username,
            password: config.authDO.password
          }
        }
      )
    } catch (error) {
      if (error.response) {
        if (error.response.status == HttpStatus.NOT_FOUND) {
          return {
            error: "Пользователь с таким логином не найден"
          }
        };
        if (error.response.status == HttpStatus.UNPROCESSABLE_ENTITY) {
          return {
            error: "Неверный пароль"
          }
        }
      }
    }
    return { data: response.data };
  }
}

class DOAPI {

  public async getTasks(userId: string) {

    let response = await axios.get(`https://base.itplan.ru:7071/DO_Dev3/hs/api/tasks?userId=${userId}`, {
      auth: {
        username: config.authDO.username,
        password: config.authDO.password
      }
    });
    return response.data;
  }
}

class SkillMissingAccessTokenException extends UnauthorizedException {
  constructor(public message: string, public statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

class SkillInvalidAccessTokenException extends UnauthorizedException {
  constructor(public message: string, public statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

class SkillTokenExpiredException extends UnauthorizedException {
  constructor(public message: string, public statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

@Catch(SkillInvalidAccessTokenException, SkillInvalidAccessTokenException, SkillTokenExpiredException)
export class SkillAccessTokenExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(SkillAccessTokenExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof SkillInvalidAccessTokenException) {
      this.logger.error(exception.message);
    }
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(HttpStatus.OK).json({
      "response": {
        "response_type": "text",
        "text": "Для использования навыка вам необходимо авторизоваться",
      },
      start_account_linking: {},
      end_session: false,
      "version": "1.0",
    });
  }
}

@Injectable()
export class IntentMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const intents: string[] = Object.keys(res.req.body.request.nlu.intents);
    let intentId: string;
    if (intents.length) {
      intentId = String(Object.keys(res.req.body.request.nlu.intents).pop());
    } else {
      intentId = '';
    }
    req.url = '/' + intentId;
    next();
  }
}

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

export class SkillResponeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    return handler.handle()
      .pipe(map((text: string) => {
        return {
          "response": {
            "response_type": "text",
            "text": text,
          },
          end_session: false,
          "version": "1.0",
        }
      }),
      );
  }
}

const UserId = createParamDecorator((data: any, ctx: ExecutionContext): string | null => {
  const request = ctx.switchToHttp().getRequest();
  if (!request.body.payload) {
    return null;
  } else {
    return request.body.payload.userId;
  }
});

const Intent = (intentId: string = '') => {
  return applyDecorators(
    UseFilters(SkillAccessTokenExceptionFilter),
    UseInterceptors(SkillPayloadInterceptor),
    UseInterceptors(SkillResponeInterceptor),
    UseFilters(SkillAccessTokenExceptionFilter),
    Post(intentId),
    UseFilters(SkillAccessTokenExceptionFilter)
  )
}

@Injectable()
@Controller('token')
export class TokenController {

  constructor(private readonly jwtService: JwtService) { }

  @Post()
  async sendToken(@Res() res: Response, @Body() authCodeDto: AuthCodeDto) {
    try {
      const isValid = ((authCodeDto.client_id == config.clientId) ||
        (authCodeDto.client_secret == config.clientSecret));
      if (!isValid) {
        throw new HttpException(res, HttpStatus.BAD_REQUEST);
      }
      const payload = await this.jwtService.verifyAsync(authCodeDto.code);
      const { iat, exp, ...tokenPayload } = payload;
      const token = this.jwtService.sign(tokenPayload);
      res.setHeader('Content-Type', 'application/json');
      res.json({ "access_token": token }).send();
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).send();
    }
  }
}

@Controller()
export class SkillController {

  @Intent()
  root() {
    return 'Добро пожаловать в навык АйтиПлан';
  }
}

@Injectable()
@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) { }

  @Get()
  @Render('index')
  sendForm(@Query() authDto: AuthDto) {
    const baseUrl = 'https://base.itplan.ru:3015'
    let response = {
      data: {
        url: `${baseUrl}/auth?redirect_uri=${authDto.redirect_uri}&response_type=${authDto.response_type}&client_id=${authDto.client_id}&state=${authDto.state}${(authDto.scope ? '&scope=' + authDto.scope : '')}`
      }
    };
    return response;
  }

  @Post()
  async authUser(@Res() res: Response, @Query() authDto: AuthDto, @Body() authFormDto: AuthFormDto) {

    const authForm = new AuthFormDto();
    Object.assign(authForm, authFormDto);
    const baseUrl = 'https://base.itplan.ru:3015'
    let response = {
      data: {
        url: `${baseUrl}/auth?redirect_uri=${authDto.redirect_uri}&response_type=${authDto.response_type}&client_id=${authDto.client_id}&state=${authDto.state}${(authDto.scope ? '&scope=' + authDto.scope : '')}` ,
      }
    } as any;
    const errors = await validate(authForm);
    errors.forEach((error) => {
      const constraints = error.constraints || {};
      if (error.property == 'login') {
        response.data.loginValidationError = Object.values(constraints).join(', ')
      }
      if (error.property == 'password') {
        response.data.passwordValidationError = Object.values(constraints).join(', ')
      }
    });
    if (errors.length) {
      res.render('index', response);
    } else {
      let authenticationResponse = await (new Authentication()).authenticate(authFormDto.login, authForm.password);
      if (authenticationResponse.error) {
        response.data.errorMessage = authenticationResponse.error;
        return res.render('index', response);
      } else {
        let code = this.jwtService.sign(authenticationResponse.data);
        let path = `${authDto.redirect_uri}?code=${code}&response_type=${authDto.response_type}&client_id=${authDto.client_id}&state=${authDto.state}`;
        res.redirect(302, encodeURI(path));
      }
    }
  }
}
