import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MongoRepository } from 'typeorm';
import { SearchParameters } from '@mediashare/shared';
import { MongoFindManyOptions } from 'typeorm/find-options/mongodb/MongoFindManyOptions';
import { MongoFindOneOptions } from 'typeorm/find-options/mongodb/MongoFindOneOptions';
import { DataProviderBaseEntity } from '../entities/base.entity';
import { ObjectIdGuard } from '../guards';
import { IdType } from '@mediashare/shared';
import { omit } from 'remeda';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface DataServiceValidationResponse {
  errors: ValidationError[];
}

const validationErrorResponse = (errors: any) => ({ errors });

/**
 * Base class to extend for interacting with the database through a repository pattern.
 * Add new standard database interaction methods here. Abstract away complex & nonstandard ones.
 * @export
 * @class DataService
 * @template E - Model extends MsBaseEntity
 * @template R - repository extends MongoRepository<Model>
 */
@Injectable()
export abstract class DataService<
  E extends DataProviderBaseEntity<E>,
  R extends MongoRepository<E>
> {
  protected constructor(
    public repository: R,
    protected readonly logger: PinoLogger
  ) {}

  /**
   * The final stop-gap against bad data insertion.
   * This uses class-validator annotations in the Entity
   * in order to validate the Entity prior to insertion.
   * @param dtoClass
   * @param dto
   * @private
   */
  async validateDto(
    dtoClass,
    dto
  ): Promise<boolean | DataServiceValidationResponse> {
    const errors = await validate(plainToInstance(dtoClass, dto));
    return errors.length === 0 ? false : validationErrorResponse(errors);
  }

  /**
   * Create a repository item.
   *
   * @return {*}
   * @memberof DataService
   * @param entity
   */
  async create(entity: E): Promise<E> {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      this.logger.error(`${this.constructor.name}.create ${error}`);
      throw error;
    }
  }

  /**
   * Update a document by id.
   *
   * @param {string} id
   * @param entity
   * @return {*}
   * @memberof DataService
   */
  async update(id: IdType, entity: Partial<E>): Promise<E> {
    try {
      const entityWithNoId = omit(entity, ['_id']);
      await this.repository.findOneAndUpdate(
        { _id: ObjectIdGuard(id) },
        { $set: { ...entityWithNoId } }
      );
      // Node.js Mongo https://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#~findAndModifyWriteOpResult
      // For whatever reason, although the return type is Promise<Document>,
      // we're getting back a findAndModifyWriteOpResultObject:
      // { value, lastErrorObject, ok }
      return (await this.findOne(id)) as E;
      // return result.value as E;
    } catch (error) {
      this.logger.error(`${this.constructor.name}.update ${error}`);
      throw error;
    }
  }

  /**
   * Remove a document by id.
   *
   * @param {string} id
   * @return {*}
   * @memberof DataService
   */
  async remove(id: IdType) {
    try {
      return await this.repository.delete(ObjectIdGuard(id).toHexString());
    } catch (error) {
      this.logger.error(`${this.constructor.name}.remove ${error}`);
      throw error;
    }
  }

  /**
   * Find a document by id.
   *
   * @param {string} id
   * @param opts
   * @return {*}
   * @memberof DataService
   */
  async findOne(
    id: IdType,
    opts: MongoFindOneOptions | undefined = undefined
  ): Promise<E> {
    try {
      const document = await this.repository.findOneBy({
        _id: ObjectIdGuard(id),
      });
      return document as E;
    } catch (error) {
      this.logger.error(`${this.constructor.name}.findOne ${error}`);
      throw error;
    }
  }

  /**
   * Find all documents in collection.
   *
   * @return {*}
   * @memberof DataService
   */
  async findAll(): Promise<E[]> {
    try {
      const findAll = await this.repository.find();
      return findAll as E[];
    } catch (error) {
      this.logger.error(`${this.constructor.name}.findAll ${error}`);
      throw new HttpException(
        'InternalServerErrorException',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Find document by any partial query of the entity.
   *
   * @param {Partial<E>} query
   * @return {*}
   * @memberof DataService
   */
  async findByQuery(query: MongoFindOneOptions<E>): Promise<E> {
    try {
      const findByQuery = await this.repository.findOne(query);
      return findByQuery as E;
    } catch (error) {
      this.logger.error(`${this.constructor.name}.findOne ${error}`);
      throw error;
    }
  }

  /**
   * Find many document by any partial query of the entity.
   *
   * @param {Partial<E>} query
   * @return {*}
   * @memberof DataService
   */
  async findAllByQuery(query: MongoFindManyOptions<E>): Promise<E[]> {
    try {
      const findByQuery = await this.repository.find(query);
      return findByQuery as E[];
    } catch (error) {
      this.logger.error(`${this.constructor.name}.findAllByQuery ${error}`);
      throw error;
    }
  }

  async insertMany(items: E[]): Promise<E[]> {
    try {
      const inserted = await this.repository.save(items);
      return inserted as E[];
    } catch (error) {
      this.logger.error(
        `${this.constructor.name}.insertMany failed with: ${error}`
      );
      throw error;
    }
  }

  /**
   * Override this method when implementing aggregates.
   * @protected
   */
  // eslint-disable-next-line no-empty-pattern
  protected buildAggregateQuery({}: SearchParameters): any[] {
    let aggregateQuery = [];

    aggregateQuery = aggregateQuery.concat([...this.buildFields()]);

    return aggregateQuery;
  }

  /**
   * Override this method when implementing aggregates.
   * @protected
   */
  protected buildFields() {
    return [];
  }

  public buildAuthorFields() {
    return [
      {
        $lookup: {
          from: 'user',
          localField: 'createdBy',
          foreignField: 'sub',
          as: 'author',
        },
      },
      // TODO: Fix this author inclusion!
      /* { $unwind: { path: '$author' } },
      {
        $addFields: {
          authorProfile: {
            authorSub: '$author.sub',
            authorName: {
              $concat: ['$author.firstName', ' ', '$author.lastName'],
            },
            authorUsername: '$author.username',
            authorImage: '$author.imageSrc',
          },
        },
      }, */
    ];
  }

  public buildAuthorReplaceRootDetails() {
    return {
      username: '$author.username',
      author: '$author',
      authorProfile: '$authorProfile',
    };
  }
}
