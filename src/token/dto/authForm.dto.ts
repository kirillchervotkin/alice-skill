import { IsEmail, IsNotEmpty, IsDate, IsOptional, ValidateIf } from 'class-validator';

export class AuthFormDto {

    @IsNotEmpty(({ message: 'Логин не может быть пустым' }))
    login: string

    @IsNotEmpty(({ message: 'Пароль не может быть пустым' }))
    password: string

}

