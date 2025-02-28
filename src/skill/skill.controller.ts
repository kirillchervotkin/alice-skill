import { Controller, Inject, Injectable, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { UserUtterance, Data, Handler, Intent, Slots, Time, UserId, Command } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient, LLMmodel, Project, Stufftime, Task } from "./skill.service";
import { SkillAuthGuard } from "src/guards";
import { MinutesDto } from "./dto/minutes.dto";
import { TransformUserUtteranceToMinutesInterceptor } from "src/interceptors";
import { LLM } from "@langchain/core/language_models/llms";
import { routes } from "src/routes";

@Injectable()
@Controller()
export class SkillController {

  constructor( 
    private readonly documentFlowApiClient: DocumentFlowApiClient,
    @Inject('LLM_MODEL') private readonly model: LLMmodel
  ) { }

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

  @UseInterceptors(TransformUserUtteranceToMinutesInterceptor)
  @UseGuards(SkillAuthGuard)
  @Handler('time')
  time(@UserUtterance() UserUtterance: MinutesDto) {
    return new SkillResponseBuilder('По какой задаче вы хотите указать трудозатраты?')
      .setNextHandler('task')
      .setData({ time: UserUtterance.text })
      .build()
  }


  @UseGuards(SkillAuthGuard)
  @Handler('task')
  async task(@UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: any) {
    const task: Task = await this.documentFlowApiClient.getTaskByName(userId, userUtterance.text);
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

  @Command('спасибо')
  thanks() {
    return new SkillResponse('Всегда рада помочь. Для продолжения назовите команду');
  }

  @Command('трудозатраты по проекту')
  @UseGuards(SkillAuthGuard)
  stafftimeByProject() {
    return new SkillResponseBuilder('По какому проекту вы хотите узнать трудозатраты?')
      .setNextHandler('project')
      .build()
  }

  @Handler('project')
  @UseGuards(SkillAuthGuard)
  async project(@UserUtterance() UserUtterance: any) {
    const project: Project = await this.documentFlowApiClient.getProjectByName(UserUtterance.text);
    const stafftimeObjects: any[] = await this.documentFlowApiClient.getStafftimeByProjectId(project.id);
    let responseString: string = '';
    stafftimeObjects.forEach((stafftimeByUser) => {
      stafftimeByUser.stufftime.forEach((stafftime: any) => {
        responseString = responseString + stafftime.description + ' \n';
      })
    })
    const model: LLM = await this.model.getModel();
    const text: string = await model.invoke([`Перескажи кратко что сделано на проекте используя данный список описания трудозатрат: ${responseString}`]);
    return new SkillResponse(text);
  }

}