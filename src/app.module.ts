import { Module } from '@nestjs/common';
import { AppController, AuthController, TokenController } from './app.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';


@Module({
  imports: [JwtModule.register({
    global: true,
    secret: "test",
    signOptions: { expiresIn: '182500000s' },
  })],
  controllers: [AppController, AuthController, TokenController],
  providers: [],
})
export class AppModule {}
