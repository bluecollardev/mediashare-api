import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

import {
  apiValidationSchema,
  apiSessionValidationSchema,
  awsValidationSchema,
  sesValidationSchema,
  systemEmailValidationSchema,
  dbValidationSchema,
} from '@mediashare/core/configuration';

export const appValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  ...apiValidationSchema,
  ...apiSessionValidationSchema,
  ...awsValidationSchema,
  ...sesValidationSchema,
  ...systemEmailValidationSchema,
  ...dbValidationSchema,
});

// TODO: Use these app envs, instead of process.env everywhere if possible...
export const appConfig = registerAs('app', () => ({
  host: process.env.APP_HOST,
  env: process.env.NODE_ENV,
  name: process.env.APP_NAME,
  port: process.env.PORT,
  globalPrefix: process.env.APP_PREFIX,
  title: process.env.APP_TITLE,
  dbIsMongoAtlas: process.env.DB_IS_ATLAS,
  sessionDb: process.env.DB_URL,
  sessionDbName: process.env.SESSION_DB_NAME,
  sessionSecret: process.env.SESSION_SECRET,
  sessionCollection: process.env.SESSION_DB_COLLECTION,
  awsUrl: process.env.AWS_URL,
  sesModuleRegion: process.env.SES_MODULE_REGION,
  sesModuleAkiKey: process.env.SES_MODULE_AKI_KEY,
  sesModuleSecret: process.env.SES_MODULE_SECRET,
  emailUnsubscribeUrl: process.env.EMAIL_UNSUBSCRIBE_URL,
  emailPreferencesUrl: process.env.EMAIL_PREFERENCES_URL,
  invitationRequestUrl: process.env.INVITATION_REQUEST_URL,
  invitationEmailSubject: process.env.INVITATION_EMAIL_SUBJECT,
  invitationEmailSender: process.env.INVITATION_EMAIL_SENDER,
  acceptInvitationDeeplink: process.env.ACCEPT_INVITATION_DEEPLINK,
  appSubscriberContentUserIds: process.env.APP_SUBSCRIBER_CONTENT_USER_IDS
    ? process.env.APP_SUBSCRIBER_CONTENT_USER_IDS.split(',')
    : [],
}));

export const dbConfig = registerAs('db', () => ({
  type: process.env.DB_TYPE,
  url: process.env.DB_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  ssl: process.env.DB_SSL === 'true',
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  useUnifiedTopology: true,
  useNewUrlParser: true,
  logging: true,
  dropSchema: false,
}));
