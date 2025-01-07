import { CircuitString, UInt64 } from 'o1js';
import { AccessPermissions, Schema, ZkDatabaseClient } from 'zkdb';
import { faker } from '@faker-js/faker';
import { DB_NAME, ZKDB_URL } from '../utils/config.js';

const COLLECTION_NAME = 'my-collection';
const GROUP_NAME = 'my-group';

class TShirt extends Schema.create({
  name: CircuitString,
  price: UInt64,
}) {}

async function run() {
  const zkdb = await ZkDatabaseClient.connect(ZKDB_URL);

  const fakeUser = {
    username: faker.internet.username().toLowerCase(),
    email: faker.internet.email().toLowerCase(),
  };

  await zkdb.authenticator.signUp(fakeUser.username, fakeUser.email);

  await zkdb.authenticator.signIn();

  await zkdb.db(DB_NAME).create({ merkleHeight: 18 });

  await zkdb.db(DB_NAME).group(GROUP_NAME).create({ description: '' });

  await zkdb
    .db(DB_NAME)
    .collection(COLLECTION_NAME)
    .create(GROUP_NAME, TShirt, [{ name: 'name', sorting: 'desc' }], {
      permissionOwner: AccessPermissions.fullAdminPermissions,
      permissionGroup: AccessPermissions.fullAccessPermissions,
      permissionOther: AccessPermissions.noPermissions,
    });

  console.log(
    'Index: ',
    await zkdb.db(DB_NAME).collection(COLLECTION_NAME).index.list()
  );

  await zkdb
    .db(DB_NAME)
    .collection(COLLECTION_NAME)
    .index.create([{ name: 'price', sorting: 'asc' }]);

  console.log(
    'Index after insert "price": ',
    await zkdb.db(DB_NAME).collection(COLLECTION_NAME).index.list()
  );

  await zkdb.db(DB_NAME).collection(COLLECTION_NAME).index.drop('name_-1');

  console.log(
    'Index after remove drop "name": ',
    await zkdb.db(DB_NAME).collection(COLLECTION_NAME).index.list()
  );

  zkdb.authenticator.getUser();

  await zkdb.authenticator.signOut();
}

await run();
