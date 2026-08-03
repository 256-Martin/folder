/**
 * UGABRUSH MANUFACTURING SYSTEM — database schema
 *
 * Mirrors the 41-tab Google Sheets system:
 *   masters -> transactions -> derived views -> reports
 *
 * Design notes
 * ------------
 * - Stock is NEVER stored. Every balance is derived from inventory_movement.
 * - Entries are never deleted. Voiding sets voidedAt and writes a void_register
 *   row holding a JSON snapshot, so IDs stay stable forever.
 * - Business identifiers (PU00001, MV00001, OP00001...) come from a database
 *   sequence, not row position, so they never renumber.
 * - Numeric columns use double precision to reproduce the spreadsheet's IEEE-754
 *   arithmetic exactly. See DEVIATIONS.md.
 */

import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ========================================================================== *
 * AUTH
 * ========================================================================== */

export const appUser = pgTable(
  'app_user',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** ADMIN | TEAM | VIEW */
    role: text('role').notNull().default('VIEW'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('app_user_email_idx').on(t.email)],
);

/* ========================================================================== *
 * MASTER DATA
 * ========================================================================== */

export const item = pgTable(
  'item',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Raw Material | Consumable | Manufactured Component | Finished Good */
    category: text('category').notNull(),
    baseUom: text('base_uom').notNull(),
    standardCost: doublePrecision('standard_cost'),
    reorderLevel: doublePrecision('reorder_level'),
    trackedByBatch: boolean('tracked_by_batch').notNull().default(false),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('item_code_idx').on(t.code)],
);

export const supplier = pgTable(
  'supplier',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    categorySupplied: text('category_supplied'),
    contact: text('contact'),
    /** Inventory Supplier | Food Provider | Transport Provider | Service Provider | Other */
    supplierType: text('supplier_type').notNull().default('Inventory Supplier'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('supplier_code_idx').on(t.code)],
);

export const worker = pgTable(
  'worker',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    processesAbleToDo: text('processes_able_to_do'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('worker_code_idx').on(t.code)],
);

export const process = pgTable(
  'process',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sequenceNo: doublePrecision('sequence_no').notNull(),
    inputStage: text('input_stage'),
    outputStage: text('output_stage'),
    consumesMaterials: text('consumes_materials'),
    producesStockItem: text('produces_stock_item'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('process_code_idx').on(t.code)],
);

export const workerProcessSkill = pgTable(
  'worker_process_skill',
  {
    id: serial('id').primaryKey(),
    workerId: integer('worker_id')
      .notNull()
      .references(() => worker.id, { onDelete: 'cascade' }),
    processId: integer('process_id')
      .notNull()
      .references(() => process.id, { onDelete: 'cascade' }),
    /** Can Do | Training | Supervisor Only | Inactive */
    skillStatus: text('skill_status').notNull().default('Can Do'),
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('worker_skill_unique_idx').on(t.workerId, t.processId)],
);

export const pieceRate = pgTable(
  'piece_rate',
  {
    id: serial('id').primaryKey(),
    processId: integer('process_id')
      .notNull()
      .references(() => process.id, { onDelete: 'cascade' }),
    productItemId: integer('product_item_id')
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
    /** NULL means "TO CONFIRM" — blocks operation entry unless Settings allows it. */
    ratePerUnit: doublePrecision('rate_per_unit'),
    unit: text('unit').notNull().default('piece'),
    effectiveFrom: date('effective_from').notNull(),
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
  },
  (t) => [
    index('piece_rate_lookup_idx').on(t.processId, t.productItemId, t.effectiveFrom),
  ],
);

/* ========================================================================== *
 * TRANSACTIONS
 * ========================================================================== */

export const purchase = pgTable(
  'purchase',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => supplier.id),
    itemId: integer('item_id')
      .notNull()
      .references(() => item.id),
    batchNo: text('batch_no'),
    qty: doublePrecision('qty').notNull(),
    totalCost: doublePrecision('total_cost').notNull(),
    qualityNotes: text('quality_notes'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedById: integer('voided_by_id').references(() => appUser.id),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdByName: text('created_by_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('purchase_code_idx').on(t.code),
    index('purchase_date_idx').on(t.date),
    index('purchase_item_idx').on(t.itemId),
  ],
);

