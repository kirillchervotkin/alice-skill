import { IsNotEmpty } from "class-validator"


export class AuthCodeDto  {
    
    @IsNotEmpty()
    client_id: string
    
    @IsNotEmpty()
    client_secret:string
    
    @IsNotEmpty()
    code: string
    
    @IsNotEmpty()
    grand_type: string
    
    @IsNotEmpty()
    redirect_uri: string

}
