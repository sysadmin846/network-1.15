import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    name: 'MonitorDashboard',
    path: '/monitor/dashboard',
    component: () => import('#/views/monitor/dashboard/index.vue'),
    meta: {
      affixTab: true,
      icon: 'lucide:monitor',
      order: 1,
      title: $t('page.monitor.dashboard'),
    },
  },
  {
    name: 'MonitorQuery',
    path: '/monitor/query',
    component: () => import('#/views/monitor/query/index.vue'),
    meta: {
      icon: 'lucide:search',
      order: 2,
      title: $t('page.monitor.query'),
    },
  },
];

export default routes;
