import { Test, TestingModule } from '@nestjs/testing';
import { AItransform, Worktypes, YandexAimTokenProvider, YandexGPTClient, YandexGPTmodel, YandexJWTTokenProvider } from './skill.service';
import config from '../config';

describe('AItransform', () => {
    let service: YandexGPTClient;
    let worktypes: Worktypes[]
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [YandexGPTClient,
                { provide: 'KEY', useValue: config.key.id },
                { provide: 'PRIVATE_KEY', useValue: config.key.privateKey },
                { provide: 'SERVICE_ACCOUNT_ID', useValue: config.key.serviceAccountId },
                { provide: 'JWT_TOKEN_PROVIDER', useClass: YandexJWTTokenProvider },
                { provide: 'TOKEN_PROVIDER', useClass: YandexAimTokenProvider },
                { provide: 'LLM_MODEL', useClass: YandexGPTmodel },
                { provide: 'FOLDER_ID', useValue: config.llmConfig.folderID },
                { provide: 'MODEL_URI', useValue: config.llmConfig.modelURI },
            ],
        }).compile();
        service = module.get(YandexGPTClient);
        worktypes = [
            {
              name: "(не использовать) Внутренние работы",
              id: "bc73e0ff-b13f-11ea-a9b4-005056905560",
            },
            {
              name: "(не использовать) Дневные планы",
              id: "b4ba3624-839d-11ea-a9a3-005056905560",
            },
            {
              name: "(не использовать) За свой счет",
              id: "901f13d8-5305-11ea-a99d-005056905560",
            },
            {
              name: "(не использовать) Моделирование",
              id: "3c517f9e-5250-11ea-a99d-005056905560",
            },
            {
              name: "(не использовать) Настройка/Разработка",
              id: "0999f47f-5250-11ea-a99d-005056905560",
            },
            {
              name: "(не использовать) Нотации BPMN",
              id: "bfef96a3-4d24-11ec-a9f9-fa163ec99d58",
            },
            {
              name: "(не использовать) Обучение и инструкции",
              id: "7020b21e-5fab-11ea-a9a0-005056905560",
            },
            {
              name: "(не использовать) Прочее",
              id: "c8ae62c6-4d24-11ec-a9f9-fa163ec99d58",
            },
            {
              name: "(не использовать) Тестирование",
              id: "2daadc44-5faa-11ea-a9a0-005056905560",
            },
            {
              name: "(не использовать) Техническое задание",
              id: "a35f1698-642a-11ea-a9a1-005056905560",
            },
            {
              name: "Административные работы",
              id: "457a0f87-5250-11ea-a99d-005056905560",
            },
            {
              name: "Анализ/Обследование (внутр.)",
              id: "7f030f0a-524c-11ea-a99d-005056905560",
            },
            {
              name: "Анализ/Оценка",
              id: "4b0b2bdb-0c0c-11f0-b932-a43cf15fdb14",
            },
            {
              name: "Больничный",
              id: "8f6c0213-c116-11ea-a9b6-005056905560",
            },
            {
              name: "Встреча",
              id: "a35f1699-642a-11ea-a9a1-005056905560",
            },
            {
              name: "Моделирование сценария/процесса",
              id: "8d9a9561-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Написание протокола встреч",
              id: "84bc1ea0-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Написание технического задания",
              id: "9531c46a-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Настройка типового функционала",
              id: "df25adc3-0626-11f0-b932-a43cf15fdb14",
            },
            {
              name: "Обучение пользователей",
              id: "aec43318-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Описание шагов/требований процесса",
              id: "6c51e038-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Отпуск",
              id: "0db537bd-b140-11ea-a9b4-005056905560",
            },
            {
              name: "Отработка вопросов/замечаний по задаче/по процессу",
              id: "c037b34a-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Отрисовка схемы BPMN",
              id: "20b747da-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Перенос разработки в рабочую базу",
              id: "b896b060-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Предпродажные работы",
              id: "d6a7c4ce-9bfb-11ea-a9b0-005056905560",
            },
            {
              name: "Проведение демонстрации пользователям",
              id: "804447f1-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Проведение интервью с пользователями",
              id: "7629dd02-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Работы по гарантии",
              id: "3f1b2282-0c0c-11f0-b932-a43cf15fdb14",
            },
            {
              name: "Разработка программистом",
              id: "a9675a52-f80d-11ef-b932-a43cf15fdb14",
            },
            {
              name: "Тестирование разработки",
              id: "b345fbe2-f80d-11ef-b932-a43cf15fdb14",
            },
          ]
    });

    it('Should return the number of minutes as a number', async () => {
        expect(await service.textoMinutes('полчаса')).toBe(30);
        expect(await service.textoMinutes('полтора часа')).toBe(90);
        expect(await service.textoMinutes('два часа')).toBe(120);
        expect(await service.textoMinutes('2 часа')).toBe(120);
        expect(await service.textoMinutes('2:00')).toBe(120);
        expect(await service.textoMinutes('15 минут')).toBe(15);
    });
    it('Should return null', async () => {
        expect(await service.textoMinutes('unvalid string')).toBe(null);
    });

    it('Should return correct id', async () => {
        expect(await service.findItemIdByName(worktypes, 'Отработка замечаний по процессу')).toBe('c037b34a-f80d-11ef-b932-a43cf15fdb14');
    });
});