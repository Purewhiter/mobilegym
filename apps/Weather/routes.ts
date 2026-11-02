import { defineRoutes } from '../../os/navigation/routes';

/** Weather's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['more'] }, description: '天气首页', states: { 'menu=more': '首页更多菜单' } },
  settings: { path: '/settings', search: { 'picker': ['pressure', 'temp', 'wind'] }, description: '天气设置页', states: { 'picker=temp': '天气设置-温度单位选择', 'picker=wind': '天气设置-风力单位选择', 'picker=pressure': '天气设置-气压单位选择' } },
  settingsPrivacy: { path: '/settings/privacy', description: '隐私设置页' },
  settingsPermissions: { path: '/settings/permissions', description: '权限说明页' },
  cities: { path: '/cities', description: '城市管理页' },
  citiesSearch: { path: '/cities/search', description: '城市搜索页' },
  citiesPreview: { path: '/cities/preview', description: '城市预览页' },
  forecastDaily: { path: '/forecast/daily', description: '15日天气预报页' },
  airquality: { path: '/airquality', description: '空气质量详情页' },
});
