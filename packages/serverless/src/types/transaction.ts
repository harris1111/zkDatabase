import { TDatabaseRequest } from './database';

export enum ETransactionStatus {
  // Transaction is prepared but not yet signed
  Unsigned,
  // Transaction is signed but not yet broadcasted
  Signed,
  // Transaction is broadcasted but not yet confirmed
  Unconfirmed,
  // Transaction is confirming in one or more blocks
  Confirming,
  // Transaction is errored
  Failed,
  // Transaction is confirmed
  Confirmed,
  // Transaction is unknown
  Unknown,
}

export enum EnumTransactionType {
  Deploy,
  Rollup,
}

export type TTransactionRequest = TDatabaseRequest & {
  transactionType: EnumTransactionType;
};

export type TTransactionByIdRequest = TDatabaseRequest & {
  id: string;
};

export type TTransactionConfirmRequest = TTransactionByIdRequest & {
  txHash: string;
};
