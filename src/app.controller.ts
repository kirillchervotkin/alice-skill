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
  Res
} from '@nestjs/common';
import { AuthDto } from './dto/authDto.dto';
import { AuthFormDto } from './dto/authForm.dto';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import "reflect-metadata";
import { validate} from 'class-validator';
import { sha1 } from 'js-sha1';
import axios from 'axios';
import { AuthCodeDto } from './dto/update-feedback.dto';
import config from './config'

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
        url: `${baseUrl}/auth?redirect_uri=${authDto.redirect_uri}&response_type=${authDto.response_type}&client_id=${authDto.client_id}&state=${authDto.state}${(authDto.scope ? '&scope=' + authDto.scope : '')}`,
        loginValidationError: null,
        passwordValidationError: null,
        errorMessage: null
      }
    };
    const errors = await validate(authForm);
    errors.forEach((error) => {
      if (error.property == 'login') {
        response.data.loginValidationError = Object.values(error.constraints).join(', ')
      }
      if (error.property == 'password') {
        response.data.passwordValidationError = Object.values(error.constraints).join(', ')
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
