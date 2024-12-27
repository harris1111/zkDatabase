import { TUserGroupRecord } from '@zkdb/common';
import {
  DATABASE_ENGINE,
  ModelCollection,
  ModelGeneral,
  zkDatabaseConstant,
} from '@zkdb/storage';
import {
  BulkWriteOptions,
  ClientSession,
  FindOptions,
  ObjectId,
  OptionalId,
} from 'mongodb';
import ModelUser from '../global/user';
import ModelGroup from './group';

export class ModelUserGroup extends ModelGeneral<OptionalId<TUserGroupRecord>> {
  private static collectionName =
    zkDatabaseConstant.databaseCollection.userGroup;

  constructor(databaseName: string) {
    super(
      databaseName,
      DATABASE_ENGINE.serverless,
      ModelUserGroup.collectionName
    );
  }

  public async checkMembership(
    userName: string,
    groupName: string
  ): Promise<boolean> {
    const modelGroup = new ModelGroup(this.databaseName);
    const group = await modelGroup.findOne({ groupName });
    if (!group) {
      return false;
    }
    const matchedRecord = await this.count({
      userName,
      groupOjectId: group._id,
    });
    return matchedRecord === 1;
  }

  public async listGroupByUserName(
    userName: string,
    options?: FindOptions
  ): Promise<string[]> {
    const modelGroup = new ModelGroup(this.databaseName);
    const groupsList = await modelGroup.find(
      {
        _id: { $in: await this.listGroupId(userName) },
      },
      options
    );
    return groupsList.map((group) => group.groupName).toArray();
  }

  public async listGroupId(userName: string): Promise<ObjectId[]> {
    const userGroups = await this.find({ userName });
    return userGroups.map((userGroup) => userGroup.groupOjectId).toArray();
  }

  public async groupNameToGroupId(groupName: string[]): Promise<ObjectId[]> {
    const modelGroup = new ModelGroup(this.databaseName);
    const availableGroups = await modelGroup.find({
      groupName: { $in: groupName },
    });
    return availableGroups.map((group) => group._id).toArray();
  }

  public async addUserToGroup(
    userName: string,
    groupName: string[],
    options?: BulkWriteOptions
  ) {
    const groupOfUser = await this.listGroupId(userName);
    const groupIdToAdd = await this.groupNameToGroupId(groupName);
    const newGroupIdToAdd = groupIdToAdd.filter(
      (g) => !groupOfUser.includes(g)
    );

    const operations = newGroupIdToAdd.map((groupOjectId) => ({
      updateOne: {
        filter: { userName, groupOjectId },
        update: {
          $set: { updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    return this.collection.bulkWrite(operations, options);
  }

  public async addUserListToGroup(
    listUserName: string[],
    groupName: string,
    options?: BulkWriteOptions
  ) {
    const groupOjectId = (await this.groupNameToGroupId([groupName]))[0];
    const imUser = new ModelUser();

    const listUser = await imUser
      .find({
        userName: { $in: listUserName },
      })
      .toArray();

    const listOperation = listUser.map(({ userName, _id }) => {
      return {
        updateOne: {
          filter: { userName, groupOjectId },
          update: {
            $set: {
              groupName,
              updatedAt: new Date(),
              createdAt: new Date(),
              userObjectId: _id,
            },
          },
          upsert: true,
        },
      };
    });

    return this.collection.bulkWrite(listOperation, options);
  }

  public async removeUserListFromGroup(
    listUserName: string[],
    groupName: string,
    options?: BulkWriteOptions
  ) {
    const groupOjectId = (await this.groupNameToGroupId([groupName]))[0];

    const listOperation = listUserName.map((userName) => ({
      deleteOne: {
        filter: { userName, groupOjectId },
      },
    }));

    return this.collection.bulkWrite(listOperation, options);
  }

  public static async init(databaseName: string, session?: ClientSession) {
    const collection = ModelCollection.getInstance(
      databaseName,
      DATABASE_ENGINE.serverless,
      ModelUserGroup.collectionName
    );

    /*
      userName: string;
      groupName: string;
      groupOjectId: ObjectId
      userObjectId: ObjectId
      createdAt: Date
      updatedAt: Date
    */
    if (!(await collection.isExist())) {
      await collection.createSystemIndex({ userName: 1 }, { session });
      await collection.createSystemIndex({ groupName: 1 }, { session });
      await collection.createSystemIndex({ groupOjectId: 1 }, { session });
      await collection.createSystemIndex({ userObjectId: 1 }, { session });

      await collection.addTimestampMongoDb({ session });
    }
  }
}

export default ModelUserGroup;
