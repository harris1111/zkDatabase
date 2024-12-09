import { ModelProof, ModelQueueTask, withTransaction } from '@zkdb/storage';
import GraphQLJSON from 'graphql-type-json';
import Joi from 'joi';
import { hasDocumentPermission } from '../../domain/use-case/permission.js';
import { authorizeWrapper, publicWrapper } from '../validation.js';
import {
  EDatabaseProofStatus,
  TDocumentProofRequest,
  collectionName,
  databaseName,
  objectId,
} from '@zkdb/common';

/* eslint-disable import/prefer-default-export */
export const typeDefsProof = `#graphql
scalar JSON
type Query

type Proof {
  publicInput: [String!]!
  publicOutput: [String!]!
  maxProofsVerified: Int!
  proof: String!
}

enum ProofStatus {
  QUEUED
  PROVING
  PROVED
  FAILED
}

enum DatabaseProofStatus {
  EMPTY
  PENDING
  PROVED
}

extend type Query {
  getProofStatus(databaseName: String!, collectionName: String!, docId: String): ProofStatus!
  getDatabaseProofStatus(databaseName: String!): DatabaseProofStatus!
  getProof(databaseName: String!): Proof
}
`;

const getProofStatus = authorizeWrapper(
  Joi.object({
    databaseName,
    collectionName,
    docId: objectId.optional(),
  }),
  async (_root: unknown, args: TDocumentProofRequest, ctx) => {
    return withTransaction(async (session) => {
      const modelProof = ModelQueueTask.getInstance();

      if (
        await hasDocumentPermission(
          args.databaseName,
          args.collectionName,
          ctx.userName,
          args.docId,
          'read',
          session
        )
      ) {
        const proof = await modelProof.findOne({
          database: args.databaseName,
          docId: args.docId,
        });

        if (proof) {
          switch (proof.status) {
            case 'queued':
              return 'QUEUED';
            case 'proving':
              return 'PROVING';
            case 'proved':
              return 'PROVED';
            case 'failed':
              return 'FAILED';
            default:
              throw new Error(`Unknown proof status: ${proof.status}`);
          }
        }
        throw Error('Proof has not been found');
      }

      throw new Error(
        `Access denied: Actor '${ctx.userName}' does not have 'read' permission for the specified document.`
      );
    });
  }
);

const getProof = publicWrapper(
  Joi.object({
    databaseName,
  }),
  async (_root: unknown, args: TDocumentProofRequest) => {
    const modelProof = ModelProof.getInstance();

    return modelProof.getProof(args.databaseName);
  }
);

const getDatabaseProofStatus = publicWrapper(
  Joi.object({
    databaseName,
  }),
  async (_root: unknown, args: TDocumentProofRequest) => {
    const modelTask = ModelQueueTask.getInstance();

    const task = await modelTask.findOne({
      database: args.databaseName,
      status: { $in: ['proving', 'queued'] },
    });

    if (task) {
      return EDatabaseProofStatus.Proving;
    } else {
      const modelProof = ModelProof.getInstance();
      const proof = await modelProof.getProof(args.databaseName);

      return proof ? EDatabaseProofStatus.Proved : EDatabaseProofStatus.None;
    }
  }
);

type TProofResolver = {
  JSON: typeof GraphQLJSON;
  Query: {
    getProofStatus: typeof getProofStatus;
    getProof: typeof getProof;
    getDatabaseProofStatus: typeof getDatabaseProofStatus;
  };
};

export const resolversProof: TProofResolver = {
  JSON: GraphQLJSON,
  Query: {
    getProofStatus,
    getProof,
    getDatabaseProofStatus,
  },
};
