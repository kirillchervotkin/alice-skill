import { Body, Controller, Get, HttpException, HttpStatus, Injectable, Post, Query, Render, Res } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Response } from "express";
import config from "src/config";
import { AuthCodeDto } from "./dto/authCode.dto";
import { AuthDto } from "./dto/authDto.dto";
import { AuthFormDto } from "./dto/authForm.dto";
import { validate } from "class-validator";
import { AuthenticationService } from "./token.service";


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

    constructor(
        private readonly jwtService: JwtService,
    private readonly authenticationService: AuthenticationService) { }

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
    async authUser(@Res() res: Response, @Query() authDto: AuthDto, @Body() authFormDto: any) {

        const authForm = new AuthFormDto();
        Object.assign(authForm, authFormDto);
        const baseUrl = 'https://base.itplan.ru:3015'
        let response = {
            data: {
                url: `${baseUrl}/auth?redirect_uri=${authDto.redirect_uri}&response_type=${authDto.response_type}&client_id=${authDto.client_id}&state=${authDto.state}${(authDto.scope ? '&scope=' + authDto.scope : '')}`,
            }
        } as any;
        const errors = await validate(authForm);
        errors.forEach((error: any) => {
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
            let authenticationResponse = await (new AuthenticationService()).authenticate(authFormDto.login, authForm.password);
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