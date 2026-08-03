'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { diff, recordAudit } from '@/lib/audit';
import type { ActionState } from '@/components/RecordForm';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const strOrNull = (v: FormDataEntryValue | null) => (str(v) === '' ? null : str(v));
const numOrNull = (v: FormDataEntryValue | null) => {
  const raw = str(v);
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: FormDataEntryValue | null) => {
  const x = str(v).toLowerCase();
  return x === 'on' || x === 'yes' || x === 'true';
};

const ok = (message: string): ActionState => ({ ok: true, message });
const err = (message: string, errors?: Record<string, string>): ActionState => ({
  ok: false,
  message,
  errors,
});

/* ============================================================== ITEM MASTER */

export async function saveItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;
  const code = str(form.get('code')).toUpperCase();

  if (!code) return err('An item code is required.', { code: 'Required.' });
  if (!str(form.get('name'))) return err('An item name is required.', { name: 'Required.' });

  const values = {
    code,
    name: str(form.get('name')),
    category: str(form.get('category')) || 'Raw Material',
    baseUom: str(form.get('baseUom')) || 'piece',
    standardCost: numOrNull(form.get('standardCost')),
    reorderLevel: numOrNull(form.get('reorderLevel')),
    trackedByBatch: bool(form.get('trackedByBatch')),
    active: bool(form.get('active')),
  };

  const clash = await db.select().from(s.item).where(eq(s.item.code, code));
  if (clash.length && clash[0].id !== id) {
    return err(`Item code ${code} is already in use.`, { code: 'Duplicate code.' });
  }

  if (id) {
    const before = (await db.select().from(s.item).where(eq(s.item.id, id)))[0];
    await db.update(s.item).set(values).where(eq(s.item.id, id));
    await recordAudit({
      user,
      action: 'SETUP_CHANGE',
      entity: 'Item Master',
      refId: code,
      details: diff(before as never, values),
    });
  } else {
    await db.insert(s.item).values(values);
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Item Master', refId: code, details: { old: null, next: values } });
  }

  revalidatePath('/masters/items');
  revalidatePath('/');
  return ok(`Saved ${code}.`);
}

/* ========================================================== SUPPLIER MASTER */

export async function saveSupplier(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;
  const code = str(form.get('code')).toUpperCase();
  const name = str(form.get('name'));

  if (!code) return err('A supplier code is required.', { code: 'Required.' });
  if (!name) return err('A supplier name is required.', { name: 'Required.' });

  const values = {
    code,
    name,
    categorySupplied: strOrNull(form.get('categorySupplied')),
    contact: strOrNull(form.get('contact')),
    supplierType: str(form.get('supplierType')) || 'Inventory Supplier',
    active: bool(form.get('active')),
  };

  const clash = await db.select().from(s.supplier).where(eq(s.supplier.code, code));
  if (clash.length && clash[0].id !== id) {
    return err(`Supplier code ${code} is already in use.`, { code: 'Duplicate code.' });
  }

  if (id) {
    const before = (await db.select().from(s.supplier).where(eq(s.supplier.id, id)))[0];
    await db.update(s.supplier).set(values).where(eq(s.supplier.id, id));
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Supplier Master', refId: name, details: diff(before as never, values) });
  } else {
    await db.insert(s.supplier).values(values);
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Supplier Master', refId: name, details: { old: null, next: values } });
  }

  revalidatePath('/masters/suppliers');
  return ok(`Saved ${name}.`);
}

/* ============================================================ WORKER MASTER */

export async function saveWorker(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;
  const code = str(form.get('code')).toUpperCase();
  const name = str(form.get('name'));

  if (!code) return err('A worker code is required.', { code: 'Required.' });
  if (!name) return err('A worker name is required.', { name: 'Required.' });

  const values = {
    code,
    name,
    processesAbleToDo: strOrNull(form.get('processesAbleToDo')),
    active: bool(form.get('active')),
  };

  const clash = await db.select().from(s.worker).where(eq(s.worker.code, code));
  if (clash.length && clash[0].id !== id) {
    return err(`Worker code ${code} is already in use.`, { code: 'Duplicate code.' });
  }

  if (id) {
    const before = (await db.select().from(s.worker).where(eq(s.worker.id, id)))[0];
    await db.update(s.worker).set(values).where(eq(s.worker.id, id));
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Worker Master', refId: `${code} ${name}`, details: diff(before as never, values) });
  } else {
    await db.insert(s.worker).values(values);
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Worker Master', refId: `${code} ${name}`, details: { old: null, next: values } });
  }

  revalidatePath('/masters/workers');
  return ok(`Saved ${name}.`);
}

/* =========================================================== PROCESS MASTER */

