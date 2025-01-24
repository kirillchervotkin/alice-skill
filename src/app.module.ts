import { Module } from '@nestjs/common';
import { AppController, AuthController, TokenController } from './app.controller';
import { JwtModule } from '@nestjs/jwt';

const FIVE_YEARS = '157766400s';

@Module({
  imports: [JwtModule.register({
    global: true,
    secret: "secret",
    signOptions: { expiresIn: FIVE_YEARS },
  })],
  controllers: [AppController, AuthController, TokenController],
  providers: [],
})
export class AppModule {}
