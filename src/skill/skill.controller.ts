import { Controller, Inject, Injectable, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { UserUtterance, Data, Handler, Intent, Slots, Time, UserId, Command } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient, LLMmodel, Project, Stufftime, Task } from "./skill.service";
import { SkillAuthGuard } from "src/guards";
import { MinutesDto } from "./dto/minutes.dto";
import { TransformUserUtteranceToMinutesInterceptor } from "src/interceptors";
import { LLM } from "@langchain/core/language_models/llms";
import { routes } from "src/routes";
import { InMemoryStore } from "@langchain/core/stores";

@Injectable()
@Controller()
export class SkillController {

  constructor(
    private readonly documentFlowApiClient: DocumentFlowApiClient,
    private readonly cache: InMemoryStore<string>,
    @Inject('LLM_MODEL') private readonly model: LLMmodel
  ) { }

  @Intent()
  root(): SkillResponse {
    return new SkillResponseBuilder(`Добро пожаловать в навык АйТи План.\nПроизнесите одну из следующих команд:\n\nСписок задач\nУкажи трудозатраты\nОтчет\n`)
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .build()

  }

  @Command('unknow')
  unknow(): SkillResponse {
    return new SkillResponse('Не смогла распознать команду, попробуйте произнести по другому');
  }

  @UseGuards(SkillAuthGuard)
  @Intent('getTasks')
  async getTasks(@UserId() userId: string): Promise<SkillResponse> {
    const tasks: Task[] = await this.documentFlowApiClient.getTasks(userId);
    const message: string = tasks.reduce<string>((text: string, task: any, index) => text + (index + 1) + '. ' + task.name + '\n\n', '');
    return new SkillResponseBuilder(message)
      .setButton('Список задач', true)
      .setButton('Указать трудозатраты', true)
      .setButton('Отчет', true)
      .build();
  }

  @UseGuards(SkillAuthGuard)
  @Intent('addStufftime')
  async addStufftime(@UserId() userId: string) {
    const tasksObjects: Task[] = await this.documentFlowApiClient.getTasks(userId);

    const length: number = tasksObjects.filter(
      (task: Task) => {
        const deadline: number = Number.parseInt(task.deadline);
        const now = Number.parseInt(this.documentFlowApiClient.formatDateToYYYYMMDDHHMMSS(new Date(Date.now())));
        const result: boolean = (now > deadline);
        return result;
      }
    ).length
    if (length) {
      return new SkillResponse('У вас есть просроченные задачи. Для указания трудозатрат вам необходимо запросить продление срока');
    } else {
      return new SkillResponseBuilder('Сколько времени вы хотите указать?')
        .setNextHandler('time')
        .build()
    }
  }

  @UseInterceptors(TransformUserUtteranceToMinutesInterceptor)
  @UseGuards(SkillAuthGuard)
  @Handler('time')
  async time(@UserId() userId: string, @UserUtterance() UserUtterance: MinutesDto) {

    //  const tasks: Task[] = await this.documentFlowApiClient.getTasks(userId);
    const skillResponseBuilder: SkillResponseBuilder = new SkillResponseBuilder('По какой задаче вы хотите указать трудозатраты?')
      .setNextHandler('task')
      .setData({ time: UserUtterance.text })
    //  tasks.forEach(task => skillResponseBuilder.setButton(task.name, true))
    return skillResponseBuilder.build();
  }

