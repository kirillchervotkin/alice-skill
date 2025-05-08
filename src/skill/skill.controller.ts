import { Controller, Inject, Injectable, UseGuards, UseInterceptors } from "@nestjs/common";
import { UserUtterance, Data, Handler, Intent, Time, UserId, Command } from "../decorators";
import { Button, SkillResponse, SkillResponseBuilder } from "src/response-utils";
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

enum TaskSource {
  TASKS = 'tasks',
  STUFFTIME = 'stufftime'
}

@Injectable()
@Controller()
export class SkillController {

  // Константы и перечисления
  private readonly TASKS_PER_PAGE: number = 5;
  private readonly commonButtons: Button[] = [
    { title: 'Список задач', hide: true },
    { title: 'Укажи трудозатраты', hide: true },
    { title: 'Отчет', hide: true },
    { title: 'Количество отработанных часов', hide: true }
  ];


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
      skillResponseBuilder = new SkillResponseBuilder(message + `Для продолжения скажите дальше`);
      skillResponseBuilder.setButton('Дальше', true);
    } else {
      skillResponseBuilder = new SkillResponseBuilder(message);
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

  private buildDefaultResponse(): SkillResponse {
    return new SkillResponse(`Для продолжения назовите команду`);
  }


  @UseGuards(SkillAuthGuard)
  @Command('Дальше')
  nextTasks(@Data() data: NextItems | undefined): SkillResponse {
    return this.handleNextItems(data);
  }

  private handleNextItems(data?: NextItems): SkillResponse {
    if (!data?.from) {
      return this.buildDefaultResponse();
    }

    switch (data.from) {
      case TaskSource.TASKS:
        return this.handleTasks(data);
      case TaskSource.STUFFTIME:
        return this.handleStufftime(data);
      default:
        return this.buildDefaultResponse();
    }
  }

  private handleTasks(data: NextItems): SkillResponse {
    if (!data.tasks?.length) {
      return new SkillResponse('У вас больше нет задач');
    }

    const visibleTasks = data.tasks.slice(0, this.TASKS_PER_PAGE);
    let message = this.buildTaskListMessage(visibleTasks, data.increment);
    const nextTasks = data.tasks.slice(this.TASKS_PER_PAGE);
    if (!nextTasks.length) {
      message = message + `\n\n Я перечислила все задачи которые у вас есть. Для продолжения назовите любую команду`;
    }

    return this.buildTaskResponse(message, nextTasks, data.increment);
  }

  private handleStufftime(data: NextItems): SkillResponse {
    if (!data.stufftime?.length) {
      return this.buildDefaultResponse();
    }

    const [currentItem, ...remainingItems] = data.stufftime;
    const message = this.buildStufftimeMessage(currentItem);

    return this.buildStufftimeResponse(message, remainingItems);
  }

  // Вспомогательные методы
  private buildTaskListMessage(tasks: Task[], increment: number = 0): string {
    return tasks.reduce((text, task, index) =>
      text + `${increment + index + 1}. ${task.name}\n`, '');
  }

  private buildTaskResponse(message: string, nextTasks: Task[], increment: number): SkillResponse {
    const builder = new SkillResponseBuilder(message)
      .setButtons(this.commonButtons);

    if (nextTasks.length) {
      builder
        .setPrependButton('Дальше', true)
        .setData({
          tasks: nextTasks,
          increment: increment + this.TASKS_PER_PAGE,
          from: TaskSource.TASKS
        })
    }

    return builder.build();
  }

  private buildStufftimeMessage(item: Stufftime): string {
    const time = Number.parseInt(item.countOfMinutes) / 60;
    return `**Время**: ${time} ч. \n**Трудоемкость:**\n${item.description}`;
  }

  private buildStufftimeResponse(message: string, remainingItems: Stufftime[]): SkillResponse {
    const builder = new SkillResponseBuilder(message)
      .setButtons(this.commonButtons);

    if (remainingItems.length) {
      builder
        .setButton('Дальше', true)
        .setData({
          stufftime: remainingItems,
          from: TaskSource.STUFFTIME
        });
    }

    return builder.build();
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
  async task(
    @UserId() userId: string,
    @Data() data: any,
    @UserUtterance() userUtterance: any
  ): Promise<SkillResponse> {
    // Получаем список задач пользователя
    const tasksObjects: Task[] = await this.documentFlowApiClient.getTasks(userId);

    // Проверяем кэш на наличие taskId
    const cachedTaskId = (await this.cache.mget([userUtterance.text]))[0];
    let taskId: string | undefined;

    // Проверяем валидность cachedTaskId
    if (cachedTaskId) {
      const taskExists = tasksObjects.some(task => task.id === cachedTaskId);
      if (taskExists) {
        taskId = cachedTaskId;
      } else {
        await this.cache.mdelete([cachedTaskId]);
      }
    }

    // Если taskId не найден, запрашиваем у модели
    if (!taskId) {
      const responseFromModel = await this.gptClient.findItemIdByName(tasksObjects, userUtterance.text);
      if (responseFromModel) {
        taskId = responseFromModel;
        await this.cache.mset([[userUtterance.text, taskId]]);
      }
    }

    // Формируем ответ
    let response: SkillResponseBuilder;

    if (!taskId) {
      response = new SkillResponseBuilder('Не нашла такой задачи. Попробуйте произнести по-другому')
        .setNextHandler('task');
    } else {
      const worktypes: Worktypes[] = await this.documentFlowApiClient.getWorktypes();
      data.worktypes = worktypes;

      response = new SkillResponseBuilder('Какой вид работы у трудоёмкости?')
        .setNextHandler('worktype');

      worktypes.forEach(item => response.setButton(item.name, true));
    }

    data.taskId = taskId;

    return response
      .setData(data)
      .build();
  }

  // Защищаем обработчик с помощью SkillAuthGuard для проверки прав доступа
  @UseGuards(SkillAuthGuard)
  // Обработчик для определения типа работ по ключевому слову 'worktype'
  @Handler('worktype')
  async worktype(@Data() data: any, @UserUtterance() userUtterance: any): Promise<SkillResponse> {
    const worktypes: Worktypes[] = data.worktypes;

    // Поиск точного совпадения по названию работы
    const worktype = worktypes.find(w => w.name === userUtterance.text);

    if (worktype) {
      data.workTypeId = worktype.id; // Сохраняем найденный ID
    } else {
      // Проверка кэша для ранее сохраненных соответствий 
      const [cachedId] = await this.worktypesCache.mget([userUtterance.text]);

      if (cachedId && worktypes.some(w => w.id === cachedId)) {
        data.workTypeId = cachedId; // Используем валидный ID из кэша
      } else {
        if (cachedId) {
          // Удаляем невалидную запись из кэша
          await this.worktypesCache.mdelete([cachedId]);
        }

        // Запрос к AI-модели для определения ID по названию 
        const responseFromModel = await this.gptClient.findItemIdByName(worktypes, userUtterance.text);
        data.workTypeId = responseFromModel || undefined;

        if (responseFromModel) {
          // Кэшируем новое соответствие 
          await this.worktypesCache.mset([[userUtterance.text, responseFromModel]]);
        }
      }
    }

    // Обработка случая, когда ID не найден
    if (!data.workTypeId) {
      return new SkillResponseBuilder('Не нашла такой вид работ. Попробуйте произнести по-другому')
        .setData(data)
        .setNextHandler('worktype') // Повторный вызов того же обработчика
        .build();
    }

    return new SkillResponseBuilder('Произнесите трудозатраты')
      .setData(data)
      .setNextHandler('stafftime')
      .build();
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