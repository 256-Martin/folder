/** Navigation map. Every tab of the original workbook has a home here. */

export type NavItem = {
  href: string;
  label: string;
  /** Icon name from the set in components/icons.tsx. */
  icon: string;
  /** Minimum role needed to see the link. */
  role?: 'ADMIN' | 'TEAM' | 'VIEW';
  sheet?: string;
};

export type NavGroup = {
  label: string;
  icon: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    icon: 'grid',
    items: [{ href: '/', icon: 'grid', label: 'Dashboard', sheet: 'Dashboard' }],
  },
  {
    label: 'Record',
    icon: 'plus',
    items: [
      { href: '/purchases', icon: 'cart', label: 'Purchases', sheet: 'Purchases Log' },
      { href: '/inventory', icon: 'bookOpen', label: 'Inventory Ledger', sheet: 'Inventory Ledger' },
      { href: '/batches', icon: 'layers', label: 'Batch Register', sheet: 'Batch Register' },
      { href: '/production', icon: 'factory', label: 'Production Operations', sheet: 'Production Operations Log' },
      { href: '/dispatch', icon: 'truck', label: 'Sales & Dispatch', sheet: 'Sales - Dispatch Log' },
      { href: '/meals', icon: 'utensils', label: 'Meals', sheet: 'Meal Log' },
      { href: '/deductions', icon: 'minusCircle', label: 'Deductions', sheet: 'Deductions Log' },
      { href: '/expenses', icon: 'receipt', label: 'Expenses & Providers', sheet: 'Expense & Provider Payments' },
    ],
  },
  {
    label: 'Stock & WIP',
    icon: 'box',
    items: [
      { href: '/wip', icon: 'activity', label: 'WIP Summary', sheet: 'WIP Summary' },
      { href: '/stock/materials', icon: 'box', label: 'Material Stock', sheet: 'Material Stock Summary' },
      { href: '/stock/handles', icon: 'component', label: 'Handle Stock', sheet: 'Handle Stock Summary' },
      { href: '/stock/ustaples', icon: 'paperclip', label: 'U-Staple Stock', sheet: 'U-Staple Stock Summary' },
      { href: '/stock/finished', icon: 'packageCheck', label: 'Finished Goods', sheet: 'Finished Goods Stock' },
    ],
  },
  {
    label: 'Labour & Pay',
    icon: 'users',
    items: [
      { href: '/labour', icon: 'hardHat', label: 'Direct Labour', sheet: 'Direct Labour Summary' },
      { href: '/productivity', icon: 'trendingUp', label: 'Worker Productivity', sheet: 'Worker Productivity' },
      { href: '/meals/qualification', icon: 'award', label: 'Meal Qualification', sheet: 'Meal Qualification Summary' },
      { href: '/meals/deductions', icon: 'wallet', label: 'Meal Deductions', sheet: 'Meal Deductions Summary' },
      { href: '/payments', icon: 'banknote', label: 'Final Worker Payment', sheet: 'Final Worker Payment Summary' },
    ],
  },
  {
    label: 'Analytics',
    icon: 'chart',
    items: [
      { href: '/scorecard', icon: 'target', label: 'Supplier & Batch Scorecard', sheet: 'Supplier & Batch Scorecard' },
      { href: '/reports', icon: 'print', label: 'Reports & Print Centre', sheet: 'Print View / Export View' },
    ],
  },
  {
    label: 'Master Data',
    icon: 'database',
    items: [
      { href: '/masters/items', icon: 'tag', label: 'Items', role: 'ADMIN', sheet: 'Item Master' },
      { href: '/masters/suppliers', icon: 'store', label: 'Suppliers', role: 'ADMIN', sheet: 'Supplier Master' },
      { href: '/masters/workers', icon: 'users', label: 'Workers', role: 'ADMIN', sheet: 'Worker Master' },
      { href: '/masters/processes', icon: 'route', label: 'Processes', role: 'ADMIN', sheet: 'Process Master' },
      { href: '/masters/skills', icon: 'star', label: 'Worker Skills', role: 'ADMIN', sheet: 'Worker Process Skills' },
      { href: '/masters/rates', icon: 'calculator', label: 'Piece Rates', role: 'ADMIN', sheet: 'Piece Rate Settings' },
    ],
  },
  {
    label: 'Settings',
    icon: 'settings',
    items: [
      { href: '/settings', icon: 'settings', label: 'System Settings', role: 'ADMIN', sheet: 'Settings' },
      { href: '/settings/meal-cost', icon: 'coins', label: 'Meal Cost', role: 'ADMIN', sheet: 'Meal Cost Settings' },
      { href: '/settings/meal-rules', icon: 'listChecks', label: 'Meal Qualification Rules', role: 'ADMIN', sheet: 'Meal Qualification Settings' },
      { href: '/settings/lists', icon: 'list', label: 'Lists & Dropdowns', role: 'ADMIN', sheet: 'Lists' },
      { href: '/settings/accounting', icon: 'download', label: 'Accounting Export', role: 'ADMIN', sheet: 'Accounting Export Settings' },
      { href: '/settings/report-header', icon: 'fileText', label: 'Report Header', role: 'ADMIN', sheet: 'Report Header Settings' },
    ],
  },
  {
    label: 'System',
    icon: 'shield',
    items: [
      { href: '/system/data-issues', icon: 'alert', label: 'Data Issues', sheet: 'Data Issues' },
      { href: '/system/audit', icon: 'clock', label: 'Audit Log', role: 'ADMIN', sheet: 'Audit Log' },
      { href: '/system/reports-log', icon: 'clipboard', label: 'Report Log', role: 'ADMIN', sheet: 'Report Log' },
      { href: '/system/voids', icon: 'ban', label: 'Void Register', role: 'ADMIN', sheet: 'Void Register' },
      { href: '/system/batch-renames', icon: 'edit', label: 'Batch Renames', role: 'ADMIN', sheet: 'Batch Rename Log' },
      { href: '/help', icon: 'help', label: 'Help & Change Log', sheet: 'Home / Instructions' },
    ],
  },
];

export function visibleNav(role: string | undefined): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.role || i.role === role || role === 'ADMIN'),
  })).filter((g) => g.items.length > 0);
}
