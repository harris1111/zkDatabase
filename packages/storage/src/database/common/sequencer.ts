import { ClientSession, WithoutId } from 'mongodb';
import { ESequencer, TSequencedItem } from '@zkdb/common';
import { zkDatabaseConstant } from '../../common/index.js';
import { DB } from '../../helper/db-instance.js';
import ModelBasic from '../base/basic.js';
import { addTimestampMongoDB, getCurrentTime } from '../../helper/common.js';
import ModelCollection from '../general/collection.js';

export class ModelSequencer extends ModelBasic<WithoutId<TSequencedItem>> {
  public static readonly INITIAL_SEQUENCE_VALUE = 1;
  public static readonly SEQUENCE_INCREMENT = 1;

  private static instances = new Map<string, ModelSequencer>();

  private constructor(databaseName: string) {
    super(
      databaseName,
      DB.service,
      zkDatabaseConstant.databaseCollection.sequencer
    );
  }

  public static getInstance(databaseName: string) {
    const key = databaseName;
    if (!ModelSequencer.instances.has(key)) {
      ModelSequencer.instances.set(key, new ModelSequencer(databaseName));
      ModelSequencer.init(key);
    }
    return ModelSequencer.instances.get(key)!;
  }

  async nextValue(
    sequenceName: ESequencer,
    session?: ClientSession
  ): Promise<number> {
    const index = await this.collection.findOne(
      { type: sequenceName },
      { session }
    );

    if (index) {
      const updateResult = await this.collection.findOneAndUpdate(
        { type: sequenceName },
        {
          $inc: { seq: ModelSequencer.SEQUENCE_INCREMENT },
          $set: { updatedAt: getCurrentTime() },
        },
        { upsert: true, returnDocument: 'after', session }
      );

      if (!updateResult) {
        throw new Error(`Failed to increment sequence '${sequenceName}'`);
      }

      return updateResult.seq;
    } else {
      const creationTime = getCurrentTime();

      const insertResult = await this.collection.insertOne(
        {
          type: sequenceName,
          seq: ModelSequencer.INITIAL_SEQUENCE_VALUE,
          createdAt: creationTime,
          updatedAt: creationTime,
        },
        { session }
      );

      if (!insertResult.insertedId) {
        throw new Error(`Failed to create sequence '${sequenceName}'`);
      }

      return ModelSequencer.INITIAL_SEQUENCE_VALUE;
    }
  }

  public static async init(databaseName: string, session?: ClientSession) {
    const collection = ModelCollection.getInstance(
      databaseName,
      DB.service,
      zkDatabaseConstant.databaseCollection.sequencer
    );
    if (!(await collection.isExist())) {
      await collection.index({ type: 1 }, { unique: true });
      await addTimestampMongoDB(collection, session);
    }
  }
}
