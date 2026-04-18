export const PR_FIELDS = /* GraphQL */ `
  fragment PrFields on PullRequest {
    id
    number
    title
    url
    updatedAt
    merged
    closed
    mergeable
    repository { nameWithOwner }
    commits(last: 1) {
      nodes {
        commit {
          oid
          statusCheckRollup {
            state
            contexts(first: 50) {
              nodes {
                __typename
                ... on CheckRun {
                  name
                  conclusion
                  status
                  detailsUrl
                }
                ... on StatusContext {
                  context
                  state
                  targetUrl
                }
              }
            }
          }
        }
      }
    }
    reviews(last: 20) {
      nodes {
        id
        author { login }
        state
        submittedAt
      }
    }
    comments(last: 10) {
      nodes {
        id
        author { login }
        bodyText
        createdAt
        url
      }
    }
  }
`;

export const POLL_QUERY = /* GraphQL */ `
  query Poll($explicitIds: [ID!]!) {
    viewer {
      login
      pullRequests(
        states: OPEN
        first: 50
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes { ...PrFields }
      }
    }
    assigned: search(
      query: "is:pr is:open assignee:@me"
      type: ISSUE
      first: 25
    ) {
      nodes {
        __typename
        ... on PullRequest { ...PrFields }
      }
    }
    reviewRequested: search(
      query: "is:pr is:open review-requested:@me"
      type: ISSUE
      first: 25
    ) {
      nodes {
        __typename
        ... on PullRequest { ...PrFields }
      }
    }
    nodes(ids: $explicitIds) {
      ... on PullRequest { ...PrFields }
    }
  }
  ${PR_FIELDS}
`;

export const RESOLVE_PR_ID_QUERY = /* GraphQL */ `
  query ResolvePrId($url: URI!) {
    resource(url: $url) {
      ... on PullRequest { id }
    }
  }
`;
