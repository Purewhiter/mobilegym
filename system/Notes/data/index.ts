import defaults from './defaults.json';
import { NOTES_CONSTANTS } from '../constants';
import * as TimeService from '../../../os/TimeService';
import type { Note, NotesTodo } from '../types';

const parseTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return TimeService.parseToTimestamp(value);
  return 0;
};

const sampleNotes = (defaults.sampleNotes ?? []).map((note) => ({
  ...note,
  updatedAt: parseTimestamp((note as any).updatedAt),
})) as Note[];

const sampleTodos = (defaults.sampleTodos ?? []).map((todo) => ({
  ...todo,
  updatedAt: parseTimestamp((todo as any).updatedAt),
})) as NotesTodo[];

export const NOTES_CONFIG = {
  ...NOTES_CONSTANTS,
  ...defaults,
  sampleNotes,
  sampleTodos,
};

