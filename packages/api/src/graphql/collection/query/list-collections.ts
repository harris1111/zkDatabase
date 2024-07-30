import pkg from '@apollo/client';
const { gql } = pkg;
import client from "../../client.js";
import { NetworkResult, handleRequest } from "../../../utils/network.js";

const LIST_COLLECTION = gql`
  query CollectionList($databaseName: String!) {
    collectionList(databaseName: $databaseName)
  }
`;

interface ListCollectionResponse {
  collections: string[];
}

export const listCollections = async (
  databaseName: string
): Promise<NetworkResult<string[]>> => {
  return handleRequest(async () => {
    const { data } = await client.mutate<{
      collectionList: ListCollectionResponse;
    }>({
      mutation: LIST_COLLECTION,
      variables: { databaseName },
    });

    const response = data?.collectionList;

    if (response) {
      return {
        type: "success",
        data: response.collections,
      };
    } else {
      return {
        type: "error",
        message: "An unknown error occurred",
      };
    }
  });
};
