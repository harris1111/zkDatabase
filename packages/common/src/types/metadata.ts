import { OwnershipAndPermission } from '@zkdb/permission';
import { TCollection } from './collection.js';
import { TDbRecord } from './common.js';
import { TDatabaseRequest } from './database.js';
import { TDocument } from './document.js';

export type TMetadataBasic = OwnershipAndPermission;

// Document metadata
export type TDocumentMetadata = TMetadataBasic & {
  collectionName: string;
  docId: string;
  merkleIndex: bigint;
  /** The operation number of the database that is associated with this
   * document. As opposed to merkleIndex which is fixed, this field is mutable
   * and will be updated every time the document is updated */
  operationNumber: bigint;
};

export type TDocumentMetadataRecord = TDbRecord<TDocumentMetadata>;

// Metadata from mongodb
export type TCollectionMetadataMongo = {
  sizeOnDisk: number;
};

// Collection metadata
export type TCollectionMetadata = TCollection &
  Partial<TCollectionMetadataMongo> &
  TMetadataBasic;

export type TCollectionMetadataRecord = TDbRecord<TCollectionMetadata>;

/**
 * Not sure what this is for?
 * Metadata detail for any type
 * @param T Type of base to be extended
 * @param M Type of metadata
 *
 */
export type TMetadataDetail<T, M> = T & { metadata: M };

export type TMetadataDetailDocument<T> = TMetadataDetail<T, TDocumentMetadata>;

export type TDocumentMetadataRequest = TDatabaseRequest &
  Pick<TCollection, 'collectionName'> &
  Pick<TDocument, 'docId'>;

export type TDocumentMetadataResponse = TDocumentMetadata | null;

export type TCollectionMetadataRequest = Omit<
  TDocumentMetadataRequest,
  'docId'
>;

export type TCollectionMetadataResponse = TCollectionMetadata | null;
