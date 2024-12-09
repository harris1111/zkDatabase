import {
  collectionName,
  databaseName,
  indexName,
  IndexSchema,
  TCollectionRequest,
  TIndexCreateRequest,
  TIndexDropRequest,
  TIndexExistRequest,
  TIndexListRequest,
  TIndexListResponse,
} from '@zkdb/common';
import GraphQLJSON from 'graphql-type-json';
import Joi from 'joi';
import {
  createIndex,
  doesIndexExist,
  dropIndex,
  listIndexesInfo as listIndexesInfoDomain,
} from '../../domain/use-case/collection.js';
import { convertIndexSpecification, gql } from '../../helper/common.js';
import { authorizeWrapper } from '../validation.js';
import { CollectionRequest } from './collection.js';

export const IndexDetailRequest = Joi.object<
  TIndexCreateRequest & TCollectionRequest
>({
  collectionName,
  databaseName,
  indexName,
});

export const IndexCreateRequest = Joi.object<
  TIndexCreateRequest & TCollectionRequest
>({
  collectionName,
  databaseName,
  index: IndexSchema,
});

export const typeDefsCollectionIndex = gql`
  scalar JSON
  scalar Date
  type Query
  type Mutation

  type CollectionIndex {
    name: String!
    size: Int!
    access: Int!
    since: Date!
    property: String!
  }

  extend type Query {
    indexList(
      databaseName: String!
      collectionName: String!
    ): [CollectionIndex]!
    indexExist(
      databaseName: String!
      collectionName: String!
      indexName: String!
    ): Boolean
  }

  extend type Mutation {
    indexCreate(
      databaseName: String!
      collectionName: String!
      index: JSON!
    ): Boolean
    indexDrop(
      databaseName: String!
      collectionName: String!
      indexName: String!
    ): Boolean
  }
`;

// Query
const indexList = authorizeWrapper<TIndexListRequest, TIndexListResponse>(
  CollectionRequest,
  async (_root, args, ctx) =>
    listIndexesInfoDomain(args.databaseName, ctx.userName, args.collectionName)
);

const indexExist = authorizeWrapper<TIndexExistRequest, boolean>(
  IndexDetailRequest,
  async (_root, args, ctx) =>
    doesIndexExist(
      args.databaseName,
      ctx.userName,
      args.collectionName,
      args.indexName
    )
);

// Mutation
const indexCreate = authorizeWrapper<TIndexCreateRequest, boolean>(
  IndexCreateRequest,
  async (_root, args, ctx) =>
    createIndex(
      args.databaseName,
      ctx.userName,
      args.collectionName,
      convertIndexSpecification(args.index)
    )
);

const indexDrop = authorizeWrapper<TIndexDropRequest, boolean>(
  IndexDetailRequest,
  async (_root, args, ctx) =>
    dropIndex(
      args.databaseName,
      ctx.userName,
      args.collectionName,
      args.indexName
    )
);

type TCollectionIndexResolvers = {
  JSON: typeof GraphQLJSON;
  Query: {
    indexList: typeof indexList;
    indexExist: typeof indexExist;
  };
  Mutation: {
    indexCreate: typeof indexCreate;
    indexDrop: typeof indexDrop;
  };
};

export const resolversCollectionIndex: TCollectionIndexResolvers = {
  JSON: GraphQLJSON,
  Query: {
    indexList,
    indexExist,
  },
  Mutation: {
    indexCreate,
    indexDrop,
  },
};
