import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { exceptionFormatter } from './utils/class-validator-formatter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { apiReference } from '@scalar/nestjs-api-reference';
import { TransformInterceptor } from './utils/response.interceptors';
import { AllExceptionsFilter } from './utils/exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: exceptionFormatter,
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: ['status', 'health', 'metrics'],
  });

  const config = new DocumentBuilder()
    .setTitle(
      'HNG Stage 3 — Insighta Labs+: Secure Access & Multi-Interface Integration',
    )
    .setDescription(
      'Enriches a name with predicted gender, age, and nationality by querying Genderize.io, Agify.io, and Nationalize.io, ' +
        'persists the result in PostgreSQL, and exposes a natural-language search interface over the stored profiles. ' +
        'Authentication is via GitHub OAuth. All profile endpoints require the X-API-Version: 1 header.',
    )
    .setVersion('2.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use(
    '/docs',
    apiReference({
      content: document,
    }),
  );

  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
});
