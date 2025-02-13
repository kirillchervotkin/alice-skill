import { Test, TestingModule } from '@nestjs/testing';
import { AItransform, YandexAimTokenProvider, YandexGPTmodel, YandexJWTTokenProvider } from './skill.service';
import config from '../config';

describe('AItransform', () => {
    let service: AItransform;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AItransform,
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
        service = module.get(AItransform);
    });

    it('Should return the number of minutes as a number', async () => {
        expect(await service.toMinutes('полчаса')).toBe(30);
        expect(await service.toMinutes('полтора часа')).toBe(90);
        expect(await service.toMinutes('два часа')).toBe(120);
        expect(await service.toMinutes('2 часа')).toBe(120);
        expect(await service.toMinutes('2:00')).toBe(120);
    });
    it('Should return null', async () => {
        expect(await service.toMinutes('unvalid string')).toBe(null);
    });
});