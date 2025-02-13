import { Controller, Injectable, Res, UseGuards } from "@nestjs/common";
import { UserUtterance, Data, Handler, Intent, Slots, Time, UserId, Command } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient, Stufftime, Task } from "./skill.service";
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
    const tasks: Task[] = await this.documentFlowApiClient.getTasks(userId);
    const message: string = tasks.reduce<string>((text: string, task: any, index) => text + (index + 1) + '. ' + task.name + '\n\n', '');
    return new SkillResponse(message);
  }

  @UseGuards(SkillAuthGuard)
  @Command('укажи трудозатраты')
  addStufftime() {
    return new SkillResponseBuilder('Сколько часов вы хотите указать?')
      .setNextHandler('time')
      .build()
  }

  @UseGuards(SkillAuthGuard)
  @Handler('time')
  time(@Slots() slots: MinutesDto) {
    return new SkillResponseBuilder('По какой задаче вы хотите указать трудозатраты?')
      .setNextHandler('task')
      .setData({ time: slots.time })
      .build()
  }


  @UseGuards(SkillAuthGuard)
  @Handler('task')
  async task(@UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: string) {
    const task: Task = await this.documentFlowApiClient.getTaskByName(userId, userUtterance);
    data.taskId = task.id;
    return new SkillResponseBuilder('Произнесите ваши трудозатраты')
      .setNextHandler('stafftime')
      .setData(data)
      .build()
  }

  @UseGuards(SkillAuthGuard)
  @Handler('stafftime')
  async stafftime(@Time() time: Date, @UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: string) {
    const stufftime: Stufftime = {
      taskId: data.taskId,
      userId: userId,
      workTypeId: "457a0f87-5250-11ea-a99d-005056905560",
      dateTime: time,
      countOfMinutes: data.time,
      description: userUtterance
    }
    await this.documentFlowApiClient.addStufftime(stufftime);
    return new SkillResponseBuilder('Трудозатраты успешно добавлены')
      .build()
  }

  @Command('отмена')
  cancel() {
    return new SkillResponse('Для продолжения произнесите любую команду');
  }

}
