import {
  databaseName,
  groupDescription,
  groupName,
  publicKey,
  TGroupAddUserListRequest,
  TGroupAddUserListResponse,
  TGroupCreateRequest,
  TGroupCreateResponse,
  TGroupDetailRequest,
  TGroupDetailResponse,
  TGroupListAllRequest,
  TGroupListAllResponse,
  TGroupListByUserRequest,
  TGroupListByUserResponse,
  TGroupRemoveUserListRequest,
  TGroupRemoveUserListResponse,
  TGroupUpdateRequest,
  TGroupUpdateResponse,
  userName,
} from '@zkdb/common';
import Joi from 'joi';
import { Group } from '@domain';
import { gql } from '@helper';
import { ModelGroup, ModelUserGroup } from '@model';
import { Transaction } from '@zkdb/storage';
import { authorizeWrapper, publicWrapper } from '../validation';

export const typeDefsGroup = gql`
  #graphql
  type Query
  type Mutation

  type GroupUserInfo {
    userName: String!
    updatedAt: String!
    createdAt: String!
  }

  type GroupInfoDetailResponse {
    groupName: String!
    groupDescription: String!
    createdBy: String!
    updatedAt: String!
    createdAt: String!
    listUser: [GroupUserInfo]!
  }

  type GroupListAllResponse {
    groupName: String!
    groupDescription: String!
    createdBy: String!
    updatedAt: String!
    createdAt: String!
  }

  input GroupListByUserRequest {
    userName: String
    email: String
    publicKey: String
  }

  extend type Query {
    groupListAll(databaseName: String!): [GroupListAllResponse]!

    groupListByUser(
      databaseName: String!
      userQuery: GroupListByUserRequest!
    ): [String]

    groupDetail(
      databaseName: String!
      groupName: String!
    ): GroupInfoDetailResponse
  }

  extend type Mutation {
    groupCreate(
      databaseName: String!
      groupName: String!
      groupDescription: String
    ): Boolean

    groupAddUser(
      databaseName: String!
      groupName: String!
      listUser: [String!]!
    ): Boolean

    groupRemoveUser(
      databaseName: String!
      groupName: String!
      listUser: [String!]!
    ): Boolean

    groupUpdate(
      databaseName: String!
      groupName: String!
      newGroupName: String
      newGroupDescription: String
    ): Boolean
  }
`;
// Joi validation

export const JOI_GROUP_CREATE = Joi.object<TGroupCreateRequest>({
  databaseName,
  groupName,
  groupDescription: groupDescription(false),
});

export const JOI_GROUP_UPDATE = Joi.object<TGroupUpdateRequest>({
  databaseName,
  groupName,
  newGroupName: groupName(false),
  newGroupDescription: groupDescription(false),
});

export const JOI_GROUP_DETAIL = Joi.object<TGroupDetailRequest>({
  databaseName,
  groupName,
});

export const JOI_GROUP_LIST_USER = Joi.object<TGroupListByUserRequest>({
  databaseName,
  userQuery: Joi.object({
    userName: userName(false),
    email: Joi.string().email().optional(),
    publicKey: publicKey(false),
  }),
});

export const JOI_GROUP_LIST_ALL = Joi.object<TGroupListAllRequest>({
  databaseName,
});

export const JOI_GROUP_ADD_USER = Joi.object<TGroupAddUserListRequest>({
  databaseName,
  groupName,
  listUser: Joi.array().items(Joi.string().required()).required(),
});

export const JOI_GROUP_REMOVE_USER = Joi.object<TGroupRemoveUserListRequest>({
  databaseName,
  groupName,
  listUser: Joi.array().items(Joi.string().required()).required(),
});

// Query
const groupListAll = publicWrapper<TGroupListAllRequest, TGroupListAllResponse>(
  JOI_GROUP_LIST_ALL,
  async (_root, { databaseName }) => {
    const groupList = await new ModelGroup(databaseName).find({}).toArray();
    return groupList;
  }
);

const groupListByUser = publicWrapper<
  TGroupListByUserRequest,
  TGroupListByUserResponse
>(JOI_GROUP_LIST_USER, async (_root, { databaseName, userQuery }) =>
  (await new ModelUserGroup(databaseName).listGroupByUserQuery(userQuery)).map(
    ({ groupName }) => groupName
  )
);

const groupDetail = publicWrapper<TGroupDetailRequest, TGroupDetailResponse>(
  JOI_GROUP_DETAIL,
  async (_root, { databaseName, groupName }) =>
    Group.detail({ databaseName, groupName })
);

const groupUpdate = authorizeWrapper<TGroupUpdateRequest, TGroupUpdateResponse>(
  JOI_GROUP_UPDATE,
  async (_root, args, ctx) => {
    const { databaseName, groupName, newGroupName, newGroupDescription } = args;
    const result = await Transaction.serverless(async (session) =>
      Group.updateMetadata(
        {
          databaseName,
          groupName,
          newGroupName,
          newGroupDescription,
          createdBy: ctx.userName,
        },
        session
      )
    );

    return result !== null && result;
  }
);

const groupCreate = authorizeWrapper<TGroupCreateRequest, TGroupCreateResponse>(
  JOI_GROUP_CREATE,
  async (_root, { databaseName, groupDescription, groupName }, ctx) =>
    Transaction.serverless((session) =>
      Group.create(
        {
          databaseName,
          groupName,
          groupDescription:
            groupDescription ||
            `Group ${groupName} from ${databaseName}, owned by ${ctx.userName}`,
          createdBy: ctx.userName,
        },
        session
      )
    )
);

const groupAddUser = authorizeWrapper<
  TGroupAddUserListRequest,
  TGroupAddUserListResponse
>(
  JOI_GROUP_ADD_USER,
  async (_root, { databaseName, groupName, listUser }, ctx) =>
    Group.addListUser({
      databaseName,
      groupName,
      listUserName: listUser,
      createdBy: ctx.userName,
    })
);

const groupRemoveUser = authorizeWrapper<
  TGroupRemoveUserListRequest,
  TGroupRemoveUserListResponse
>(
  JOI_GROUP_REMOVE_USER,
  async (_root: unknown, { databaseName, groupName, listUser }, ctx) =>
    Group.removeListUser({
      databaseName,
      groupName,
      listUserName: listUser,
      createdBy: ctx.userName,
    })
);

export const resolversGroup = {
  Query: {
    groupListAll,
    groupListByUser,
    groupDetail,
  },
  Mutation: {
    groupCreate,
    groupAddUser,
    groupRemoveUser,
    groupUpdate,
  },
};
