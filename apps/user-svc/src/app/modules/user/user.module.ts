// import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMapping } from './mappers/automapper.profile';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService, UserDataService } from './user.service';
import { AdminGuard } from './admin.guard';
import { UserConnection } from '../user-connection/entities/user-connection.entity';
import { UserConnectionModule } from '../user-connection/user-connection.module';
import {
  UserConnectionDataService,
  UserConnectionService,
} from '../user-connection/user-connection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserConnection]),
    UserConnectionModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserDataService,
    UserMapping,
    UserConnectionService,
    UserConnectionDataService,
    AdminGuard,
  ],
  exports: [UserService],
})
export class UserModule {}
/* export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtDecodeMiddleware).forRoutes(UsersController);
  }
} */
