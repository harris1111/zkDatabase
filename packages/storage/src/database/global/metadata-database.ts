import { TMetadataDatabase, TMetadataDatabaseRecord } from '@zkdb/common';
import {
  ClientSession,
  Filter,
  FindOptions,
  InsertOneOptions,
  InsertOneResult,
  UpdateOptions,
  UpdateResult,
  WithoutId,
} from 'mongodb';
import { zkDatabaseConstant } from '../../common/const.js';
import { DB } from '../../helper/db-instance.js';
import ModelBasic from '../base/basic.js';
import ModelCollection from '../general/collection.js';
import { addTimestampMongoDB } from '../../helper/common.js';

const SYSTEM_DATABASE_SET = new Set(['admin', 'local', '_zkdatabase_metadata']);

export class ModelMetadataDatabase extends ModelBasic<
  WithoutId<TMetadataDatabaseRecord>
> {
  private static instance: ModelMetadataDatabase;

  private constructor() {
    super(
      zkDatabaseConstant.globalDatabase,
      DB.service,
      zkDatabaseConstant.globalCollection.metadata_database
    );
  }

  public static getInstance() {
    if (!ModelMetadataDatabase.instance) {
      this.instance = new ModelMetadataDatabase();
    }
    return this.instance;
  }

  public async createMetadataDatabase(
    database: WithoutId<TMetadataDatabaseRecord>,
    options?: InsertOneOptions
  ): Promise<InsertOneResult<TMetadataDatabaseRecord>> {
    try {
      const result = await this.collection.insertOne(database, options);
      return result;
    } catch (error) {
      throw new Error(`Failed to create database: ${error}`);
    }
  }

  public async updateDatabase(
    databaseName: string,
    updateField: Partial<TMetadataDatabaseRecord>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    // Runtime validation ensure no empty update
    if (Object.keys(updateField).length === 0) {
      throw new Error('No field provided for update');
    }
    try {
      const result = await this.collection.updateOne(
        { databaseName: databaseName },
        { $set: updateField },
        options
      );
      return result;
    } catch (error) {
      throw new Error(`Failed to update database name: ${error}`);
    }
  }

  public async getDatabase(
    databaseName: string,
    options?: FindOptions
  ): Promise<TMetadataDatabase | null> {
    try {
      const database = await this.collection.findOne({ databaseName }, options);
      return database;
    } catch (error) {
      throw new Error(`Failed to get database: ${error}`);
    }
  }

  public async getListDatabase(
    filter: Filter<TMetadataDatabase>,
    options?: FindOptions
  ): Promise<TMetadataDatabase[]> {
    try {
      // Prevent user getting system database
      return (await this.collection.find(filter, options).toArray()).filter(
        (db) => !SYSTEM_DATABASE_SET.has(db.databaseName)
      );
    } catch (error) {
      throw new Error(`Failed to find database: ${error}`);
    }
  }

  public async count(filter?: Filter<TMetadataDatabase>) {
    return await this.collection.countDocuments(filter);
  }

  public static async init(session?: ClientSession) {
    const collection = ModelCollection.getInstance<TMetadataDatabase>(
      zkDatabaseConstant.globalProofDatabase,
      DB.proof,
      zkDatabaseConstant.globalCollection.proof
    );
    if (!(await collection.isExist())) {
      /*
        databaseName: string;
        databaseOwner: string;
        merkleHeight: number;
        appPublicKey: string;
      */
      collection.index({ databaseName: 1 }, { unique: true, session });
      collection.index({ databaseOwner: 1 }, { unique: false, session });
      collection.index({ merkleHeight: 1 }, { unique: false, session });
      collection.index({ appPublicKey: 1 }, { unique: false, session });

      addTimestampMongoDB(collection, session);
    }
  }
}
