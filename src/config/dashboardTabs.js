export const DASHBOARD_TABS = [
  {
    id: 'overview',
    group: 'main',
    labelKey: 'tabs.overview',
    defaultLabel: 'Overview',
    titleKey: 'Project Overview',
    defaultTitle: 'Project Overview',
    subtitleKey: 'Connected to Live Database',
    defaultSubtitle: 'Connected to Live Database',
  },
  {
    id: 'farm-create',
    group: 'main',
    labelKey: 'tabs.mapping',
    defaultLabel: 'Field Mapping',
    titleKey: 'Farm Setup',
    defaultTitle: 'Farm Setup',
    subtitleKey: 'Draw your farm border on the map.',
    defaultSubtitle: 'Draw your farm border on the map.',
  },
  {
    id: 'farm-edit',
    group: 'main',
    labelKey: 'tabs.farm_edit',
    defaultLabel: 'Farm Edit',
    titleKey: 'tabs.farm_edit',
    defaultTitle: 'Farm Edit',
    subtitleKey: 'Edit or delete existing farms.',
    defaultSubtitle: 'Edit or delete existing farms.',
  },
  {
    id: 'plants',
    group: 'main',
    labelKey: 'tabs.plants',
    defaultLabel: 'Plants Inventory',
    titleKey: 'Plants Inventory',
    defaultTitle: 'Plants Inventory',
    subtitleKey: 'Search and browse plants.',
    defaultSubtitle: 'Search and browse plants.',
  },
  {
    id: 'configuration',
    group: 'bottom',
    labelKey: 'tabs.settings',
    defaultLabel: 'Theme & Settings',
    titleKey: 'Settings',
    defaultTitle: 'Settings',
    subtitleKey: 'Manage themes and preferences.',
    defaultSubtitle: 'Manage themes and preferences.',
  },
];

export const DEFAULT_TAB_ID = 'overview';

export function getDashboardTab(tabId) {
  return DASHBOARD_TABS.find((tab) => tab.id === tabId) || DASHBOARD_TABS[0];
}