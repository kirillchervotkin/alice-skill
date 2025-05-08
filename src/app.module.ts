import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SkillController } from './skill/skill.controller';
import { TokenController, AuthController } from './token/token.controller';
import { IntentMiddleware } from './middlewares';
import { AuthenticationService } from './token/token.service';
import { AItransform, DocumentFlowApiClient, KeepAlive, YandexAimTokenProvider, YandexGPTClient, YandexGPTmodel, YandexJWTTokenProvider } from './skill/skill.service';
import config from './config';
import { GlobalExceptionFilter } from './exceptionFilters';
import { ScheduleModule } from '@nestjs/schedule';
import { InMemoryStore } from "@langchain/core/stores";


const FIVE_YEARS = '157766400s';

@Module({
  imports: [JwtModule.register({
    global: true,
    secret: "secret",
    signOptions: { expiresIn: FIVE_YEARS },
  }),
  ScheduleModule.forRoot()
],
  controllers: [SkillController, AuthController, TokenController],
  providers: [
    KeepAlive,
    AuthenticationService,
    DocumentFlowApiClient,
    AItransform,
    YandexGPTClient,
    InMemoryStore<string>,
     {
      provide: DocumentFlowApiClient, 
      useFactory: async () => {
        const client = new DocumentFlowApiClient();
        client.keepAlive(); 
        return client;
      }, 
    },
    { provide: 'KEY', useValue: config.key.id },
    { provide: 'PRIVATE_KEY', useValue: config.key.privateKey },
    { provide: 'SERVICE_ACCOUNT_ID', useValue: config.key.serviceAccountId },
    { provide: 'JWT_TOKEN_PROVIDER', useClass: YandexJWTTokenProvider },
    { provide: 'TOKEN_PROVIDER', useClass: YandexAimTokenProvider },
    { provide: 'LLM_MODEL', useClass: YandexGPTmodel },
    { provide: 'FOLDER_ID', useValue: config.llmConfig.folderID },
    { provide: 'MODEL_URI', useValue: config.llmConfig.modelURI },

  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IntentMiddleware)
      .forRoutes({ path: '/', method: RequestMethod.POST });
  }
}
