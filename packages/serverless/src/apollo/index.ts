import {
  resolversCollection,
  resolversCollectionIndex,
  resolversDatabase,
  resolversDocument,
  resolversGroup,
  resolversMerkleTree,
  resolversPermission,
  resolversProof,
  resolversRollUp,
  resolversTransaction,
  resolversUser,
  typeDefsCollection,
  typeDefsCollectionIndex,
  typeDefsCommon,
  typeDefsDatabase,
  typeDefsDocument,
  typeDefsGroup,
  typeDefsMerkleTree,
  typeDefsPermission,
  typeDefsProof,
  typeDefsRollUp,
  typeDefsTransaction,
  typeDefsUser,
} from './app';

export const TypedefsApp = [
  typeDefsCommon,
  typeDefsDatabase,
  typeDefsCollection,
  typeDefsDocument,
  typeDefsCollectionIndex,
  typeDefsUser,
  typeDefsGroup,
  typeDefsPermission,
  typeDefsMerkleTree,
  typeDefsProof,
  typeDefsTransaction,
  typeDefsRollUp,
];

export const ResolversApp = [
  resolversDatabase,
  resolversCollection,
  resolversDocument,
  resolversCollectionIndex,
  resolversUser,
  resolversGroup,
  resolversPermission,
  resolversMerkleTree,
  resolversProof,
  resolversTransaction,
  resolversRollUp,
];

export * from './validation';
