import { Document } from 'mongodb';
import { ModelCollection, ModelGeneral, zkDatabaseConstants } from '@zkdb/storage';
import { ZKDATABASE_USER_SYSTEM } from '../../common/const';
import { getCurrentTime } from '../../helper/common';

export interface GroupSchema extends Document {
  groupName: string;
  description: string;
  createBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ModelGroup extends ModelGeneral<GroupSchema> {
  private static collectionName: string = zkDatabaseConstants.databaseCollections.group;

  constructor(databaseName: string) {
    super(databaseName, ModelGroup.collectionName);
  }

  public async createGroup(
    groupName: string,
    description?: string,
    createBy?: string
  ) {
    return this.insertOne({
      groupName,
      description: description || `Group ${groupName}`,
      createBy: createBy || ZKDATABASE_USER_SYSTEM,
      createdAt: getCurrentTime(),
      updatedAt: getCurrentTime(),
    });
  }

  public static async init(databaseName: string) {
    const collection = ModelCollection.getInstance(
      databaseName,
      ModelGroup.collectionName
    );
    if (!(await collection.isExist())) {
      await collection.index({ grouName: 1 }, { unique: true });
    }
  }
}

export default ModelGroup;