  @UseGuards(SkillAuthGuard)
  @Handler('task')
  async task(@UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: any) {

    try {

      const tasksObjects: Task[] = await this.documentFlowApiClient.getTasks(userId);
      const tasks: string = tasksObjects.reduce<string>((text: string, task: Task) => text + `Имя: ${task.name} id: ${task.id} \n\n`, '');
      const taskIdArray: string[] = await this.cache.mget([userUtterance.text]);
      let taskId: string | undefined;
      if (typeof taskIdArray[0] !== 'undefined') {
        taskId = taskIdArray[0];
        if (!tasksObjects.filter((item: Task) => item.id == taskId).length) {
          this.cache.mdelete([taskId]);
          taskId = undefined;
        }
      }

      let text: string;
      let nextHandler: string;

      if (typeof taskId === 'undefined') {
        const model: LLM = await this.model.getModel();
        const responseFromModel: string = await model.invoke([`
      Пользователь произносит название задачи в произвольной форма. Определи есть ли задача "${userUtterance.text}" в списке ниже.
      Если задача есть, то верни исключительно только id этой задачи и ничего более, если задачи нет верни null и ничего больше. \n\n
      ${tasks}
      `]);
        if (responseFromModel == 'null') {
          taskId = undefined;
        } else {
          taskId = responseFromModel;
          this.cache.mset([[userUtterance.text, taskId]])
        }
      }

      if (typeof taskId === 'undefined') {
        text = 'Не нашла такой задачи. Попробуйте произнести по другому';
        nextHandler = 'task';
      } else {
        text = 'Произнесите трудозатраты';
        nextHandler = 'stafftime';
      }

      // const task: Task = await this.documentFlowApiClient.getTaskByName(userId, userUtterance.text);
      data.taskId = taskId;
      return new SkillResponseBuilder(text)
        .setNextHandler(nextHandler)
        .setData(data)
        .build()

    } catch (error) {

      throw error;

    }

  }

  @UseGuards(SkillAuthGuard)
  @Handler('stafftime')
  async stafftime(@Time() time: Date, @UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: any) {
    const stufftime: Stufftime = {
      taskId: data.taskId,
      userId: userId,
      workTypeId: "457a0f87-5250-11ea-a99d-005056905560",
      dateTime: time,
      countOfMinutes: data.time,
      description: userUtterance.text
    }
    await this.documentFlowApiClient.addStufftime(stufftime);
    return new SkillResponseBuilder('Трудозатраты успешно добавлены')
      .setButton('Список задач', true)
      .setButton('Указать трудозатраты', true)
      .setButton('Отчет', true)
      .build()
  }

  @Command('отмена')
  cancel() {
    return new SkillResponseBuilder('Для продолжения произнесите любую команду')
      .setButton('Список задач', true)
      .setButton('Указать трудозатраты', true)
      .setButton('Отчет', true)
      .build();
  }

  @Command('спасибо')
  thanks() {
    return new SkillResponseBuilder('Всегда рада помочь. Для продолжения назовите команду')
      .setButton('Список задач', true)
      .setButton('Указать трудозатраты', true)
      .setButton('Отчет', true)
      .build();
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
    });
    return new SkillResponseBuilder('Задайте свой вопрос')
      .setData({ stufftimes: responseString })
      .setNextHandler('projectName')
      .build();
  }

  @Handler('projectName')
  @UseGuards(SkillAuthGuard)
  async projectName(@UserId() UserId: string, @Data() data: any, @UserUtterance() UserUtterance: any) {
    const model: LLM = await this.model.getModel();
    const text: string = await model.invoke([`У тебя список трудозатрат по проекту. Найди краткий ответ на вопрос ${UserUtterance.text} ниже в списке:\n ${data.stufftimes}`]);
    return new SkillResponse(text);
  }

  @Command('Отчет')
  @UseGuards(SkillAuthGuard)
  async report(@UserId() userId: string) {

    const stufftimeResponse = await this.documentFlowApiClient.getStafftimeTodayByUserId(userId);
    let stafftime: any[];
    let text: string;
    if (stufftimeResponse.length) {
      stafftime = stufftimeResponse[0].stufftime.map((item: any) => {
        return {
          time: item.countOfMinutes / 60,
          description: item.description
        }
      })
      //    text = stafftime.reduce((text: string, item: any) => text + `**Время**: ${item.time} ч. \n**Трудоемкость:**\n${item.description}\n\n`, '');

      const total = stafftime.reduce((sum: number, item: any) => sum + item.time, 0);
      text = `\nВремя за день: ${total} ч`;
    } else {
      text = 'У вас не указана трудоемкость за этот день';
    }
    return new SkillResponseBuilder(text)
      .setButton('Список задач', true)
      .setButton('Указать трудозатраты', true)
      .setButton('Отчет', true)
      .build()
  }

}