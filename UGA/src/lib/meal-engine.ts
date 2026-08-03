/**
 * Production meal qualification.
 *
 * Eating days are EARNED from recorded production and expire at the end of the
 * working week. This implements the 26 rules held in Meal Qualification
 * Settings: daily thresholds per process, plus the weekly TUFT tier ladder.
 */

import { addDays, monthOf, weekEnd, weekStart, type IsoDate } from './dates';
import type { Snapshot } from './core';

export type Qualification = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  dailyDaysEarned: number;
  tuftSmallWeek: number;
  tuftLargeWeek: number;
  tuftWeeklyDays: number;
  finalDaysEarned: number;
  daysUsed: number;
  daysRemaining: number;
};

const SMALL = 'BR-S';
const LARGE = ['BR-L', 'BR-CUSTOM'];

function meets(condition: string | null, value: number, threshold: number): boolean {
  if (condition === '>') return value > threshold;
  return value >= threshold; // default ">="
}

/**
 * Eating days a worker earned in the week containing `onDate`.
 */
export function qualificationFor(
  snap: Snapshot,
  workerId: number,
  onDate: IsoDate,
): Qualification {
  const ws = weekStart(onDate, snap.weekStartsOn);
  const we = weekEnd(onDate, snap.weekStartsOn);

  const rules = snap.mealRules ?? [];
  const maxPerDay = snap.mealNumber('Max eating days per worker per day', 1);
  const workingDays = snap.mealNumber('Working days per week', 6);
  const maxPerWeekRaw = snap.mealSetting('Max eating days per worker per week');
  const maxPerWeek =
    maxPerWeekRaw && Number.isFinite(Number(maxPerWeekRaw)) ? Number(maxPerWeekRaw) : workingDays;
  const combine = (snap.mealSetting('Combine Meal Qualification Rules (Max / Add)') ?? 'Max').trim();

  const weekOps = snap.operations.filter(
    (o) => o.workerId === workerId && o.date >= ws && o.date <= we,
  );

  /* ------------------------------------------------------------- daily --- */
  let dailyDaysEarned = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const dayOps = weekOps.filter((o) => o.date === day);
    if (!dayOps.length) continue;

    let earnedToday = 0;
    for (const rule of rules) {
      if (!rule.active || rule.ruleBasis !== 'Daily') continue;

      const qtyForRule = dayOps
        .filter((o) => {
          const procCode = snap.processById.get(o.processId)?.code;
          if (procCode !== rule.processCode) return false;
          const productCode = snap.itemById.get(o.productItemId)?.code;
          const target = rule.product ?? 'ANY';
          return target === 'ANY' || target === productCode;
        })
        .reduce((acc, o) => acc + o.acceptedQty, 0);

      if (qtyForRule <= 0) continue;
      if (meets(rule.condition, qtyForRule, rule.threshold ?? 0)) {
        earnedToday = Math.max(earnedToday, rule.eatingDaysEarned);
      }
    }
    dailyDaysEarned += Math.min(earnedToday, maxPerDay);
  }

  /* ------------------------------------------------------------ weekly --- */
  const tuftOps = weekOps.filter((o) => snap.processById.get(o.processId)?.code === 'TUFT');
  const tuftSmallWeek = tuftOps
    .filter((o) => snap.itemById.get(o.productItemId)?.code === SMALL)
    .reduce((acc, o) => acc + o.acceptedQty, 0);
  const tuftLargeWeek = tuftOps
    .filter((o) => LARGE.includes(snap.itemById.get(o.productItemId)?.code ?? ''))
    .reduce((acc, o) => acc + o.acceptedQty, 0);

  let tuftWeeklyDays = 0;
  for (const rule of rules) {
    if (!rule.active || rule.ruleBasis !== 'Weekly' || rule.processCode !== 'TUFT') continue;
    const needSmall = rule.weeklySmallMin ?? 0;
    const needLarge = rule.weeklyLargeMin ?? 0;
    const okSmall = needSmall <= 0 || tuftSmallWeek >= needSmall;
    const okLarge = needLarge <= 0 || tuftLargeWeek >= needLarge;
    // A tier with both minimums set requires both to be met.
    if (okSmall && okLarge && (needSmall > 0 || needLarge > 0)) {
      tuftWeeklyDays = Math.max(tuftWeeklyDays, rule.eatingDaysEarned);
    }
  }

  /* ----------------------------------------------------------- combine --- */
  const combined =
    combine.toLowerCase() === 'add'
      ? dailyDaysEarned + tuftWeeklyDays
      : Math.max(dailyDaysEarned, tuftWeeklyDays);

  const finalDaysEarned = Math.min(combined, maxPerWeek);

  /* -------------------------------------------------------------- used --- */
  const daysUsed = snap.meals
    .filter((m) => m.workerId === workerId && m.date >= ws && m.date <= we)
    .reduce((acc, m) => acc + m.qualifiedPlates, 0);

  return {
    weekStart: ws,
    weekEnd: we,
    dailyDaysEarned,
    tuftSmallWeek,
    tuftLargeWeek,
    tuftWeeklyDays,
    finalDaysEarned,
    daysUsed,
    daysRemaining: Math.max(0, finalDaysEarned - daysUsed),
  };
}

