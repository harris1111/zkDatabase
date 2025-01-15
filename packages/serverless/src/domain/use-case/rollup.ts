import { logger } from '@helper';
import {
  EMinaTransactionStatus,
  ERollupState,
  ETransactionStatus,
  ETransactionType,
  TRollUpOffChainAndTransitionAggregate,
  TRollupHistoryOnChainResponse,
  TRollupOffChainHistory,
  TRollupOffChainHistoryParam,
  TRollupOffChainHistoryResponse,
  TRollupOffChainQueueTransitionAggregate,
  TRollupOnChainHistoryParam,
  TRollupOnChainStateResponse,
  TRollupQueueData,
  databaseName,
} from '@zkdb/common';
import {
  ModelGenericQueue,
  ModelMetadataDatabase,
  ModelRollupOffChain,
  ModelRollupOnChainHistory,
  ModelTransaction,
  TCompoundSession,
  zkDatabaseConstant,
} from '@zkdb/storage';
import { ClientSession } from 'mongodb';
import { PublicKey } from 'o1js';
import { Database } from './database';
import Transaction from './transaction';

export class Rollup {
  static async create(
    databaseName: string,
    actor: string,
    compoundSession: TCompoundSession
  ): Promise<boolean> {
    await Database.ownershipCheck(
      databaseName,
      actor,
      compoundSession.serverless
    );

    const imRollupOffChain = ModelRollupOffChain.getInstance();
    const [latestProofForDb] = await imRollupOffChain.collection
      .aggregate<TRollUpOffChainAndTransitionAggregate>([
        {
          $match: { databaseName },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: 1,
        },
        {
          $lookup: {
            from: zkDatabaseConstant.globalCollection.transaction,
            localField: 'transactionObjectId',
            foreignField: '_id',
            as: 'transaction',
          },
        },
        {
          $unwind: {
            path: '$transaction',
          },
        },
      ])
      .toArray();

    if (!latestProofForDb) {
      throw Error('No proof has been generated yet');
    }

    const imRollupHistory = ModelRollupOnChainHistory.getInstance();
    const imTransaction = ModelTransaction.getInstance();

    const rollUpHistory = await imRollupHistory.findOne(
      {
        proofId: latestProofForDb._id,
      },
      { session: compoundSession.serverless }
    );

    if (rollUpHistory) {
      logger.debug('Identified repeated proof');

      const transaction = await imTransaction.findOne(
        {
          _id: rollUpHistory.transactionObjectId,
        },
        { session: compoundSession.serverless }
      );

      if (transaction) {
        if (transaction.status === ETransactionStatus.Confirmed) {
          throw Error('You cannot roll-up the same proof');
        }

        if (transaction.status === ETransactionStatus.Unsigned) {
          throw Error(
            'You already have uncompleted transaction with the same proof'
          );
        }
      }
    }

    const transactionObjectId = await Transaction.enqueue(
      databaseName,
      actor,
      ETransactionType.Rollup,
      compoundSession.serverless
    );

    const currentTime = new Date();

    await imRollupHistory.insertOne(
      {
        databaseName,
        transactionObjectId,
        merkleRootOnChainNew: latestProofForDb.transition.merkleRootNew,
        merkleRootOnChainOld: latestProofForDb.merkleRootOld,
        rollupOffChainObjectId: latestProofForDb._id,
        createdAt: currentTime,
        updatedAt: currentTime,
        step: latestProofForDb.step,
        error: null,
        status: null,
      },
      { session: compoundSession?.serverless }
    );

    return true;
  }

