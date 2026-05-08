import shopping from './shopping.json';
import type { ShoppingItem } from '../types';

export type { ShoppingItem } from '../types';

export const SHOPPING_DATA = shopping as ShoppingItem[];
