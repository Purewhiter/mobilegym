export type ContentUri = string;

export type ContentValues = Record<string, any>;

export interface Cursor<T> {
  items: T[];
  count: number;
}
