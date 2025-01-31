import { Controller, Injectable, UseGuards } from "@nestjs/common";
import { Handler, Intent, Slots, UserId } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient } from "./skill.service";
import { SkillAuthGuard } from "src/guards";
import { MinutesDto } from "./dto/minutes.dto";


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

  @UseGuards(SkillAuthGuard)
  @Intent('addStufftime')
  addStufftime() {
    return new SkillResponseBuilder('Сколько часов вы хотите указать?')
      .setNextHandler('countOfHours')
      .build()
  }

  @UseGuards(SkillAuthGuard)
  @Handler('countOfTime')
  countOfTime(@Slots() slots: MinutesDto) {
    return new SkillResponseBuilder('По какой задаче вы хотите указать трудозатраты?')
      .setNextHandler('task')
      .setData({
        time: slots.time
      })
      .build()
  }

}
