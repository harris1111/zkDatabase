import { gql } from "@apollo/client";
import {
  createMutateFunction,
  createQueryFunction,
  TApolloClient,
} from "./common";
import {
  TOwnership,
  TOwnershipRequest,
  TOwnershipResponse,
  TPermissions,
  TUser,
} from "./types";

export type TUserSignUpRecord = TUser;

export const permission = <T>(client: TApolloClient<T>) => ({
  set: createMutateFunction<
    TOwnership,
    TOwnershipRequest & {
      permission: TPermissions;
    },
    { permissionSet: TOwnershipResponse }
  >(
    client,
    gql`
      mutation PermissionSet(
        $databaseName: String!
        $collectionName: String!
        $docId: String
        $permission: PermissionInput!
      ) {
        permissionSet(
          databaseName: $databaseName
          collectionName: $collectionName
          docId: $docId
          permission: $permission
        ) {
          userName
          groupName
          permissionOwner {
            read
            write
            delete
            create
            system
          }
          permissionGroup {
            read
            write
            delete
            create
            system
          }
          permissionOther {
            read
            write
            delete
            create
            system
          }
        }
      }
    `,
    (data) => ({
      userName: data.permissionSet.userName,
      userGroup: data.permissionSet.userGroup,
      permissions: {
        permissionOwner: data.permissionSet.permissionOwner,
        permissionGroup: data.permissionSet.permissionGroup,
        permissionOther: data.permissionSet.permissionOther,
      },
    })
  ),
  get: createQueryFunction<
    TOwnership,
    TOwnershipRequest,
    { permissionList: TOwnershipResponse }
  >(
    client,
    gql`
      query PermissionList(
        $databaseName: String!
        $collectionName: String!
        $docId: String
      ) {
        permissionList(
          databaseName: $databaseName
          collectionName: $collectionName
          docId: $docId
        ) {
          userName
          groupName
          permissionOwner {
            read
            write
            delete
            create
            system
          }
          permissionGroup {
            read
            write
            delete
            create
            system
          }
          permissionOther {
            read
            write
            delete
            create
            system
          }
        }
      }
    `,
    (data) => ({
      userName: data.permissionList.userName,
      userGroup: data.permissionList.userGroup,
      permissions: {
        permissionOwner: data.permissionList.permissionOwner,
        permissionGroup: data.permissionList.permissionGroup,
        permissionOther: data.permissionList.permissionOther,
      },
    })
  ),
});
