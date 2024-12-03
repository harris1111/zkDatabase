import { TCollectionDetail } from './collection.js';
import { TDbRecord } from './common.js';
import { TPagination } from './pagination.js';
import { ETransactionStatus } from './transaction.js';

export type TDatabase = {
  databaseName: string;
  databaseOwner: string;
  merkleHeight: number;
  collection: TCollectionDetail[];
  databaseSize: number;
  appPublicKey: string;
  deployStatus: ETransactionStatus;
};

export type TDatabaseRecord = TDbRecord<TDatabase>;

export type TDatabaseRequest = Pick<TDatabase, 'databaseName'>;

export type TDatabaseUpdateDeployedRequest = TDatabaseRequest &
  Pick<TDatabase, 'appPublicKey'>;

export type TDatabaseSearchRequest = {
  query: Partial<TDatabaseRecord>;
  pagination: TPagination;
};

export type TDatabaseCreateRequest = TDatabaseRequest & {
  merkleHeight: number;
};

export type TDatabaseFindByIndexRequest = TDatabaseRequest & {
  index: number;
};

export type TDatabaseChangeOwnerRequest = TDatabaseRequest & {
  newOwner: string;
};
