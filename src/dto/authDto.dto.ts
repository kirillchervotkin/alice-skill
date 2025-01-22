import { IsNotEmpty, IsOptional } from 'class-validator';

export class AuthDto {
    
    @IsNotEmpty()
    state: string
    
    @IsNotEmpty()
    redirect_uri :string
    
    @IsNotEmpty()
    response_type : string
    
    @IsNotEmpty()
    client_id : string
    
    @IsOptional()
    scope : string

}

