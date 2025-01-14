/* eslint-disable no-unused-vars */
import {
  ETransactionType,
  TDatabaseCreateRequest,
  TDatabaseInfoResponse,
  TGroupListAllResponse,
  TRollupHistoryResponse,
  TSchemaExtendable,
  TTransactionDraftResponse,
  TUser,
  TUserFindResponse,
  TZkProofResponse,
  TZkProofStatusResponse,
} from '@zkdb/common';
import { ICollection } from './collection';
import { IGroup } from './group';
import { IUser } from './user';

export type TDatabaseConfig = Pick<TDatabaseCreateRequest, 'merkleHeight'>;

export interface IDatabase {
  // Database
  create(config: TDatabaseConfig): Promise<boolean>;

  exist(): Promise<boolean>;

  info(): Promise<TDatabaseInfoResponse>;

  // Collection
  collection<T extends TSchemaExtendable<any>>(
    collectionName: string
  ): ICollection<T>;

  collectionList(): Promise<string[]>;

  // Group
  group(groupName: string): IGroup;

  groupList(): Promise<TGroupListAllResponse>;

  // User
  user(
    userFilter: Partial<Pick<TUser, 'email' | 'publicKey' | 'userName'>>
  ): IUser;

  userList(): Promise<TUserFindResponse>;

  // ZK Proof
  zkProof(): Promise<TZkProofResponse>;

  zkProofStatus(): Promise<TZkProofStatusResponse>;

  // Transaction
  transactionDraft(
    transactionType: ETransactionType
  ): Promise<TTransactionDraftResponse>;

  transactionSubmit(
    transactionObjectId: string,
    txHash: string
  ): Promise<boolean>;

  // Rollup
  rollUpStart(): Promise<boolean>;

  rollUpHistory(): Promise<TRollupHistoryResponse>;
}
