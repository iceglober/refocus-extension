import type { BuiltinId } from '../types';
import { githubIssue } from './builtins/githubIssue';
import { githubPr } from './builtins/githubPr';
import { googleDocs } from './builtins/googleDocs';
import { youtubeVideo } from './builtins/youtubeVideo';

export type BuiltinFn = (url: URL) => URL | null;

export const BUILTINS: Record<BuiltinId, BuiltinFn> = {
  'github-pr': githubPr,
  'github-issue': githubIssue,
  'google-docs': googleDocs,
  'youtube-video': youtubeVideo,
};
