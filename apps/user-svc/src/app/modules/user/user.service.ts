import { PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { MongoRepository } from 'typeorm';
import { MongoFindOneOptions } from 'typeorm/find-options/mongodb/MongoFindOneOptions';

import { ObjectIdGuard, StringIdGuard } from '@mediashare/core/guards';
import { DataService } from '@mediashare/core/services';
import { IdType } from '@mediashare/shared';
import {
  ApiErrorResponse,
  ApiErrorResponses,
} from '@mediashare/core/errors/api-error';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserDataService extends DataService<User, MongoRepository<User>> {
  constructor(
    @InjectRepository(User) repository: MongoRepository<User>,
    logger: PinoLogger
  ) {
    super(repository, logger);
  }
}

/**
 * TODO: classMapper is not mapping _id fields correctly! Fix this!
 */
@Injectable()
export class UserService {
  constructor(
    public dataService: UserDataService,
    @InjectMapper() private readonly classMapper: Mapper,
    protected logger: PinoLogger
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    const errors = await this.dataService.validateDto(
      CreateUserDto,
      createUserDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      createUserDto,
      CreateUserDto,
      User
    );
    const result = await this.dataService.create(entity);
    return await this.classMapper.mapAsync(result, User, UserDto);
  }

  async update(userId: IdType, updateUserDto: UpdateUserDto): Promise<UserDto> {
    const errors = await this.dataService.validateDto(
      UpdateUserDto,
      updateUserDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      updateUserDto,
      UpdateUserDto,
      User
    );
    const result = await this.dataService.update(userId, entity);
    return await this.classMapper.mapAsync(result, User, UserDto);
  }

  async remove(id: IdType) {
    return await this.dataService.remove(id);
  }

  async findOne(id: IdType) {
    const entity = await this.dataService.findOne(id);
    return await this.classMapper.mapAsync(entity, User, UserDto);
  }

  async findByQuery(query: MongoFindOneOptions<User>) {
    const entity = await this.dataService.findByQuery(query);
    return await this.classMapper.mapAsync(entity, User, UserDto);
  }

  async findByEmail(email: string) {
    const entities = await this.dataService.findAllByQuery({
      where: { email: email.toLowerCase() },
    });
    const fns = entities.map((entity) =>
      this.classMapper.mapAsync(entity, User, UserDto)
    );
    return await Promise.all(fns);
  }

  // TODO: Use mapper
  findById(id: IdType) {
    return this.dataService.repository
      .aggregate([
        { $match: { _id: ObjectIdGuard(id) } },
        {
          $replaceRoot: {
            newRoot: {
              _id: '$_id',
              sub: '$sub',
              username: '$username',
              email: '$email',
              firstName: '$firstName',
              lastName: '$lastName',
              phoneNumber: '$phoneNumber',
              role: '$role',
              imageSrc: '$imageSrc',
              // TODO: Can we remove author from here?
              authorId: '$_id',
              author: '$username',
              authorImage: '$imageSrc',
              authorName: { $concat: ['$firstName', ' ', 'lastName'] },
              transactionId: '$transactionId',
              transactionDate: '$transactionDate',
              transactionEndDate: '$transactionEndDate',
              isDisabled: '$isDisabled',
            },
          },
        },
      ])
      .next();
  }

  // TODO: Use mapper
  findByIds(ids: IdType[]) {
    const objectIds = ids.map((id) => ObjectIdGuard(id));
    return this.dataService.repository
      .aggregate([{ $match: { _id: { $in: objectIds } } }])
      .toArray();
  }

  findBySubs(subs: string[]) {
    const safeSubs = subs.map((sub) => StringIdGuard(sub));
    return this.dataService.repository
      .aggregate([{ $match: { sub: { $in: safeSubs } } }])
      .toArray();
  }

  async findMany() {
    return await this.dataService.repository
      .aggregate([
        // { $lookup: { from: 'share_item', localField: '_id', foreignField: 'userId', as: 'sharedMediaItems' } },
        // { $addFields: { shared: '$sharedMediaItems' } },
        {
          $group: {
            _id: '$_id',
            username: { $first: '$username' },
            email: { $first: '$email' },
            sub: { $first: '$sub' },
            phoneNumber: { $first: '$phoneNumber' },
            firstName: { $first: '$firstName' },
            lastName: { $first: '$lastName' },
            createdAt: { $first: '$createdAt' },
            updatedDate: { $first: '$updatedDate' },
            role: { $first: '$role' },
            imageSrc: { $first: '$imageSrc' },
            // TODO: Can we remove this from here? We have to anyway now...
            //  ...since we split users out into its own microservice
            // sharedMediaItems: { $first: '$sharedMediaItems' },
            transactionId: '$transactionId',
            transactionDate: '$transactionDate',
            transactionEndDate: '$transactionEndDate',
          },
        },
      ])
      .toArray();
  }
}
