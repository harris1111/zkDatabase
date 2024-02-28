import Joi from 'joi';
import GraphQLJSON from 'graphql-type-json';
import resolverWrapper from '../validation';
import { TCollectionRequest } from './collection';
import {
  DocumentPermission,
  DocumentRecord,
  ModelDocument,
} from '../../model/abstract/document';
import {
  collectionName,
  databaseName,
  permissionDetail,
  permissionRecord,
} from './common';
import { Filter } from 'mongodb';

export type TDocumentFindRequest = TCollectionRequest & {
  documentQuery: { [key: string]: string };
};

export type TDocumentCreateRequest = TCollectionRequest & {
  documentRecord: { [key: string]: any };
  documentPermission: DocumentPermission;
};

export type TDocumentUpdateRequest = TCollectionRequest &
  Filter<DocumentRecord>;

export const DOCUMENT_FIND_REQUEST = Joi.object<TDocumentFindRequest>({
  databaseName,
  collectionName,
  documentQuery: Joi.object(),
});

export const DOCUMENT_CREATE_REQUEST = Joi.object<TDocumentCreateRequest>({
  databaseName,
  collectionName,
  documentPermission: permissionDetail.required(),
  documentRecord: Joi.object().required(),
});

export const DOCUMENT_UPDATE_REQUEST = Joi.object<TDocumentUpdateRequest>({
  databaseName,
  collectionName,
  documentQuery: Joi.object(),
  documentRecord: Joi.object(),
});

export const typeDefsDocument = `#graphql
scalar JSON
type Query
type Mutation

input PermissionRecordInput {
  system: Boolean
  create: Boolean
  read: Boolean
  write: Boolean
  delete: Boolean
}

input PermissionDetailInput {
  permissionOwner: PermissionRecordInput
  permissionGroup: PermissionRecordInput
  permissionOthers: PermissionRecordInput
}

extend type Query {
  documentFind(databaseName: String!, collectionName: String!, documentQuery: JSON!): JSON
}

extend type Mutation {
  documentCreate(databaseName: String!, collectionName: String!, documentRecord: JSON!, documentPermission: PermissionDetailInput): JSON
  documentUpdate(databaseName: String!, collectionName: String!, documentQuery: JSON!, documentRecord: JSON!): Boolean
  documentDrop(databaseName: String!, collectionName: String!, documentQuery: JSON!): JSON
}
`;

// Query
const documentFind = resolverWrapper(
  DOCUMENT_FIND_REQUEST,
  async (_root: unknown, args: TDocumentFindRequest) => {
    return (
      await ModelDocument.getInstance(args.databaseName, args.collectionName)
    ).find(args.documentQuery);
  }
);

// Mutation
const documentCreate = resolverWrapper(
  DOCUMENT_CREATE_REQUEST,
  async (_root: unknown, args: TDocumentCreateRequest) => {
    return (
      await ModelDocument.getInstance(args.databaseName, args.collectionName)
    ).insertOne(args.documentRecord, args.documentPermission);
  }
);

const documentUpdate = resolverWrapper(
  DOCUMENT_UPDATE_REQUEST,
  async (_root: unknown, args: TDocumentUpdateRequest) => {
    const keys = Object.keys(args.documentRecord);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const { error } = permissionRecord.validate(args.documentRecord[key]);
      if (error)
        throw new Error(
          `PermissionRecord ${key} is not valid ${error.message}`
        );
    }
    return (
      await ModelDocument.getInstance(args.databaseName, args.collectionName)
    ).updateOne(args.documentQuery, args.documentRecord);
  }
);

const documentDrop = resolverWrapper(
  DOCUMENT_FIND_REQUEST,
  async (_root: unknown, args: TDocumentFindRequest) => {
    return (
      await ModelDocument.getInstance(args.databaseName, args.collectionName)
    ).drop(args.documentQuery);
  }
);

export const resolversDocument = {
  JSON: GraphQLJSON,
  Query: {
    documentFind,
  },
  Mutation: {
    documentCreate,
    documentUpdate,
    documentDrop,
  },
};
