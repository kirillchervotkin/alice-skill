import e from "express"

export interface SkillResponseBody {

    response_type: string,
    text: string,
    end_session: boolean,
    buttons?: any[]
}

export class SkillResponse {

    public response: SkillResponseBody
    public version: string
    public start_account_linking: undefined | {}
    public session_state?: any

    constructor(message: string) {
        this.response = {
            response_type: 'text',
            text: message,
            end_session: false,
        }
        this.version = "1.0";
    }
}

export class SkillResponseBuilder {

    private readonly response: SkillResponse;

    public constructor(message: string) {
        this.response = new SkillResponse(message);
        this.response.session_state = undefined;
    }

    public setButton(title: string, hide: boolean): SkillResponseBuilder{
        let button: any = { title: title, hide: hide};
        if(typeof this.response.response.buttons === 'undefined'){
            this.response.response.buttons = [button];
        }else{
            this.response.response.buttons.push(button);
        }
        return this;
    }

    public setEndSesstion(): SkillResponseBuilder {
        this.response.response.end_session = true;
        return this;
    }

    public setStartAccountLinking(): SkillResponseBuilder {
        this.response.start_account_linking = {}
        return this;
    }

    public setData(data: any): SkillResponseBuilder {
        if (!this.response.session_state) {
            this.response.session_state = {}
        }
        this.response.session_state.data = data;
        return this;
    }

    public setNextHandler(handlerName: string): SkillResponseBuilder {
        if (!this.response.session_state) {
            this.response.session_state = {}
        }
        this.response.session_state.nextHandler = handlerName;
        return this
    }

    public build(): SkillResponse {
        return this.response;
    }
}