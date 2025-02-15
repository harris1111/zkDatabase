import { gql } from '@helper';
import {
  databaseName,
  EQueueTaskStatus,
  TZkProofRequest,
  TZkProofResponse,
  TZkProofStatusRequest,
  TZkProofStatusResponse,
} from '@zkdb/common';
import {
  EQueueType,
  ModelGenericQueue,
  ModelRollupOffChain,
  Transaction,
} from '@zkdb/storage';
import Joi from 'joi';
import { GraphQLScalarType } from 'graphql';
import { ScalarType } from '@orochi-network/utilities';
import { publicWrapper } from '../validation.js';

export const typeDefsProof = gql`
  #graphql
  type Query
  scalar BigInt
  # TZkDatabaseProof in TS
  type JsonProof {
    publicInput: [String!]!
    publicOutput: [String!]!
    maxProofsVerified: Int!
    proof: String!
  }

  type ZkProof {
    step: BigInt!
    proof: JsonProof!
  }

  extend type Query {
    zkProofStatus(databaseName: String!): QueueTaskStatus

    zkProof(databaseName: String!): ZkProof
  }
`;

const zkProof = publicWrapper<TZkProofRequest, TZkProofResponse>(
  Joi.object({
    databaseName,
  }),
  async (_root, { databaseName }) =>
    ModelRollupOffChain.getInstance().findOne(
      { databaseName },
      { sort: { createdAt: -1 } }
    )
);

const zkProofStatus = publicWrapper<
  TZkProofStatusRequest,
  TZkProofStatusResponse
>(
  Joi.object({
    databaseName,
  }),
  async (_root, { databaseName }) => {
    return Transaction.mina(async (minaSession) => {
      const imRollupQueue = await ModelGenericQueue.getInstance(
        EQueueType.RollupOffChainQueue,
        minaSession
      );
      // Get latest task rollup task queue
      const task = await imRollupQueue.findOne(
        {
          databaseName,
        },
        { sort: { createdAt: -1 } }
      );

      if (!task) {
        return EQueueTaskStatus.Unknown;
      }

      return task.status;
    });
  }
);

const BigIntScalar: GraphQLScalarType<bigint, string> = ScalarType.BigInt();

export const resolversProof = {
  // If we put directly BigInt: ScalarType.BigInt() you will got
  // The inferred type of cannot be named without a reference
  // We need to have a temp variable that hold the function and explicit the type
  BigInt: BigIntScalar,
  Query: {
    zkProof,
    zkProofStatus,
  },
};
