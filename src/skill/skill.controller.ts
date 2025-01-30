import { Controller, Injectable, Res, UseGuards } from "@nestjs/common";
import { Handler, Intent, UserId } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient } from "./skill.service";
import { SkillAuthGuard } from "src/guards";


@Injectable()
@Controller()
export class SkillController {

  constructor(private readonly documentFlowApiClient: DocumentFlowApiClient) { }

  @Intent()
  root(): SkillResponse {
    return new SkillResponse('Добро пожаловать в навык АйтиПлан')
  }

  @UseGuards(SkillAuthGuard)
  @Intent('getTasks')
  async getTasks(@UserId() userId: string): Promise<SkillResponse> {
    const tasks: any[] = await this.documentFlowApiClient.getTasks(userId);
    const message: string = tasks.reduce<string>((text: string, task: any, index) => text + (index + 1) + '. ' + task.name + '\n\n', '');
    return new SkillResponse(message);
  }

}