export const batch = pgTable(
  'batch',
  {
    id: serial('id').primaryKey(),
    batchNo: text('batch_no').notNull(),
    itemId: integer('item_id')
      .notNull()
      .references(() => item.id),
    supplierId: integer('supplier_id').references(() => supplier.id),
    purchaseDate: date('purchase_date').notNull(),
    qtyReceived: doublePrecision('qty_received').notNull(),
    unitCost: doublePrecision('unit_cost'),
    quality: text('quality'),
    purchaseId: integer('purchase_id').references(() => purchase.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('batch_no_idx').on(t.batchNo),
    index('batch_item_idx').on(t.itemId),
  ],
);

export const inventoryMovement = pgTable(
  'inventory_movement',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    itemId: integer('item_id')
      .notNull()
      .references(() => item.id),
    batchNo: text('batch_no'),
    /** Receipt | Produced | Return | Issue to production | Dispatch | Adjustment */
    movementType: text('movement_type').notNull(),
    qty: doublePrecision('qty').notNull(),
    unitCost: doublePrecision('unit_cost'),
    refSource: text('ref_source'),
    byName: text('by_name'),
    note: text('note'),
    issuedToType: text('issued_to_type'),
    issuedTo: text('issued_to'),
    receivedBy: text('received_by'),
    sourcePurchaseId: integer('source_purchase_id').references(() => purchase.id),
    sourceOperationId: integer('source_operation_id'),
    sourceDispatchId: integer('source_dispatch_id'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('movement_code_idx').on(t.code),
    index('movement_item_idx').on(t.itemId),
    index('movement_date_idx').on(t.date),
    index('movement_type_idx').on(t.movementType),
    index('movement_batch_idx').on(t.batchNo),
  ],
);

export const productionOperation = pgTable(
  'production_operation',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    workerId: integer('worker_id')
      .notNull()
      .references(() => worker.id),
    processId: integer('process_id')
      .notNull()
      .references(() => process.id),
    productItemId: integer('product_item_id')
      .notNull()
      .references(() => item.id),
    inputBatch: text('input_batch'),
    outputBatch: text('output_batch'),
    acceptedQty: doublePrecision('accepted_qty').notNull().default(0),
    rejectedQty: doublePrecision('rejected_qty').notNull().default(0),
    rejectReason: text('reject_reason'),
    /** Rate snapshotted at entry time so later rate changes never rewrite history. */
    pieceRateApplied: doublePrecision('piece_rate_applied'),
    directLabourCost: doublePrecision('direct_labour_cost').notNull().default(0),
    wipStage: text('wip_stage'),
    notes: text('notes'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdByName: text('created_by_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('operation_code_idx').on(t.code),
    index('operation_date_idx').on(t.date),
    index('operation_worker_idx').on(t.workerId),
    index('operation_process_idx').on(t.processId),
    index('operation_product_idx').on(t.productItemId),
  ],
);

export const dispatch = pgTable(
  'dispatch',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    destinationName: text('destination_name').notNull(),
    productItemId: integer('product_item_id')
      .notNull()
      .references(() => item.id),
    qty: doublePrecision('qty').notNull(),
    unitPrice: doublePrecision('unit_price'),
    note: text('note'),
    destinationType: text('destination_type'),
    personResponsible: text('person_responsible'),
    deliveryNoteNo: text('delivery_note_no'),
    salesOrderNo: text('sales_order_no'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('dispatch_code_idx').on(t.code),
    index('dispatch_date_idx').on(t.date),
  ],
);

export const meal = pgTable(
  'meal',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    workerId: integer('worker_id')
      .notNull()
      .references(() => worker.id),
    plateCount: doublePrecision('plate_count').notNull(),
    qualified: text('qualified').notNull().default('No'),
    qualifiedPlates: doublePrecision('qualified_plates').notNull().default(0),
    unqualifiedPlates: doublePrecision('unqualified_plates').notNull().default(0),
    companyContribution: doublePrecision('company_contribution').notNull().default(0),
    workerTopUp: doublePrecision('worker_top_up').notNull().default(0),
    fullCostDeduction: doublePrecision('full_cost_deduction').notNull().default(0),
    totalWorkerDeduction: doublePrecision('total_worker_deduction').notNull().default(0),
    workerCashPaid: doublePrecision('worker_cash_paid').notNull().default(0),
    netWorkerMealBalance: doublePrecision('net_worker_meal_balance').notNull().default(0),
    weekStart: date('week_start').notNull(),
    companyFullySponsored: text('company_fully_sponsored').default('No'),
    foodProviderId: integer('food_provider_id').references(() => supplier.id),
    actualPlateCost: doublePrecision('actual_plate_cost'),
    actualCompanyContribution: doublePrecision('actual_company_contribution'),
    workerRequiredContribution: doublePrecision('worker_required_contribution'),
    supplierPriceChanged: text('supplier_price_changed').default('No'),
    contributionChanged: text('contribution_changed').default('No'),
    reasonForChange: text('reason_for_change'),
    note: text('note'),
    approvedBy: text('approved_by'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('meal_code_idx').on(t.code),
    index('meal_worker_idx').on(t.workerId),
    index('meal_date_idx').on(t.date),
    index('meal_week_idx').on(t.weekStart),
  ],
);

export const deduction = pgTable(
  'deduction',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    workerId: integer('worker_id')
      .notNull()
      .references(() => worker.id),
    deductionType: text('deduction_type').notNull(),
    amount: doublePrecision('amount').notNull(),
    reason: text('reason'),
    approvedBy: text('approved_by'),
    /** Approved | Pending | Rejected */
    status: text('status').notNull().default('Pending'),
    notes: text('notes'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('deduction_code_idx').on(t.code),
    index('deduction_worker_idx').on(t.workerId),
  ],
);

export const expense = pgTable(
  'expense',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    date: date('date').notNull(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => supplier.id),
    expenseCategory: text('expense_category'),
    periodFrom: date('period_from'),
    periodTo: date('period_to'),
    plates: doublePrecision('plates'),
    plateCost: doublePrecision('plate_cost'),
    totalBill: doublePrecision('total_bill').notNull(),
    amountPaid: doublePrecision('amount_paid').notNull().default(0),
    accountPaidFrom: text('account_paid_from'),
    paymentMethod: text('payment_method'),
    transactionNo: text('transaction_no'),
    paidBy: text('paid_by'),
    notes: text('notes'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('expense_code_idx').on(t.code),
    index('expense_date_idx').on(t.date),
  ],
);

/* ========================================================================== *
 * MEAL ENGINE
 * ========================================================================== */

export const mealQualificationRule = pgTable(
  'meal_qualification_rule',
  {
    id: serial('id').primaryKey(),
    ruleId: text('rule_id').notNull(),
    processCode: text('process_code').notNull(),
    /** Daily | Weekly */
    ruleBasis: text('rule_basis').notNull(),
    /** item code, or 'ANY' */
    product: text('product'),
    /** > | >= */
    condition: text('condition'),
    threshold: doublePrecision('threshold'),
    weeklySmallMin: doublePrecision('weekly_small_min'),
    weeklyLargeMin: doublePrecision('weekly_large_min'),
    eatingDaysEarned: doublePrecision('eating_days_earned').notNull().default(0),
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('meal_rule_id_idx').on(t.ruleId)],
);

export const mealQualificationSummary = pgTable(
  'meal_qualification_summary',
  {
    id: serial('id').primaryKey(),
    workerId: integer('worker_id')
      .notNull()
      .references(() => worker.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    dailyDaysEarned: doublePrecision('daily_days_earned').notNull().default(0),
    tuftSmallWeek: doublePrecision('tuft_small_week').notNull().default(0),
    tuftLargeWeek: doublePrecision('tuft_large_week').notNull().default(0),
    tuftWeeklyDays: doublePrecision('tuft_weekly_days').notNull().default(0),
    finalDaysEarned: doublePrecision('final_days_earned').notNull().default(0),
    platesTaken: doublePrecision('plates_taken').notNull().default(0),
    qualifiedPlates: doublePrecision('qualified_plates').notNull().default(0),
    unqualifiedPlates: doublePrecision('unqualified_plates').notNull().default(0),
    companyContribution: doublePrecision('company_contribution').notNull().default(0),
    workerTopUp: doublePrecision('worker_top_up').notNull().default(0),
    fullCostDeductions: doublePrecision('full_cost_deductions').notNull().default(0),
    totalWorkerDeduction: doublePrecision('total_worker_deduction').notNull().default(0),
    expiredUnusedDays: doublePrecision('expired_unused_days').notNull().default(0),
    status: text('status'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('meal_summary_unique_idx').on(t.workerId, t.weekStart)],
);

/* ========================================================================== *
 * CONFIGURATION
 * ========================================================================== */

export const appSetting = pgTable(
  'app_setting',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    value: text('value'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('app_setting_key_idx').on(t.key)],
);

export const mealCostSetting = pgTable(
  'meal_cost_setting',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    value: text('value'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('meal_cost_key_idx').on(t.key)],
);

export const reportHeaderSetting = pgTable(
  'report_header_setting',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    value: text('value'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('report_header_key_idx').on(t.key)],
);

export const listOption = pgTable(
  'list_option',
  {
    id: serial('id').primaryKey(),
    /** e.g. "Movement Type", "Reject Reason", "Payment Method" */
    category: text('category').notNull(),
    value: text('value').notNull(),
    /** Movement Type carries its +1 / -1 stock sign here. */
    numericMeta: doublePrecision('numeric_meta'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('list_option_unique_idx').on(t.category, t.value)],
);

export const accountingMapping = pgTable(
  'accounting_mapping',
  {
    id: serial('id').primaryKey(),
    mappingKey: text('mapping_key').notNull(),
    debitAccount: text('debit_account'),
    creditAccount: text('credit_account'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('accounting_mapping_key_idx').on(t.mappingKey)],
);

/* ========================================================================== *
 * SYSTEM LOGS
 * ========================================================================== */

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    userId: integer('user_id').references(() => appUser.id),
    userName: text('user_name').notNull().default('(unknown)'),
    /** SETUP_CHANGE | RECORD | CORRECTION | VOID | RESTORE | LOGIN */
    action: text('action').notNull(),
    entity: text('entity'),
    refId: text('ref_id'),
    details: jsonb('details'),
    result: text('result').notNull().default('OK'),
  },
  (t) => [
    index('audit_ts_idx').on(t.timestamp),
    index('audit_action_idx').on(t.action),
  ],
);

export const reportLog = pgTable(
  'report_log',
  {
    id: serial('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    userId: integer('user_id').references(() => appUser.id),
    userName: text('user_name').notNull().default('(unknown)'),
    action: text('action').notNull().default('REPORT_GENERATED'),
    reportType: text('report_type').notNull(),
    period: text('period'),
    filters: text('filters'),
    note: text('note'),
    status: text('status').notNull().default('OK'),
    output: text('output'),
  },
  (t) => [index('report_log_ts_idx').on(t.timestamp)],
);

export const voidRegister = pgTable(
  'void_register',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    /** purchase | movement | operation | dispatch | meal | deduction | expense */
    logType: text('log_type').notNull(),
    entity: text('entity').notNull(),
    /** Stable primary key of the voided record — never renumbers. */
    sourceId: integer('source_id'),
    entryCode: text('entry_code'),
    reason: text('reason').notNull(),
    voidedById: integer('voided_by_id').references(() => appUser.id),
    voidedByName: text('voided_by_name').notNull().default('(unknown)'),
    /** Voided | Restored */
    status: text('status').notNull().default('Voided'),
    restoredAt: timestamp('restored_at', { withTimezone: true }),
    restoredByName: text('restored_by_name'),
    reversalEffect: text('reversal_effect'),
    oldValues: jsonb('old_values'),
  },
  (t) => [
    uniqueIndex('void_code_idx').on(t.code),
    index('void_source_idx').on(t.entity, t.sourceId),
  ],
);

export const batchRenameLog = pgTable('batch_rename_log', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  oldBatchNo: text('old_batch_no').notNull(),
  newBatchNo: text('new_batch_no').notNull(),
  itemCode: text('item_code'),
  oldPurchaseDate: date('old_purchase_date'),
  newPurchaseDate: date('new_purchase_date'),
  changedByName: text('changed_by_name').notNull().default('(unknown)'),
  reason: text('reason'),
  sourcePurchaseCode: text('source_purchase_code'),
  status: text('status').notNull().default('Applied'),
});

/* ========================================================================== *
 * SHARING
 * ========================================================================== */

/**
 * A link that opens the system without signing in, in either view-only or
 * normal mode.
 *
 * Only the SHA-256 of the token is stored, so the database never holds anything
 * that grants access — the full URL is shown once, at creation, and cannot be
 * recovered afterwards. Each link is backed by its own inactive app_user row so
 * that entries recorded through it still satisfy the created_by foreign keys and
 * are attributable in the Audit Log.
 */
export const shareLink = pgTable(
  'share_link',
  {
    id: serial('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    /** First few characters of the token, for identifying a row in the list. */
    tokenHint: text('token_hint').notNull(),
    /** TEAM | VIEW */
    mode: text('mode').notNull(),
    label: text('label'),
    guestUserId: integer('guest_user_id')
      .notNull()
      .references(() => appUser.id),
    createdById: integer('created_by_id').references(() => appUser.id),
    createdByName: text('created_by_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null means the link never expires — it lasts until it is revoked. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByName: text('revoked_by_name'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    uses: integer('uses').notNull().default(0),
  },
  (t) => [uniqueIndex('share_link_token_idx').on(t.tokenHash)],
);

/* ========================================================================== *
 * Inferred types
 * ========================================================================== */

export type ShareLink = typeof shareLink.$inferSelect;
export type Item = typeof item.$inferSelect;
export type Supplier = typeof supplier.$inferSelect;
export type Worker = typeof worker.$inferSelect;
export type Process = typeof process.$inferSelect;
export type PieceRate = typeof pieceRate.$inferSelect;
export type Purchase = typeof purchase.$inferSelect;
export type Batch = typeof batch.$inferSelect;
export type InventoryMovement = typeof inventoryMovement.$inferSelect;
export type ProductionOperation = typeof productionOperation.$inferSelect;
export type Dispatch = typeof dispatch.$inferSelect;
export type Meal = typeof meal.$inferSelect;
export type Deduction = typeof deduction.$inferSelect;
export type Expense = typeof expense.$inferSelect;
export type MealQualificationRule = typeof mealQualificationRule.$inferSelect;
export type ListOption = typeof listOption.$inferSelect;
export type AppUser = typeof appUser.$inferSelect;
export type VoidRegister = typeof voidRegister.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
