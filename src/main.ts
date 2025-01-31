import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Logger, ValidationError, ValidationPipe } from '@nestjs/common';
import config from './config';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const filePathOfCert = path.resolve(__dirname, '../src/certs/cert.pem');
  const filePathOfKey = path.resolve(__dirname, '../src/certs/key.pem');
  const httpsOptions = {
    key: fs.readFileSync(filePathOfKey),
    cert: fs.readFileSync(filePathOfCert),
  };
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { httpsOptions });

  const port = config.port || 3000;
  const hostname = config.hostname || 'localhost';
  app.useStaticAssets(path.join(__dirname, '..', 'public'));
  app.setBaseViewsDir(path.join(__dirname, '..', 'views'));

  app.useGlobalPipes(
    new ValidationPipe({
    //  whitelist: true,
      transform: true,
      validateCustomDecorators: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        return new BadRequestException(
          validationErrors.map((error) => ({
            field: error.property,
            error: Object.values(error.constraints as any)[0],
          })),
        );
      },
    }),
  );

  app.setViewEngine('ejs');
  await app.listen(port, hostname, () => {
    const address =
      'https://' + hostname + ':' + port + '/';
    Logger.log('Listening at ' + address);
  });
}

bootstrap();