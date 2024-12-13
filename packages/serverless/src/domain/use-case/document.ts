// TODO: need end to end testing for every function in this file
// TODO: debug types to annotate the actual correct types
// TODO: pagination does not work properly since we fetch all documents with
// the pagination filter first and then filter them by permission, which can
// lead to less documents being returned than expected.

import {
  EDocumentProofStatus,
  ESequencer,
  PERMISSION_DEFAULT_VALUE,
  TDocumentField,
  TDocumentRecord,
  TDocumentRecordNullable,
  TMerkleProof,
  TMetadataDetailDocument,
  TPagination,
  TWithProofStatus,
} from '@zkdb/common';
import { Permission, PermissionBase } from '@zkdb/permission';
import {
  CompoundSession,
  DB,
  ModelQueueTask,
  ModelSequencer,
  withTransaction,
  zkDatabaseConstant,
} from '@zkdb/storage';
import { ClientSession } from 'mongodb';
import {
  DEFAULT_PAGINATION,
  ZKDATABASE_GROUP_SYSTEM,
  ZKDATABASE_USER_SYSTEM,
} from '../../common/const.js';
import { getCurrentTime } from '../../helper/common.js';
import ModelDocument from '../../model/abstract/document.js';
import { ModelMetadataCollection } from '../../model/database/metadata-collection.js';
import ModelMetadataDocument from '../../model/database/metadata-document.js';
import { FilterCriteria, parseQuery } from '../utils/document.js';
import { PermissionSecurity } from './permission-security.js';
import {
  proveCreateDocument,
  proveDeleteDocument,
  proveUpdateDocument,
} from './prover.js';

/** Transform an array of document fields to a document record. */
export function fieldArrayToRecord(
  fields: TDocumentField[]
): Record<string, TDocumentField> {
  return fields.reduce(
    (acc, field) => {
      acc[field.name] = field;
      return acc;
    },
    {} as Record<string, TDocumentField>
  );
}

async function findDocument(
  databaseName: string,
  collectionName: string,
  actor: string,
  filter: FilterCriteria,
  session?: ClientSession
): Promise<TDocumentRecordNullable | null> {
  const actorPermissionCollection = await PermissionSecurity.collection(
    databaseName,
    collectionName,
    actor,
    session
  );
  if (!actorPermissionCollection.read) {
    throw new Error(
      `Access denied: Actor '${actor}' does not have 'read' permission for collection '${collectionName}'.`
    );
  }

  const modelDocument = ModelDocument.getInstance(databaseName, collectionName);

  const documentRecord = await modelDocument.findOne(
    parseQuery(filter),
    session
  );

  if (!documentRecord) {
    return null;
  }

  const actorPermissionDocument = await PermissionSecurity.document(
    databaseName,
    collectionName,
    actor,
    documentRecord.docId,
    session
  );

  if (!actorPermissionDocument.read) {
    throw new Error(
      `Access denied: Actor '${actor}' does not have 'read' permission for the specified document.`
    );
  }

  return documentRecord;
}

async function createDocument(
  databaseName: string,
  collectionName: string,
  actor: string,
  fields: Record<string, TDocumentField>,
  permission = PERMISSION_DEFAULT_VALUE,
  compoundSession?: CompoundSession
) {
  const actorPermissionCollection = await PermissionSecurity.collection(
    databaseName,
    collectionName,
    actor,
    compoundSession?.sessionService
  );
  if (!actorPermissionCollection.write) {
    throw new Error(
      `Access denied: Actor '${actor}' does not have 'write' permission for collection '${collectionName}'.`
    );
  }

  const modelDocument = ModelDocument.getInstance(databaseName, collectionName);

  if (Object.keys(fields).length === 0) {
    throw new Error('Document array is empty. At least one field is required.');
  }

  // Save the document to the database
  const insertResult = await modelDocument.insertOneFromFields(
    fields,
    undefined,
    compoundSession?.sessionService
  );

  // 2. Create new sequence value
  const sequencer = ModelSequencer.getInstance(databaseName);
  const merkleIndex = await sequencer.nextValue(
    ESequencer.MerkleIndex,
    compoundSession?.sessionService
  );

  // 3. Create Metadata
  const modelDocumentMetadata = new ModelMetadataDocument(databaseName);

  const modelSchema = ModelMetadataCollection.getInstance(databaseName);

  const documentSchema = await modelSchema.getMetadata(collectionName, {
    session: compoundSession?.sessionService,
  });

  if (!documentSchema) {
    throw new Error('Cannot get documentSchema');
  }

  const { permission: collectionPermission } = documentSchema;

  const permissionCombine = Permission.from(permission).combine(
    Permission.from(collectionPermission)
  );

  await modelDocumentMetadata.insertOne(
    {
      collectionName,
      docId: insertResult.docId,
      merkleIndex: merkleIndex.toString(),
      ...{
        // I'm set these to system user and group as default
        // In case this permission don't override by the user
        // this will prevent the user from accessing the data
        group: ZKDATABASE_GROUP_SYSTEM,
        owner: ZKDATABASE_USER_SYSTEM,
      },
      // Overwrite inherited permission with the new one
      permission: permissionCombine.value,
      owner: actor,
      group: documentSchema.group,
      createdAt: getCurrentTime(),
      updatedAt: getCurrentTime(),
    },
    { session: compoundSession?.sessionService }
  );

  const witness = await proveCreateDocument(
    databaseName,
    collectionName,
    insertResult.docId,
    Object.values(fields),
    compoundSession
  );

  return witness;
}

