import { Controller, Inject, Injectable, UseGuards, UseInterceptors } from "@nestjs/common";
import { UserUtterance, Data, Handler, Intent, Time, UserId, Command } from "../decorators";
import { SkillResponse, SkillResponseBuilder } from "src/response-utils";
import { DocumentFlowApiClient, LLMmodel, Project, Stufftime, Task, Worktypes, YandexGPTClient } from "./skill.service";
import { SkillAuthGuard } from "src/guards";
import { MinutesDto } from "./dto/minutes.dto";
import { TransformUserUtteranceToMinutesInterceptor } from "src/interceptors";
import { LLM } from "@langchain/core/language_models/llms";
import { InMemoryStore } from "@langchain/core/stores";

interface NextItems {
  tasks?: Task[],
  stufftime: Stufftime[]
  increment: number,
  from: string
}

@Injectable()
@Controller()
export class SkillController {

  constructor(
    private readonly documentFlowApiClient: DocumentFlowApiClient,
    private readonly cache: InMemoryStore<string>,
    private readonly worktypesCache: InMemoryStore<string>,
    @Inject() private gptClient: YandexGPTClient,
    @Inject('LLM_MODEL') private readonly model: LLMmodel
  ) {

  }

  @Intent()
  root(): SkillResponse {

    return new SkillResponseBuilder(`Добро пожаловать в навык АйТи План.\nПроизнесите одну из следующих команд:\n\nСписок задач\nУкажи трудозатраты\nОтчет\n`)
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .setButton('Количество отработанных часов', true)
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
    let message: string;
    let nextTasks: Task[] = [];
    if (tasks.length) {
      const firstTenTasks: Task[] = tasks.slice(0, 5);
      message = firstTenTasks.reduce<string>((text: string, task: any, index) => text + (index + 1) + '. ' + task.name + '\n\n', '');
      nextTasks = tasks.slice(5);
    }
    else {
      message = 'У вас нет задач'
    }
    let skillResponseBuilder: SkillResponseBuilder;
    if (nextTasks.length) {
      skillResponseBuilder =  new SkillResponseBuilder(message + `Для продолжения скажите дальше`);
      skillResponseBuilder.setButton('Дальше', true);
    }else{
      skillResponseBuilder =  new SkillResponseBuilder(message);
    }
    
    skillResponseBuilder
      .setData({
        tasks: nextTasks,
        increment: 5,
        from: 'tasks'
      })
   
    return skillResponseBuilder
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .build();
  }


  @UseGuards(SkillAuthGuard)
  @Command('Дальше')
  nextTasks(@Data() data: NextItems | undefined): SkillResponse {
    if (data?.from == 'tasks') {

      if (!data?.tasks?.length) {
        return new SkillResponse('У вас больше нет задач');
      } else {
        let message = data.tasks.slice(0, 5).reduce<string>((text: string, task: any, index) => text + (data.increment + index + 1) + '. ' + task.name + '\n', '');
        
        const nextTasks: Task[] = data.tasks.slice(5);
        if (nextTasks.length) {
          const skillResponseBuilder = new SkillResponseBuilder(message + `Для продолжения скажите дальше`);
          skillResponseBuilder.setButton('Дальше', true);
          skillResponseBuilder.setData({
            tasks: nextTasks,
            increment: data.increment + 5,
            from: 'tasks'
          })
        }
        return new SkillResponseBuilder(message)
          .setButton('Список задач', true)
          .setButton('Укажи трудозатраты', true)
          .setButton('Отчет', true)
          .setButton('Количество отработанных часов', true)
          .build();
      }
    } else if (data?.from == 'stufftime') {

      if (!(data?.stufftime?.length)) {
        return new SkillResponseBuilder(' вас больше нет записей о трудозатратах')
          .setButton('Список задач', true)
          .setButton('Укажи трудозатраты', true)
          .setButton('Отчет', true)
          .build();

      } else {
        const nextStufftime: Stufftime[] = data.stufftime.slice(1);
        const time = Number.parseInt(data.stufftime[0].countOfMinutes) / 60;
        const description: string = data.stufftime[0].description;
        const text = `**Время**: ${time} ч. \n**Трудоемкость:**\n${description}`;
        const skillResponseBuilder: SkillResponseBuilder = new SkillResponseBuilder(text);
        if (nextStufftime.length) {
          skillResponseBuilder.setButton('Дальше', true);
          skillResponseBuilder.setData({
            stufftime: nextStufftime,
            from: 'stufftime'
          })
        }
        return skillResponseBuilder
          .setButton('Список задач', true)
          .setButton('Укажи трудозатраты', true)
          .setButton('Отчет', true)
          .build();
      }
    } else {
      return new SkillResponseBuilder('Произнесите команду')
        .setButton('Список задач', true)
        .setButton('Укажи трудозатраты', true)
        .setButton('Отчет', true)
        .setButton('Количество отработанных часов', true)
        .build();

    }
  }