export async function saveProcess(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;
  const code = str(form.get('code')).toUpperCase();

  if (!code) return err('A process code is required.', { code: 'Required.' });

  const values = {
    code,
    name: str(form.get('name')) || code,
    sequenceNo: numOrNull(form.get('sequenceNo')) ?? 0,
    inputStage: strOrNull(form.get('inputStage')),
    outputStage: strOrNull(form.get('outputStage')),
    consumesMaterials: strOrNull(form.get('consumesMaterials')),
    producesStockItem: strOrNull(form.get('producesStockItem')),
    active: bool(form.get('active')),
  };

  const clash = await db.select().from(s.process).where(eq(s.process.code, code));
  if (clash.length && clash[0].id !== id) {
    return err(`Process code ${code} is already in use.`, { code: 'Duplicate code.' });
  }

  if (id) {
    await db.update(s.process).set(values).where(eq(s.process.id, id));
  } else {
    await db.insert(s.process).values(values);
  }

  await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Process Master', refId: code, details: values });
  revalidatePath('/masters/processes');
  return ok(`Saved ${code}.`);
}

/* ===================================================== WORKER PROCESS SKILLS */

export async function saveSkill(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const workerId = Number(form.get('workerId'));
  const processId = Number(form.get('processId'));

  if (!workerId || !processId) return err('Worker and process are both required.');

  const values = {
    workerId,
    processId,
    skillStatus: str(form.get('skillStatus')) || 'Can Do',
    active: bool(form.get('active')),
    notes: strOrNull(form.get('notes')),
  };

  const existing = await db
    .select()
    .from(s.workerProcessSkill)
    .where(
      and(eq(s.workerProcessSkill.workerId, workerId), eq(s.workerProcessSkill.processId, processId)),
    );

  if (existing.length) {
    await db.update(s.workerProcessSkill).set(values).where(eq(s.workerProcessSkill.id, existing[0].id));
  } else {
    await db.insert(s.workerProcessSkill).values(values);
  }

  await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Worker Process Skills', refId: `${workerId}/${processId}`, details: values });
  revalidatePath('/masters/skills');
  return ok('Skill assignment saved.');
}

export async function deleteSkill(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(form.get('id'));
  if (!id) return;
  await db.delete(s.workerProcessSkill).where(eq(s.workerProcessSkill.id, id));
  await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Worker Process Skills', refId: String(id), details: { removed: true } });
  revalidatePath('/masters/skills');
}

/* ======================================================= PIECE RATE SETTINGS */

export async function saveRate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;
  const processId = Number(form.get('processId'));
  const productItemId = Number(form.get('productItemId'));

  if (!processId || !productItemId) return err('Process and product are both required.');

  const rate = numOrNull(form.get('ratePerUnit'));
  if (rate !== null && rate < 0) return err('A rate cannot be negative.', { ratePerUnit: 'Must be zero or more.' });

  const values = {
    processId,
    productItemId,
    ratePerUnit: rate,
    unit: str(form.get('unit')) || 'piece',
    effectiveFrom: str(form.get('effectiveFrom')) || new Date().toISOString().slice(0, 10),
    active: bool(form.get('active')),
    notes: strOrNull(form.get('notes')),
  };

  if (id) {
    const before = (await db.select().from(s.pieceRate).where(eq(s.pieceRate.id, id)))[0];
    await db.update(s.pieceRate).set(values).where(eq(s.pieceRate.id, id));
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Piece Rate Settings', refId: String(id), details: diff(before as never, values) });
  } else {
    await db.insert(s.pieceRate).values(values);
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Piece Rate Settings', refId: 'new', details: { old: null, next: values } });
  }

  revalidatePath('/masters/rates');
  revalidatePath('/');
  return ok(rate === null ? 'Saved — rate left as TO CONFIRM.' : `Saved rate ${rate.toLocaleString()} UGX.`);
}

/* ================================================================= SETTINGS */

type SettingTable = 'app' | 'meal' | 'report';

const SETTING_TABLES = {
  app: s.appSetting,
  meal: s.mealCostSetting,
  report: s.reportHeaderSetting,
} as const;

const SETTING_LABEL: Record<SettingTable, string> = {
  app: 'Settings',
  meal: 'Meal Cost Settings',
  report: 'Report Header Settings',
};

