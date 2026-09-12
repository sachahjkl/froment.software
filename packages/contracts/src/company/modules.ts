import { Schema } from 'effect';

export const CompanyModule = Schema.Literals([
  'sales',
  'purchasing',
  'banking',
  'accounting',
  'tax',
  'ai',
  'demonstration',
]);
export type CompanyModule = typeof CompanyModule.Type;
