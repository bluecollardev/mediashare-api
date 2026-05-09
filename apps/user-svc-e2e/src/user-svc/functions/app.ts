/* Ignore module boundaries, it's just our test scaffolding */
/* eslint-disable @nx/enforce-module-boundaries */
import { classes } from '@automapper/classes';
import {
  createMap,
  createMapper,
  Dictionary,
  forMember,
  ignore,
  Mapper,
  ModelIdentifier,
} from '@automapper/core';
import { AutomapperModule } from '@automapper/nestjs';
import { createDB } from '@mediashare/shared/test';
import { CognitoAuthModule } from '@nestjs-cognito/auth';
import { CognitoModuleOptions } from '@nestjs-cognito/core';
import { CognitoTestingModule } from '@nestjs-cognito/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import bodyParser from 'body-parser';
import { LoggerModule } from 'nestjs-pino';
import { configureOpenApi } from '@mediashare/shared';
import { UserConnection } from '@mediashare/user-svc/src/app/modules/user-connection/entities/user-connection.entity';
import { UserConnectionModule } from '@mediashare/user-svc/src/app/modules/user-connection/user-connection.module';
import { User } from '@mediashare/user-svc/src/app/modules/user/entities/user.entity';
import { UserModule } from '@mediashare/user-svc/src/app/modules/user/user.module';

export const getBaseUrl = async (app: INestApplication, globalPrefix) =>
  (await app.getUrl()).replace('[::1]', 'localhost') + `/${globalPrefix}`;

export const initializeMapper = <E, D, C, U>(
  entity: E,
  dto: D,
  createDto: C,
  updateDto: U
): Mapper => {
  const mapper = createMapper({ strategyInitializer: classes() });
  createMap(
    mapper,
    entity as ModelIdentifier<Dictionary<E>>,
    dto as ModelIdentifier<Dictionary<D>>
  );
  createMap(
    mapper,
    createDto as ModelIdentifier<Dictionary<C>>,
    entity as ModelIdentifier<Dictionary<E>>,
    forMember((dest) => dest['_id'], ignore())
  );
  createMap(
    mapper,
    updateDto as ModelIdentifier<Dictionary<U>>,
    entity as ModelIdentifier<Dictionary<E>>,
    forMember((dest) => dest['_id'], ignore())
  );
  return mapper;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const initializeDB = async (entities: any[]) => {
  const db = await createDB([...entities]);
  await db.initialize();
  return db;
};

export const initializeApp = async (
  globalPrefix = 'api'
): Promise<INestApplication> => {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'mediashare-test',
        username: 'mongodb',
        password: '',
        entities: [User, UserConnection],
        ssl: false,
        autoLoadEntities: true,
        synchronize: true,
        useUnifiedTopology: true,
        useNewUrlParser: true,
        logging: true,
        dropSchema: true,
      }),
      AutomapperModule.forRoot({
        strategyInitializer: classes(),
      }),
      CognitoAuthModule.register({
        identityProvider: {
          region: 'us-west-2',
        },
        jwtVerifier: {
          userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-west-2_NIibhhG4d',
          clientId:
            process.env.COGNITO_CLIENT_ID || '1n3of997k64in850vgp1hn849v',
          tokenUse: 'id',
        },
      }),
      CognitoTestingModule.register({
        identityProvider: {
          region: 'us-west-2',
        },
        jwtVerifier: {
          userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-west-2_NIibhhG4d',
          clientId:
            process.env.COGNITO_CLIENT_ID || '1n3of997k64in850vgp1hn849v',
          tokenUse: 'id',
        },
      } as CognitoModuleOptions),
      UserModule,
      UserConnectionModule,
      LoggerModule.forRoot(),
    ],
    controllers: [],
    providers: [],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix(globalPrefix);
  // config = moduleFixture.get(ConfigService);

  configureOpenApi(app)(SwaggerModule)({
    globalPrefix,
    title: `User Service`,
    description: `User Service`,
    version: `0.0.1`,
    tag: `user-svc`,
    servers: [
      {
        // TODO: Fix the port so swagger works? This is just tests so we probably don't care...
        url: `http://localhost:5555`,
        description: `local`,
      },
      {
        url: `https://user-api.dev.afehrpt.com`,
        description: `staging`,
      },
      {
        url: `https://user-api.afehrpt.com`,
        description: `production`,
      },
    ],
  });

  app.use(bodyParser.json()); // For parsing application/json
  app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

  await app.listen(0);
  return app;
};
