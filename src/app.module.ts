import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SkillController } from './skill/skill.controller';
import { TokenController, AuthController } from './token/token.controller';
import { IntentMiddleware } from './middlewares';
import { AuthenticationService } from './token/token.service';
import { DocumentFlowApiClient } from './skill/skill.service';

const FIVE_YEARS = '157766400s';

@Module({
  imports: [JwtModule.register({
    global: true,
    secret: "secret",
    signOptions: { expiresIn: FIVE_YEARS },
  })],
  controllers: [SkillController, AuthController, TokenController],
  providers: [AuthenticationService, DocumentFlowApiClient ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IntentMiddleware)
      .forRoutes('');
  }
}
