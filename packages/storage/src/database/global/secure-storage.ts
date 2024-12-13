import { TSecureStorageRecord } from '@zkdb/common';
import { ClientSession, WithoutId } from 'mongodb';
import { zkDatabaseConstant } from '../../common/index.js';
import { DATABASE_ENGINE } from '../../helper/db-instance.js';
import ModelGeneral from '../base/general.js';
import ModelCollection from '../general/collection.js';
import { addTimestampMongoDB } from '../../helper/common.js';

export class ModelSecureStorage extends ModelGeneral<
  WithoutId<TSecureStorageRecord>
> {
  private static instance: ModelSecureStorage | null = null;

  private constructor() {
    super(
      zkDatabaseConstant.globalProofDatabase,
      DATABASE_ENGINE.proofService,
      zkDatabaseConstant.globalCollection.secure
    );
  }

  public static getInstance(): ModelSecureStorage {
    if (!ModelSecureStorage.instance) {
      ModelSecureStorage.instance = new ModelSecureStorage();
      ModelSecureStorage.instance.collection.createIndex({ databaseName: 1 });
    }
    return ModelSecureStorage.instance;
  }

  public static async init(session?: ClientSession) {
    const collection = ModelCollection.getInstance(
      zkDatabaseConstant.globalProofDatabase,
      DATABASE_ENGINE.proofService,
      zkDatabaseConstant.globalCollection.queue
    );
    /*
      privateKey: string;
      databaseName: string;
    */
    if (!(await collection.isExist())) {
      await collection.index({ databaseName: 1 }, { unique: true, session });
      await collection.index({ privateKey: 1 }, { unique: true, session });

      await addTimestampMongoDB(collection, session);
    }
  }
}