async function updateDocument(
  databaseName: string,
  collectionName: string,
  actor: string,
  filter: FilterCriteria,
  update: Record<string, TDocumentField>
) {
  const modelDocument = ModelDocument.getInstance(databaseName, collectionName);
  const documentRecord = await withTransaction(async (session) => {
    const oldDocumentRecord = await modelDocument.findOne(
      parseQuery(filter),
      session
    );

    if (oldDocumentRecord) {
      const actorPermissionDocument = await PermissionSecurity.document(
        databaseName,
        collectionName,
        actor,
        oldDocumentRecord.docId,
        session
      );
      if (!actorPermissionDocument.write) {
        throw new Error(
          `Access denied: Actor '${actor}' does not have 'write' permission for the specified document.`
        );
      }

      if (Object.keys(update).length === 0) {
        throw new Error(
          'Document array is empty. At least one field is required.'
        );
      }

      await modelDocument.updateOne(oldDocumentRecord.docId, update, session);

      return oldDocumentRecord;
    }
  });

  if (documentRecord) {
    const witness = await proveUpdateDocument(
      databaseName,
      collectionName,
      documentRecord.docId,
      Object.values(update)
    );
    return witness;
  }

  throw Error(
    'Invalid query, the amount of documents that satisfy filter must be only one'
  );
}

async function deleteDocument(
  databaseName: string,
  collectionName: string,
  actor: string,
  filter: FilterCriteria
): Promise<TMerkleProof[]> {
  const result = await withTransaction(async (session) => {
    const modelDocument = ModelDocument.getInstance(
      databaseName,
      collectionName
    );

    const findResult = await modelDocument.findOne(parseQuery(filter), session);

    if (findResult) {
      const actorPermissionDocument = await PermissionSecurity.document(
        databaseName,
        collectionName,
        findResult.docId,
        actor,
        session
      );
      if (!actorPermissionDocument.write) {
        throw new Error(
          `Access denied: Actor '${actor}' does not have 'delete' permission for the specified document.`
        );
      }
      await modelDocument.dropOne(findResult.docId);
    }

    return findResult;
  });
  if (result) {
    const witness = await proveDeleteDocument(
      databaseName,
      collectionName,
      result.docId
    );
    return witness;

    // TODO: Should we remove document metadata ???????
    // const modelDocumentMetadata = new ModelDocumentMetadata(databaseName);
    // await modelDocumentMetadata.deleteOne(
    //   { docId: findResult[0].docId },
    //   { session }
    // );
  }

  throw Error('Document not found');
}

async function findDocumentWithMetadata(
  databaseName: string,
  collectionName: string,
  actor: string,
  query?: FilterCriteria,
  pagination?: TPagination,
  session?: ClientSession
): Promise<TWithProofStatus<TMetadataDetailDocument<TDocumentRecord>>[]> {
  const { client } = DB.service;
  const database = client.db(databaseName);
  const paginationInfo = pagination || DEFAULT_PAGINATION;
  const pipeline = [];
  if (query) {
    pipeline.push({ $match: parseQuery(query) });
  }
  pipeline.push({
    $lookup: {
      from: zkDatabaseConstant.databaseCollection.metadataDocument,
      let: { docId: '$docId' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$docId', '$$docId'] },
          },
        },
      ],
      as: 'metadata',
    },
    $skip: paginationInfo.offset,
    $limit: paginationInfo.limit,
  });

  const listDocumentWithMetadata = (await database
    .collection(collectionName)
    .aggregate(pipeline, { session })
    .toArray()) as TMetadataDetailDocument<TDocumentRecord>[];

  const listQueueTask =
    await ModelQueueTask.getInstance().getTasksByCollection(collectionName);

  const taskMap = new Map(
    listQueueTask?.map((task) => [task.docId, task.status]) || []
  );

  const result = await PermissionSecurity.filterMetadataDocumentDetail(
    databaseName,
    listDocumentWithMetadata,
    actor,
    PermissionBase.permissionRead()
  );

  return result.map((item) => {
    return {
      ...item,
      proofStatus: taskMap.get(item.docId) || EDocumentProofStatus.Failed,
    };
  });
}

export {
  createDocument,
  deleteDocument,
  findDocumentWithMetadata,
  findDocument,
  updateDocument,
};

export type TDocument = {
  docId: string;
  active: boolean;
  document: Record<string, TDocumentField>;
};
