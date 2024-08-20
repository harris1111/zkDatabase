import { DocumentEncoded } from '../schema.js';
import { MerkleWitness } from '../../types/merkle-tree.js';
import { getWitnessByDocumentId } from '../../repository/merkle-tree.js';
import { ZKDocument } from '../interfaces/document.js';
import { Ownership } from '../../types/ownership.js';
import { Permissions } from '../../types/permission.js';
import {
  getDocumentOwnership,
  updateDocumentGroupOwnership,
  updateDocumentUserOwnership,
  setDocumentPermissions,
} from '../../repository/ownership.js';

export class ZKDocumentImpl implements ZKDocument {
  private databaseName: string;
  private collectionName: string;
  private _documentEncoded: DocumentEncoded;
  private _id: string;

  constructor(
    databaseName: string,
    collectionName: string,
    documentEncoded: DocumentEncoded,
    id: string
  ) {
    this.databaseName = databaseName;
    this.collectionName = collectionName;
    this._documentEncoded = documentEncoded;
    this._id = id;
  }

  async changeGroup(groupName: string): Promise<void> {
    return updateDocumentGroupOwnership(
      this.databaseName,
      this.collectionName,
      this._id,
      groupName
    );
  }

  async changeOwner(userName: string): Promise<void> {
    return updateDocumentUserOwnership(
      this.databaseName,
      this.collectionName,
      this._id,
      userName
    );
  }

  async setPermissions(permissions: Permissions): Promise<Permissions> {
    return setDocumentPermissions(
      this.databaseName,
      this.collectionName,
      this._id,
      permissions
    );
  }

  async getOwnership(): Promise<Ownership> {
    return getDocumentOwnership(
      this.databaseName,
      this.collectionName,
      this._id
    );
  }

  async getWitness(): Promise<MerkleWitness> {
    if (this._id) {
      return getWitnessByDocumentId(this.databaseName, this._id);
    }
    throw Error();
  }

  toSchema<
    T extends {
      new (..._args: any): InstanceType<T>;
      deserialize: (_doc: DocumentEncoded) => any;
    },
  >(type: T): InstanceType<T> {
    if (this._documentEncoded.length > 0) {
      return type.deserialize(this._documentEncoded);
    }
    throw Error();
  }

  public get id() {
    return this._id;
  }

  public get documentEncoded() {
    return this._documentEncoded;
  }
}