  @UseGuards(SkillAuthGuard)
  @Intent('addStufftime')
  async addStufftime(@UserId() userId: string) {
    const hasOverdueTasks: boolean = await this.documentFlowApiClient.checkOverdueTasks(userId);
    if (hasOverdueTasks) {
      return new SkillResponse('У вас есть просроченные задачи. Для указания трудозатрат вам необходимо запросить продление срока');
    } else {
      return new SkillResponseBuilder('Сколько времени вы хотите указать?')
        .setNextHandler('time')
        .setButton('15 минут', true)
        .setButton('30 минут', true)
        .setButton('1 час', true)
        .setButton('1,5 часа', true)
        .setButton('2 часа', true)
        .setButton('Отмена', true)
        .build()
    }
  }

  @UseInterceptors(TransformUserUtteranceToMinutesInterceptor)
  @UseGuards(SkillAuthGuard)
  @Handler('time')
  async time(@UserId() userId: string, @UserUtterance() UserUtterance: MinutesDto) {

    const skillResponseBuilder: SkillResponseBuilder = new SkillResponseBuilder('По какой задаче вы хотите указать трудозатраты?')
      .setNextHandler('task')
      .setData({ countOfMinutes: UserUtterance.text })
      .setButton('Отмена', true)
    return skillResponseBuilder.build();
  }

  @UseGuards(SkillAuthGuard)
  @Handler('task')
  async task(@UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: any) {

    const tasksObjects: Task[] = await this.documentFlowApiClient.getTasks(userId);
    const taskIdArray: string[] = await this.cache.mget([userUtterance.text]);
    let taskId: string | undefined;
    if (typeof taskIdArray[0] !== 'undefined') {
      taskId = taskIdArray[0];
      if (!tasksObjects.filter((item: Task) => item.id == taskId).length) {
        this.cache.mdelete([taskId]);
        taskId = undefined;
      }
    }

    if (typeof taskId === 'undefined') {
      const responseFromModel: string | null = await this.gptClient.findItemIdByName(tasksObjects, userUtterance.text);
      if (!responseFromModel) {
        taskId = undefined;
      } else {
        taskId = responseFromModel;
        this.cache.mset([[userUtterance.text, taskId]])
      }
    }
    let response: SkillResponseBuilder;

    if (typeof taskId === 'undefined') {
      response = new SkillResponseBuilder('Не нашла такой задачи. Попробуйте произнести по другому')
        .setNextHandler('task')
    } else {
      const worktypes: Worktypes[] = await this.documentFlowApiClient.getWorktypes();
      data.worktypes = worktypes;
      response = new SkillResponseBuilder('Какой вид работы у трудоёмкости?')
        .setNextHandler('worktype')
      worktypes.forEach(item => response.setButton(item.name, true));
    }

    data.taskId = taskId;


    return response
      .setData(data)
      .build();


  }

  @UseGuards(SkillAuthGuard)
  @Handler('worktype')
  async worktype(@Data() data: any, @UserUtterance() userUtterance: any): Promise<SkillResponse> {
    const worktypes: Worktypes[] = data.worktypes;
    const worktype: Worktypes | undefined = worktypes.find((worktype: Worktypes) => worktype.name === userUtterance);
    if (typeof worktype !== 'undefined') {
      data.workTypeId = worktype.id;
    } else {

      const worktypesIdArray: string[] = await this.worktypesCache.mget([userUtterance.text]);
      let worktypeId: string | undefined;

      if (typeof worktypesIdArray[0] !== 'undefined') {
        worktypeId = worktypesIdArray[0];
        if (!worktypes.some((worktype: Worktypes) => worktype.id === worktypeId)) {
          this.worktypesCache.mdelete([worktypeId]);
          worktypeId = undefined;
        } else {
          data.workTypeId = worktypeId;
        }
      }

      if (typeof worktypeId === 'undefined') {
        const responseFromModel: string | null = await this.gptClient.findItemIdByName(worktypes, userUtterance.text);
        if (!responseFromModel) {
          data.workTypeId = undefined;
        } else {
          worktypeId = responseFromModel;
          this.worktypesCache.mset([[userUtterance.text, worktypeId]]);
          data.workTypeId = worktypeId;
        }
      }

    }
    if (typeof data.workTypeId === 'undefined') {
      return new SkillResponseBuilder('Не нашла такой вид работ. Попробуйте произнести по другому')
        .setData(data)
        .setNextHandler('worktype')
        .build();
    } else {
      return new SkillResponseBuilder('Произнесите трудозатраты')
        .setData(data)
        .setNextHandler('stafftime')
        .build();
    }
  }

