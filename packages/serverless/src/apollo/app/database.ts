import {
  TDatabaseChangeOwnerRequest,
  TDatabaseCreateRequest,
  TDatabaseRequest,
  TDatabaseSearchRequest,
  TDatabaseUpdateDeployedRequest,
  databaseName,
  pagination,
  userName,
} from '@zkdb/common';
import {
  DB,
  ModelDatabase,
  ModelSystemDatabase,
  withTransaction,
} from '@zkdb/storage';
import GraphQLJSON from 'graphql-type-json';
import Joi from 'joi';
import {
  changeDatabaseOwner,
  createDatabase,
  getListDatabaseDetail,
  updateDeployedDatabase,
} from '../../domain/use-case/database.js';
import { gql } from '../../helper/common.js';
import publicWrapper, { authorizeWrapper } from '../validation.js';

const DatabaseCreateRequest = Joi.object<TDatabaseCreateRequest>({
  databaseName,
  merkleHeight: Joi.number().integer().positive().min(8).max(256).required(),
});

const DatabaseUpdateDeployedRequest =
  Joi.object<TDatabaseUpdateDeployedRequest>({
    databaseName,
    appPublicKey: Joi.string()
      .trim()
      .length(55)
      .required()
      .pattern(/^[A-HJ-NP-Za-km-z1-9]{55}$/),
  });

const DatabaseChangeOwnerRequest = Joi.object<TDatabaseChangeOwnerRequest>({
  databaseName,
  newOwner: userName,
});

export const typeDefsDatabase = gql`
  #graphql
  scalar JSON
  type Query
  type Mutation

  type DbSetting {
    merkleHeight: Int!
    publicKey: String
    databaseOwner: String!
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  type Collection {
    name: String!
  }

  type DbDeploy {
    databaseName: String!
    merkleHeight: Int!
    appPublicKey: String!
    tx: String!
  }

  type DbDescription {
    databaseName: String!
    databaseSize: String!
    databaseOwner: String!
    appPublicKey: String
    merkleHeight: Int!
    deployStatus: TransactionStatus
    collections: [CollectionDescriptionOutput]!
  }

  type DatabasePaginationOutput {
    data: [DbDescription]!
    totalSize: Int!
    offset: Int!
  }

  extend type Query {
    dbList(query: JSON, pagination: PaginationInput): DatabasePaginationOutput!
    dbStats(databaseName: String!): JSON
    dbSetting(databaseName: String!): DbSetting!
    dbExist(databaseName: String!): Boolean!
    #dbFindIndex(databaseName: String!, index: Int!): JSON
  }

  extend type Mutation {
    dbCreate(databaseName: String!, merkleHeight: Int!): Boolean
    dbChangeOwner(databaseName: String!, newOwner: String!): Boolean
    dbDeployedUpdate(databaseName: String!, appPublicKey: String!): Boolean
    #dbDrop(databaseName: String!): Boolean
  }
`;

export const merkleHeight = Joi.number().integer().positive().required();

const databaseSearch = Joi.object({
  query: Joi.object().optional(),
  pagination,
});

// Query
const dbStats = publicWrapper(
  Joi.object({
    databaseName,
  }),
  async (_root: unknown, args: TDatabaseRequest, _ctx) =>
    // Using system database to get stats
    ModelSystemDatabase.getInstance(args.databaseName).stats()
);

const dbList = authorizeWrapper(
  databaseSearch,
  async (_root: unknown, args: TDatabaseSearchRequest, _ctx) =>
    getListDatabaseDetail(_ctx.userName, args.query, args.pagination)
);

const dbSetting = publicWrapper(
  Joi.object({
    databaseName,
  }),
  async (_root: unknown, args: TDatabaseRequest, _ctx) => {
    const { databases } = await DB.service.client.db().admin().listDatabases();

    const isDatabaseExist = databases.some(
      (db) => db.name === args.databaseName
    );

    if (!isDatabaseExist) {
      throw Error(`Database ${args.databaseName} does not exist`);
    }

    const database = await ModelDatabase.getInstance().getDatabase(
      args.databaseName
    );

    if (database) {
      return database;
    }

    throw new Error(`Settings for ${args.databaseName} does not exist`);
  }
);

const dbDeployedUpdate = authorizeWrapper(
  DatabaseUpdateDeployedRequest,
  async (_root: unknown, args: TDatabaseUpdateDeployedRequest, _) =>
    updateDeployedDatabase(args.databaseName, args.appPublicKey)
);

const dbCreate = authorizeWrapper(
  DatabaseCreateRequest,
  async (_root: unknown, args: TDatabaseCreateRequest, ctx) =>
    withTransaction((session) =>
      createDatabase(
        args.databaseName,
        args.merkleHeight,
        ctx.userName,
        session
      )
    )
);

const dbChangeOwner = authorizeWrapper(
  DatabaseChangeOwnerRequest,
  async (_root: unknown, args: TDatabaseChangeOwnerRequest, ctx) =>
    changeDatabaseOwner(args.databaseName, ctx.userName, args.newOwner)
);

const dbExist = publicWrapper(
  Joi.object({
    databaseName,
  }),
  async (_root: unknown, args: TDatabaseRequest, _ctx) => {
    const { databases } = await DB.service.client.db().admin().listDatabases();
    return databases.some((db) => db.name === args.databaseName);
  }
);

type TDatabaseResolver = {
  JSON: typeof GraphQLJSON;
  Query: {
    dbStats: typeof dbStats;
    dbList: typeof dbList;
    dbSetting: typeof dbSetting;
    dbExist: typeof dbExist;
  };
  Mutation: {
    dbCreate: typeof dbCreate;
    dbChangeOwner: typeof dbChangeOwner;
    dbDeployedUpdate: typeof dbDeployedUpdate;
  };
};

export const resolversDatabase: TDatabaseResolver = {
  JSON: GraphQLJSON,
  Query: {
    dbStats,
    dbList,
    dbSetting,
    dbExist,
  },
  Mutation: {
    dbCreate,
    dbChangeOwner,
    dbDeployedUpdate,
  },
};
