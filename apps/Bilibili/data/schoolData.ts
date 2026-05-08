import universities from './school.json';
import type { University } from '../types';

export type { University } from '../types';

export const UNIVERSITIES = universities as University[];