/** Saves every key on a settings page in one submit. */
export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const which = String(form.get('__table') ?? 'app') as SettingTable;
  const table = SETTING_TABLES[which];
  if (!table) return err('Unknown settings group.');

  const changes: Record<string, string> = {};

  for (const [field, raw] of form.entries()) {
    if (!field.startsWith('setting__')) continue;
    const id = Number(field.slice('setting__'.length));
    if (!id) continue;

    const value = String(raw ?? '').trim();
    const before = (await db.select().from(table).where(eq(table.id, id)))[0];
    if (!before || (before.value ?? '') === value) continue;

    await db.update(table).set({ value: value === '' ? null : value }).where(eq(table.id, id));
    changes[before.key] = value;
  }

  if (Object.keys(changes).length) {
    await recordAudit({
      user,
      action: 'SETUP_CHANGE',
      entity: SETTING_LABEL[which],
      refId: which,
      details: changes,
    });
  }

  revalidatePath('/settings');
  revalidatePath('/settings/meal-cost');
  revalidatePath('/settings/report-header');
  revalidatePath('/');

  const n = Object.keys(changes).length;
  return ok(n === 0 ? 'No changes to save.' : `Saved ${n} setting${n === 1 ? '' : 's'}.`);
}

/* ==================================================== MEAL QUALIFICATION RULE */

export async function saveMealRule(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const id = Number(form.get('id')) || null;

  const values = {
    ruleId: str(form.get('ruleId')) || `R${Date.now().toString().slice(-4)}`,
    processCode: str(form.get('processCode')).toUpperCase(),
    ruleBasis: str(form.get('ruleBasis')) || 'Daily',
    product: strOrNull(form.get('product')),
    condition: strOrNull(form.get('condition')),
    threshold: numOrNull(form.get('threshold')),
    weeklySmallMin: numOrNull(form.get('weeklySmallMin')),
    weeklyLargeMin: numOrNull(form.get('weeklyLargeMin')),
    eatingDaysEarned: numOrNull(form.get('eatingDaysEarned')) ?? 0,
    active: bool(form.get('active')),
    notes: strOrNull(form.get('notes')),
  };

  if (!values.processCode) return err('A process code is required.', { processCode: 'Required.' });

  if (id) {
    await db.update(s.mealQualificationRule).set(values).where(eq(s.mealQualificationRule.id, id));
  } else {
    await db.insert(s.mealQualificationRule).values(values);
  }

  await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Meal Qualification Settings', refId: values.ruleId, details: values });
  revalidatePath('/settings/meal-rules');
  revalidatePath('/meals/qualification');
  return ok(`Saved rule ${values.ruleId}.`);
}

/* ============================================================ LIST OPTIONS */

export async function saveListOption(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const category = str(form.get('category'));
  const value = str(form.get('value'));

  if (!category || !value) return err('Category and value are both required.');

  const existing = await db
    .select()
    .from(s.listOption)
    .where(and(eq(s.listOption.category, category), eq(s.listOption.value, value)));

  if (existing.length) return err(`"${value}" already exists under ${category}.`);

  await db.insert(s.listOption).values({
    category,
    value,
    numericMeta: numOrNull(form.get('numericMeta')),
    sortOrder: 999,
  });

  await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Lists', refId: `${category}/${value}`, details: { added: value } });
  revalidatePath('/settings/lists');
  return ok(`Added "${value}" to ${category}.`);
}

export async function deleteListOption(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(form.get('id'));
  if (!id) return;
  const before = (await db.select().from(s.listOption).where(eq(s.listOption.id, id)))[0];
  await db.delete(s.listOption).where(eq(s.listOption.id, id));
  if (before) {
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Lists', refId: `${before.category}/${before.value}`, details: { removed: before.value } });
  }
  revalidatePath('/settings/lists');
}

/* ==================================================== ACCOUNTING MAPPINGS */

export async function saveAccountingMapping(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const changes: Record<string, unknown> = {};

  for (const [field, raw] of form.entries()) {
    const m = /^(debit|credit)__(\d+)$/.exec(field);
    if (!m) continue;
    const [, which, idRaw] = m;
    const id = Number(idRaw);
    const value = String(raw ?? '').trim();

    const before = (await db.select().from(s.accountingMapping).where(eq(s.accountingMapping.id, id)))[0];
    if (!before) continue;

    const current = which === 'debit' ? before.debitAccount : before.creditAccount;
    if ((current ?? '') === value) continue;

    await db
      .update(s.accountingMapping)
      .set(which === 'debit' ? { debitAccount: value } : { creditAccount: value })
      .where(eq(s.accountingMapping.id, id));

    changes[`${before.mappingKey}.${which}`] = value;
  }

  if (Object.keys(changes).length) {
    await recordAudit({ user, action: 'SETUP_CHANGE', entity: 'Accounting Export Settings', refId: 'mappings', details: changes });
  }

  revalidatePath('/settings/accounting');
  const n = Object.keys(changes).length;
  return ok(n === 0 ? 'No changes to save.' : `Saved ${n} mapping change${n === 1 ? '' : 's'}.`);
}
