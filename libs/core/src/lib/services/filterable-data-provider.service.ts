import { IdType } from '@mediashare/shared';
import { Injectable } from '@nestjs/common';
import { ObjectIdGuard, StringIdGuard } from '../guards';
import { PinoLogger } from 'nestjs-pino';
import { MongoRepository } from 'typeorm';
import { DataService } from './data-provider.service';
import { SearchParameters } from '@mediashare/shared';
import { DataProviderBaseEntity } from '../entities/base.entity';

/**
 * Base class to extend for interacting with the database through a repository pattern.
 * Add new standard database interaction methods here. Abstract away complex & nonstandard ones
 * @export
 * @class SearchableDataService
 * @template E - Model extends MsBaseEntity
 * @template R - repository extends MongoRepository<Model>
 */
@Injectable()
export abstract class FilterableDataService<
  E extends DataProviderBaseEntity<E>,
  R extends MongoRepository<E>
> extends DataService<E, R> {
  protected constructor(
    public override repository: R,
    protected override readonly logger: PinoLogger
  ) {
    super(repository, logger);
  }

  // TODO: Support weights and upgrade MongoDB, for now we're just going to remove description as we can't weight the results...
  // private _collectionIndexName = 'title_text_description_text';
  protected _collectionIndexName = 'title_text';

  protected get collectionIndexName() {
    return this._collectionIndexName;
  }

  protected set collectionIndexName(name) {
    this._collectionIndexName = name;
  }

  // We can't use the TypeORM driver for this, as it doesn't support weights, use the official Node.js driver instead
  // TODO: Support weights and upgrade MongoDB, for now we're just going to remove description as we can't weight the results...
  /* private createCollectionIndex() {
    const db = this.repository.manager.queryRunner.databaseConnection.db('mediashare')
    const collection = db.collection('playlists');
    const await collection.createIndex();
  } */

  // TODO: Finish this later... options could be Elastic, Mongo Atlas Search or Apache Lucene
  get useDistributedSearch() {
    return false; // this.configService.get<string>('dbIsMongoAtlas');
  }

  async getById(id) {
    const pipeline = [
      { $match: { _id: ObjectIdGuard(id) } },
      ...this.buildFields(),
      this.replaceRoot(),
    ];
    // const result = await this.repository.aggregate(pipeline).toArray()
    return this.repository.aggregate(pipeline).next();
  }

  getByUserId(userId: IdType) {
    try {
      const pipeline = [
        { $match: { createdBy: ObjectIdGuard(userId) } },
        ...this.buildFields(),
        this.replaceRoot(),
      ];
      return this.repository.aggregate(pipeline).toArray();
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  getBySub(userId: IdType) {
    try {
      const pipeline = [
        { $match: { createdBy: StringIdGuard(userId) } },
        ...this.buildFields(),
        this.replaceRoot(),
      ];
      return this.repository.aggregate(pipeline).toArray();
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  getPopular() {
    const pipeline = [
      ...this.buildAggregateQuery({}),
      ...this.buildFields(),
      { $sort: { likesCount: -1 } },
      this.replaceRoot(),
    ];
    return this.repository.aggregate(pipeline).toArray();
  }

  search(params: SearchParameters) {
    try {
      let pipeline = [...this.buildAggregateQuery(params)];
      const hasTextQuery = pipeline.find((stage) => !!stage?.$match?.$text);
      if (hasTextQuery) {
        pipeline = pipeline.concat(this.buildTextScore());
      }
      pipeline = pipeline.concat([...this.buildFields(), this.replaceRoot()]);
      return this.repository.aggregate(pipeline).toArray();
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  protected buildTextScore() {
    return [
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: { $meta: 'textScore' } } },
    ];
  }

  protected abstract buildAggregateQuery(params: SearchParameters): any[];

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  protected abstract buildFields(): any[];

  protected abstract replaceRoot(): object;
}
