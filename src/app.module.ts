import { Injectable, MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import { SkillController, AuthController, IntentMiddleware, TokenController, SkillAuthGuard } from './app.controller';
import { JwtModule } from '@nestjs/jwt';
import { NextFunction } from 'express';

const FIVE_YEARS = '157766400s';

@Module({
  imports: [JwtModule.register({
    global: true,
    secret: "secret",
    signOptions: { expiresIn: FIVE_YEARS },
  })],
  controllers: [SkillController, AuthController, TokenController],
  providers: [SkillAuthGuard],
})


export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IntentMiddleware)
      .forRoutes('');
  }
}