  @UseGuards(SkillAuthGuard)
  @Handler('stafftime')
  async stafftime(@Time() time: Date, @UserId() userId: string, @Data() data: any, @UserUtterance() userUtterance: any) {

    const description: string = await this.gptClient.splitIntoSentencesPreserveOriginal(userUtterance.text);
    const stufftime: Stufftime = {
      taskId: data.taskId,
      userId: userId,
      workTypeId: data.workTypeId,
      dateTime: time,
      countOfMinutes: data.countOfMinutes,
      description: description
    }

    return new SkillResponseBuilder(`В систему будет добавлен следующий текст: ${description} \nПодтвердить?`)
      .setButton('Да', true)
      .setButton('Отмена', true)
      .setData(stufftime)
      .setNextHandler('check')
      .build()
  }

  @UseGuards(SkillAuthGuard)
  @Handler('check')
  async check(@Data() data: Stufftime, @UserUtterance() userUtterance: any) {

    data.dateTime = new Date(data.dateTime);
    if ((userUtterance.text.toLowerCase() == `да`) || (userUtterance.text.toLowerCase() == `Подтвердить`) || (userUtterance.text.toLowerCase() == `Подтвержда`)) {
      await this.documentFlowApiClient.addStufftime(data);
      return new SkillResponse('Трудозатраты успешно добавлены');
    } else {
      return new SkillResponseBuilder(`Произнесите трудозатраты`)
        .setButton('Список задач', true)
        .setButton('Укажи трудозатраты', true)
        .setButton('Отчет', true)
        .setData(data)
        .setNextHandler('stafftime')
        .build()

    }

  }

  @Command('отмена')
  cancel() {
    return new SkillResponseBuilder('Для продолжения произнесите любую команду')
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .setButton('Количество отработанных часов', true)
      .build();
  }

  @Command('спасибо')
  thanks() {
    return new SkillResponseBuilder('Всегда рада помочь. Для продолжения назовите команду')
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .setButton('Количество отработанных часов', true)
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

    const response = (await this.documentFlowApiClient.getStafftimeTodayByUserId(userId))
    let stafftime: Stufftime[];
    if (response.length) {
      stafftime = response[0].stufftime;
    } else {
      stafftime = [];
    }
    let text: string;
    if (stafftime.length) {
      const time = Number.parseInt(stafftime[0].countOfMinutes) / 60;
      const description: string = stafftime[0].description;
      text = `**Время**: ${time} ч. \n**Трудоемкость:**\n${description}`;
    } else {
      text = 'У вас не указана трудоемкость за этот день';
    }
    let skillResponseBuilder: SkillResponseBuilder = new SkillResponseBuilder(text);
    if (stafftime.slice(1).length) {
      skillResponseBuilder.setButton('Дальше', true);
    }
    skillResponseBuilder
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .setButton('Количество отработанных часов', true)
      .setData({
        stufftime: stafftime.slice(1),
        from: 'stufftime'
      })
    return skillResponseBuilder.build();

  }

  @Command('Количество отработанных часов')
  @UseGuards(SkillAuthGuard)
  async countOfMinutes(@UserId() userId: string) {

    const response = (await this.documentFlowApiClient.getStafftimeTodayByUserId(userId))
    let stafftime: Stufftime[];
    if (response.length) {
      stafftime = response[0].stufftime;
    } else {
      stafftime = [];
    }
    let text: string;
    const total = stafftime.reduce<Number>((sum: number, item: Stufftime) => sum + Number.parseInt(item.countOfMinutes) / 60, 0);
    text = `Время за день: ${total} ч`;
    return new SkillResponseBuilder(text)
      .setButton('Список задач', true)
      .setButton('Укажи трудозатраты', true)
      .setButton('Отчет', true)
      .setButton('Количество отработанных часов', true)
      .build();

  }

}