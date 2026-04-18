import type { ReviewState, RollupState } from '../types';

export type GqlContext =
  | {
      __typename: 'CheckRun';
      name: string;
      conclusion: string | null;
      status: string;
      detailsUrl: string | null;
    }
  | {
      __typename: 'StatusContext';
      context: string;
      state: string;
      targetUrl: string | null;
    };

export interface GqlPr {
  id: string;
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  merged: boolean;
  closed: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  repository: { nameWithOwner: string };
  commits: {
    nodes: Array<{
      commit: {
        oid: string;
        statusCheckRollup: null | {
          state: RollupState;
          contexts: { nodes: GqlContext[] };
        };
      };
    }>;
  };
  reviews: {
    nodes: Array<{
      id: string;
      author: { login: string } | null;
      state: ReviewState;
      submittedAt: string | null;
    }>;
  };
  comments: {
    nodes: Array<{
      id: string;
      author: { login: string } | null;
      bodyText: string;
      createdAt: string;
      url: string;
    }>;
  };
}

export interface GqlResponse {
  data?: {
    viewer: { login: string; pullRequests: { nodes: GqlPr[] } };
    assigned: {
      nodes: Array<({ __typename: 'PullRequest' } & GqlPr) | null>;
    };
    reviewRequested: {
      nodes: Array<({ __typename: 'PullRequest' } & GqlPr) | null>;
    };
    nodes?: Array<GqlPr | null>;
  };
  errors?: Array<{ message: string; type?: string }>;
}