/* ========================================================================== *
 * Costing
 * ========================================================================== */

export type MealCosting = {
  qualifiedPlates: number;
  unqualifiedPlates: number;
  companyContribution: number;
  workerTopUp: number;
  fullCostDeduction: number;
  totalWorkerDeduction: number;
  netWorkerMealBalance: number;
  workerRequiredContribution: number;
  plateCost: number;
  qualified: 'Yes' | 'No' | 'Partly';
};

/**
 * Split a plate count into qualified/unqualified and price it.
 *
 * DEVIATION 1: the net balance carried into payroll is
 *   max(0, total worker deduction − cash already paid)
 * The sheet instead used the flat per-plate cap, which ignored plate count and
 * under-recovered whenever a worker took more than one unqualified plate.
 */
export function costMeal(
  snap: Snapshot,
  opts: {
    plateCount: number;
    daysRemaining: number;
    workerCashPaid?: number;
    plateCostOverride?: number | null;
    companyContributionOverride?: number | null;
    companyFullySponsored?: boolean;
  },
): MealCosting {
  const plateCost = opts.plateCostOverride ?? snap.mealNumber('Plate cost (UGX)', 2500);
  const companyPerQualified =
    opts.companyContributionOverride ??
    snap.mealNumber('Company top-up per qualified plate (UGX)', 1500);
  const workerPerQualified = snap.mealNumber('Worker top-up per qualified plate (UGX)', 1000);
  const cap = snap.mealNumber('Default Worker Contribution cap per qualified plate (UGX)', 1000);
  const applyCap =
    (snap.mealSetting('Apply Worker Contribution cap? (Yes/No)') ?? 'Yes').toLowerCase() === 'yes';
  const companyPaysUnqualified =
    (snap.mealSetting('Company contributes to unqualified plate?') ?? 'No').toLowerCase() === 'yes';
  const fullCostIfUnqualified =
    (snap.mealSetting('Full plate cost charged to worker if unqualified?') ?? 'Yes').toLowerCase() ===
    'yes';

  const plates = Math.max(0, opts.plateCount);
  const qualifiedPlates = Math.min(plates, Math.max(0, opts.daysRemaining));
  const unqualifiedPlates = plates - qualifiedPlates;

  // Worker's share of a qualified plate, capped when the policy says so.
  const requiredPerQualified = applyCap
    ? Math.min(Math.max(0, plateCost - companyPerQualified), cap)
    : workerPerQualified;

  const fullySponsored = opts.companyFullySponsored === true;

  const companyContribution = fullySponsored
    ? plates * plateCost
    : qualifiedPlates * companyPerQualified +
      (companyPaysUnqualified ? unqualifiedPlates * companyPerQualified : 0);

  const workerTopUp = fullySponsored ? 0 : qualifiedPlates * requiredPerQualified;

  const fullCostDeduction = fullySponsored
    ? 0
    : unqualifiedPlates * (fullCostIfUnqualified ? plateCost : Math.max(0, plateCost - companyPerQualified));

  const totalWorkerDeduction = workerTopUp + fullCostDeduction;
  const netWorkerMealBalance = Math.max(0, totalWorkerDeduction - (opts.workerCashPaid ?? 0));

  return {
    qualifiedPlates,
    unqualifiedPlates,
    companyContribution,
    workerTopUp,
    fullCostDeduction,
    totalWorkerDeduction,
    netWorkerMealBalance,
    workerRequiredContribution: requiredPerQualified,
    plateCost,
    qualified:
      qualifiedPlates === 0 ? 'No' : unqualifiedPlates === 0 ? 'Yes' : 'Partly',
  };
}

