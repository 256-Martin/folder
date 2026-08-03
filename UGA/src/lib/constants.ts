/** Shared vocabulary, mirroring the spreadsheet's Lists tab and Process Master. */

export const ROLES = ['ADMIN', 'TEAM', 'VIEW'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  TEAM: 'Production Team',
  VIEW: 'View only',
};

/** Can this role write data? */
export function canWrite(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'TEAM';
}

/** Can this role change masters, settings, corrections and voids? */
export function canAdmin(role: Role | undefined): boolean {
  return role === 'ADMIN';
}

/* --------------------------------------------------------------- movements -- */

export const MOVEMENT_SIGNS: Record<string, number> = {
  Receipt: 1,
  Produced: 1,
  Return: 1,
  'Issue to production': -1,
  Dispatch: -1,
  Adjustment: 1,
};

export function signOf(movementType: string, overrides?: Map<string, number>): number {
  return overrides?.get(movementType) ?? MOVEMENT_SIGNS[movementType] ?? 1;
}

/* ----------------------------------------------------------------- routing -- */

/** The nine stages tracked as work in progress, in routing order. */
export const WIP_STAGES = [
  { key: 'cut', from: 'CUT', to: 'MSAND', label: 'Cut, not m/sanded', domain: 'handle' },
  { key: 'msand', from: 'MSAND', to: 'DRILL', label: 'M/sanded, not drilled', domain: 'handle' },
  { key: 'drill', from: 'DRILL', to: 'HSAND', label: 'Drilled, not h/sanded', domain: 'handle' },
  { key: 'hsand', from: 'HSAND', to: 'TUFT', label: 'H/sanded, not tufted', domain: 'crossover' },
  { key: 'tuft', from: 'TUFT', to: 'TRIM', label: 'Tufted, not trimmed', domain: 'product' },
  { key: 'trim', from: 'TRIM', to: 'FINISH', label: 'Trimmed, not finished', domain: 'product' },
  { key: 'finish', from: 'FINISH', to: 'QC', label: 'Finished, not QC', domain: 'product' },
  { key: 'qc', from: 'QC', to: 'PACK', label: 'QC, not packed', domain: 'product' },
  { key: 'packed', from: 'PACK', to: null, label: 'Packed (ready for sale)', domain: 'product' },
] as const;

/** Which handle each finished product is built on. */
export const PRODUCT_HANDLE: Record<string, string> = {
  'BR-S': 'HDL-S',
  'BR-L': 'HDL-L',
  'BR-CUSTOM': 'HDL-L',
};

export const FINISHED_GOODS = ['BR-S', 'BR-L', 'BR-CUSTOM'];
export const HANDLE_CODES = ['HDL-S', 'HDL-L'];

/* ---------------------------------------------------------------- statuses -- */

export type StockStatus = 'OK' | 'LOW' | 'NEGATIVE';

export function stockStatus(balance: number, reorderLevel: number | null): StockStatus {
  if (balance < 0) return 'NEGATIVE';
  if (reorderLevel !== null && reorderLevel !== undefined && balance <= reorderLevel) return 'LOW';
  return 'OK';
}

/* ------------------------------------------------------------------ audit --- */

export const AUDIT_ACTIONS = [
  'LOGIN',
  'RECORD',
  'SETUP_CHANGE',
  'CORRECTION',
  'VOID',
  'RESTORE',
  'REPORT_GENERATED',
  'EXPORT',
] as const;
