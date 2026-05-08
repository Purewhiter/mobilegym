import type { ContentUri, ContentValues, Cursor } from './types/content';

export abstract class ContentProvider {
  readPermission?: string;
  writePermission?: string;

  abstract query(uri: ContentUri, projection?: string[]): Cursor<any>;
  abstract insert(uri: ContentUri, values: ContentValues): ContentUri;
  abstract update(uri: ContentUri, values: ContentValues, where?: string): number;
  abstract delete(uri: ContentUri, where?: string): number;
  abstract getType(uri: ContentUri): string;
}

export default ContentProvider;
