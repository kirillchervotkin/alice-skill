import { Expose, Transform } from "class-transformer";
import { Max, Min, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

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

export class MinutesDto {

  @Transform(({ obj }) => ((obj.hours ? obj.hours : 0) * 60) + (obj.minutes ? obj.minutes : 0))
  @Min(15, { message: 'время трудозатрат не может быть меньше 15 минут' })
  @Max(4 * 60, { message: 'время трудозатрат не может быть больше 4 часов' })
  @Validate(IsNotZero, { message: 'Вы произнесли некорректные данные' })
  @Validate(IsMultipleOfFifteen, { message: 'Трудозатраты должны быть кратны 15 минутам' })
  @Expose()
  time: number

}