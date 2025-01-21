import { gql } from '@helper';
import {
  databaseName,
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
  zkDatabaseConstant,
} from '@zkdb/storage';
import Joi from 'joi';
import { publicWrapper } from '../validation.js';

export const typeDefsProof = gql`
  #graphql
  type Query

  # TZkDatabaseProof in TS
  type ZkProof {
    publicInput: [String!]!
    publicOutput: [String!]!
    maxProofsVerified: Int!
    proof: String!
  }

  extend type Query {
    zkProofStatus(databaseName: String!): QueueTaskStatus

    proof(databaseName: String!): ZkProof
  }
`;

const proof = publicWrapper<TZkProofRequest, TZkProofResponse>(
  Joi.object({
    databaseName,
  }),
  async (_root, { databaseName }) => {
    const imProof = ModelRollupOffChain.getInstance();
    return imProof.findOne({ databaseName }, { sort: { createdAt: -1 } });
  }
);

const zkProofStatus = publicWrapper<
  TZkProofStatusRequest,
  TZkProofStatusResponse
>(
  Joi.object({
    databaseName,
  }),
  async (_root, { databaseName }) => {
    return Transaction.mina(async (proofSession) => {
      const imRollupQueue = await ModelGenericQueue.getInstance(
        EQueueType.RollupOffChainQueue,
        proofSession
      );
      // Get latest task rollup task queue
      const task = await imRollupQueue.findOne(
        {
          databaseName,
        },
        { sort: { createdAt: -1 } }
      );

      if (!task) {
        return null;
      }

      return task.status;
    });
  }
);

export const resolversProof = {
  Query: {
    proof,
    zkProofStatus,
  },
};
