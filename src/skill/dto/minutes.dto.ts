import { Injectable } from "@nestjs/common";
import { IsNotEmpty, Max, Min, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ async: false })
export class IsMultipleOfFifteen implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments): boolean {
    return !(value % 15)
  }
}

@ValidatorConstraint({ async: false })
export class IsNotZero implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments): boolean {
    return !!value;
  }
}

@Injectable()
export class MinutesDto {

  @Min(15, { message: 'время трудозатрат не может быть меньше 15 минут' })
  @Max(4 * 60, { message: 'время трудозатрат не может быть больше 4 часов' })
  @Validate(IsMultipleOfFifteen, { message: 'Трудозатраты должны быть кратны 15 минутам' })
  @IsNotEmpty({ message: 'Вы произнесли некорректные данные' })
  text: number

}