  static async offChainHistory(
    param: TRollupOffChainHistoryParam,
    session: ClientSession
  ): Promise<TRollupOffChainHistoryResponse> {
    //
    const { query, pagination } = param;

    const imRollupOffChainQueue =
      await ModelGenericQueue.getInstance<TRollupQueueData>(
        zkDatabaseConstant.globalCollection.rollupOffChainQueue,
        session
      );

    // Perform aggregation joining 2 collections from 2 databases
    // `rollup_offchain_queue` from db `_zkdatabase_proof_service`
    // with `${databaseName}` from db `_zkdatabase_transition_log`
    const rollupOffChainQueueTransitionAggregateList =
      await imRollupOffChainQueue.collection
        .aggregate<TRollupOffChainQueueTransitionAggregate>([
          {
            $match: {
              databaseName: query.databaseName,
            },
          },
          {
            $lookup: {
              from: `${zkDatabaseConstant.globalTransitionLogDatabase}.${databaseName}`,
              localField: 'transitionObjectId',
              foreignField: '_id',
              as: 'transition',
            },
          },
          {
            $unwind: {
              path: '$transition',
            },
          },
        ])
        .toArray();

    if (!rollupOffChainQueueTransitionAggregateList.length) {
      return {
        data: [],
        total: 0,
        offset: pagination.offset || 0,
      };
    }

    const rollUpOffChainHistory: TRollupOffChainHistory[] =
      rollupOffChainQueueTransitionAggregateList.map((queue) => ({
        merkleRootNew: queue.data.transition.merkleRootNew,
        merkleRootOld: queue.data.transition.merkleRootOld,
        error: queue.error,
        docId: queue.data.docId,
        status: queue.status,
        databaseName: queue.databaseName,
        step: BigInt(queue.sequenceNumber) + 1n,
      }));

    return {
      data: rollUpOffChainHistory,
      total: rollUpOffChainHistory.length,
      offset: pagination.offset || 0,
    };
  }

  static async onChainHistory(
    param: TRollupOnChainHistoryParam,
    session?: ClientSession
  ): Promise<TRollupHistoryOnChainResponse> {
    const { query, pagination } = param;

    const metadataDatabase = await ModelMetadataDatabase.getInstance().findOne(
      query,
      {
        session,
      }
    );

    if (
      !metadataDatabase?.appPublicKey ||
      PublicKey.fromBase58(metadataDatabase?.appPublicKey).isEmpty().toBoolean()
    ) {
      throw Error('Database is not bound to zk app');
    }

    const imRollupHistory = ModelRollupOnChainHistory.getInstance();

    const rollupHistory = await imRollupHistory
      .find(query)
      .sort({ createdAt: -1, updatedAt: -1 })
      .toArray();

    if (!rollupHistory.length) {
      return {
        data: [],
        total: 0,
        offset: pagination.offset || 0,
      };
    }

    return {
      data: rollupHistory,
      total: await imRollupHistory.count(query),
      offset: pagination.offset || 0,
    };
  }

  static async state(
    databaseName: string
  ): Promise<TRollupOnChainStateResponse> {
    const imRollupOnChainHistory = ModelRollupOnChainHistory.getInstance();
    const imRollupOffChain = ModelRollupOffChain.getInstance();
    // Get latest rollup history
    const rollupOnChainHistory = await imRollupOnChainHistory
      .find({ databaseName }, { sort: { updatedAt: -1, createdAt: -1 } })
      .toArray();

    const latestRollupOffChain = await imRollupOffChain.findOne(
      {
        databaseName,
      },
      { sort: { updatedAt: -1, createdAt: -1 } }
    );

    if (!latestRollupOffChain) {
      return null;
    }

    // Using Array.prototype.at(0) safer than array[0].
    // We can .at(0) and check undefined instead of arr[0] don't give type check when array is undefined
    const latestRollupOnChain = rollupOnChainHistory.at(0);

    const rollupDifferent =
      latestRollupOffChain.step - (latestRollupOnChain?.step || 0n);

    return {
      databaseName,
      merkleRootOnChainNew: latestRollupOnChain?.merkleRootOnChainNew || null,
      merkleRootOnChainOld: latestRollupOnChain?.merkleRootOnChainOld || null,
      rollupDifferent,
      rollupOnChainState:
        rollupDifferent > 0 ? ERollupState.Outdated : ERollupState.Updated,
      latestRollupOnChainSuccess:
        rollupOnChainHistory.find(
          (i) => i.status === EMinaTransactionStatus.Applied
        )?.createdAt || null,
      error: latestRollupOnChain?.error || null,
    };
  }
}
