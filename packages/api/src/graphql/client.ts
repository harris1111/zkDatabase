import pkg from "@apollo/client";
const { ApolloClient, InMemoryCache, HttpLink, ApolloLink } = pkg;
import { setContext } from "@apollo/client/link/context/index.js";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename/index.js";
import { config } from "../helper/config.js";
import { getJwtToken } from "../bridge/token-data.js";

const httpLink = new HttpLink({
  uri: config.AAS_URI,
});

const authLink = setContext(async (_, { headers }) => {
  const token = getJwtToken();
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const removeTypenameLink = removeTypenameFromVariables();

const link = ApolloLink.from([removeTypenameLink, authLink, httpLink]);

const client = new ApolloClient({
  link: link,
  cache: new InMemoryCache({ addTypename: false }),
  credentials: "include"
});

export default client;
