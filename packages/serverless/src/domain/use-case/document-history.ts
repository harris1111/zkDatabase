// TODO: pagination does not work properly since we fetch all documents with
// the pagination filter first and then filter them by permission, which can
// lead to less documents being returned than expected.

/* eslint-disable import/prefer-default-export */
import {
  TDocumentHistory,
  TDocumentHistoryResponse,
  TDocumentRecordNullable,
  TMetadataDocument,
  TPagination,
} from '@zkdb/common';
import { DATABASE_ENGINE, zkDatabaseConstant } from '@zkdb/storage';
import assert from 'assert';
import { ClientSession, ObjectId } from 'mongodb';
import ModelDocument from '../../model/abstract/document.js';
import { PermissionSecurity } from './permission-security.js';
import { DEFAULT_PAGINATION } from 'common/const.js';
import { PermissionBase } from '@zkdb/permission';

/** The data being returned by the mongodb pipeline above.
 * TODO: Need debugging to actually confirm this */
type TDocumentHistorySerialized = {
  _id: ObjectId;
  documents: TDocumentRecordNullable[];
  metadata: Omit<TMetadataDocument, 'collectionName'>;
  active: boolean;
};

// TODO: test this function
async function listDocumentHistory(
  databaseName: string,
  collectionName: string,
  docId: string,
  actor: string,
  pagination: TPagination,
  session?: ClientSession
): Promise<TDocumentHistoryResponse[]> {
  const permission = await PermissionSecurity.collection(
    {
      databaseName,
      collectionName,
      actor,
    },
    session
  );

  if (permission.read) {
    const { client } = DATABASE_ENGINE.serverless;
    const paginationInfo = pagination || DEFAULT_PAGINATION;
    const pipeline = [
      {
        $match: {
          _id: { $ne: null },
          docId,
        },
      },
      {
        $group: {
          docId: '$docId',
          documentRevision: { $push: '$$ROOT' },
        },
      },
      {
        $sort: { docId: 1, createdAt: 1 },
      },
      {
        $lookup: {
          from: zkDatabaseConstant.databaseCollection.metadataDocument,
          let: { docId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$docId', '$$docId'] },
              },
            },
          ],
          as: 'metadata',
        },
      },
      {
        $skip: paginationInfo.offset,
      },
      {
        $limit: paginationInfo.limit,
      },
    ];

    const database = client.db(databaseName);
    const documentCollection = database.collection(collectionName);

    const queryResult = (await documentCollection
      .aggregate(pipeline)
      // TODO: need debugging to confirm the accuracy of this type annotation
      .toArray()) as TDocumentHistorySerialized[];

    const listDocumentHistoryWithMetadata: TDocumentHistory[] = queryResult.map(
      (doc) => {
        assert(
          doc.documents.length > 0,
          `Document history is empty, which should not happen if we expect the \
MongoDB pipeline to already handle this case`
        );

        return {
          docId: doc.documents[0].docId,
          documentRevision: doc.documents,
          metadata: {
            ...doc.metadata,
            collectionName,
          },
          active: doc.active,
        };
      }
    );

    return PermissionSecurity.filterListDocumentHistory(
      databaseName,
      listDocumentHistoryWithMetadata,
      actor,
      PermissionBase.permissionRead()
    );
  }

  throw new Error(
    `Access denied: Actor '${actor}' does not have 'read' permission for collection '${collectionName}'.`
  );
}

// TODO: This does not work yet, need to refactor to remove duplicate logic and
// add document metadata. Also catch up with UI designer to confirm the data
// needed to display
async function findDocumentHistory(
  databaseName: string,
  collectionName: string,
  actor: string,
  docId: string,
  session?: ClientSession
): Promise<TDocumentHistoryResponse | null> {
  const actorPermissionCollection = await PermissionSecurity.collection(
    {
      databaseName,
      collectionName,
      actor,
    },
    session
  );
  if (!actorPermissionCollection.read) {
    throw new Error(
      `Access denied: Actor '${actor}' does not have 'read' permission for collection '${collectionName}'.`
    );
  }

  const modelDocument = ModelDocument.getInstance(databaseName, collectionName);

  const latestDocument = await modelDocument.findHistoryOne(docId, session);

  if (!latestDocument) {
    return null;
  }
  const actorPermissionDocument = await PermissionSecurity.document(
    {
      databaseName,
      collectionName,
      actor,
      docId,
    },
    session
  );

  if (!actorPermissionDocument.read) {
    throw new Error(
      `Access denied: Actor '${actor}' does not have 'read' permission for the specified document.`
    );
  }

  const documentHistoryRecords = await modelDocument.findHistoryOne(
    docId,
    session
  );

  throw new Error(
    `this whole function needs to be refactored to remove duplicate logic and \
add document metadata`
  );

  // return {
  //   docId,
  //   documents: documentHistoryRecords.map((doc) => ({
  //     ...doc,
  //     document: Object.values(ModelDocument.deserializeDocument(doc.document)),
  //   })),
  //   active: documentHistoryRecords[0].active,
  //   metadata: // TODO:
  // };
}

export { listDocumentHistory, findDocumentHistory };
