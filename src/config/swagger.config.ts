import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication, Logger } from "@nestjs/common";

const logger = new Logger('Swagger');

export const swaggerConfiguration = (app: INestApplication): void => {

    const config = new DocumentBuilder()
        .setTitle('Add Description')
        .setDescription('Loading')
        .setVersion('Loading')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'API Key')
        .build()

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document)

    logger.log(`Docs available at http://localhost:3000/api/docs`)
}