/* ========================================================================== *
 * Weekly summary
 * ========================================================================== */

export type WeeklyMealSummary = {
  workerId: number;
  worker: string;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  dailyDaysEarned: number;
  tuftSmallWeek: number;
  tuftLargeWeek: number;
  tuftWeeklyDays: number;
  finalDaysEarned: number;
  platesTaken: number;
  qualifiedPlates: number;
  unqualifiedPlates: number;
  companyContribution: number;
  workerTopUp: number;
  fullCostDeductions: number;
  totalWorkerDeduction: number;
  expiredUnusedDays: number;
  status: string;
};

/** Every worker/week that has either production or meals recorded. */
export function weeklyMealSummaries(snap: Snapshot, month?: string): WeeklyMealSummary[] {
  const keys = new Set<string>();

  for (const o of snap.operations) {
    if (month && monthOf(o.date) !== month) continue;
    keys.add(`${o.workerId}|${weekStart(o.date, snap.weekStartsOn)}`);
  }
  for (const m of snap.meals) {
    if (month && monthOf(m.date) !== month) continue;
    keys.add(`${m.workerId}|${weekStart(m.date, snap.weekStartsOn)}`);
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return [...keys]
    .map((key) => {
      const [workerIdRaw, ws] = key.split('|');
      const workerId = Number(workerIdRaw);
      const q = qualificationFor(snap, workerId, ws);
      const rows = snap.meals.filter(
        (m) => m.workerId === workerId && m.date >= q.weekStart && m.date <= q.weekEnd,
      );

      const qualifiedPlates = rows.reduce((a, m) => a + m.qualifiedPlates, 0);
      const closed = q.weekEnd < todayIso;

      return {
        workerId,
        worker: snap.workerById.get(workerId)?.name ?? `#${workerId}`,
        weekStart: q.weekStart,
        weekEnd: q.weekEnd,
        dailyDaysEarned: q.dailyDaysEarned,
        tuftSmallWeek: q.tuftSmallWeek,
        tuftLargeWeek: q.tuftLargeWeek,
        tuftWeeklyDays: q.tuftWeeklyDays,
        finalDaysEarned: q.finalDaysEarned,
        platesTaken: rows.reduce((a, m) => a + m.plateCount, 0),
        qualifiedPlates,
        unqualifiedPlates: rows.reduce((a, m) => a + m.unqualifiedPlates, 0),
        companyContribution: rows.reduce((a, m) => a + m.companyContribution, 0),
        workerTopUp: rows.reduce((a, m) => a + m.workerTopUp, 0),
        fullCostDeductions: rows.reduce((a, m) => a + m.fullCostDeduction, 0),
        totalWorkerDeduction: rows.reduce((a, m) => a + m.totalWorkerDeduction, 0),
        expiredUnusedDays: closed ? Math.max(0, q.finalDaysEarned - qualifiedPlates) : 0,
        status: closed ? 'Week closed — unused days expired' : 'Week open',
      };
    })
    .sort((a, b) => (a.weekStart === b.weekStart ? a.worker.localeCompare(b.worker) : a.weekStart < b.weekStart ? 1 : -1));
}
