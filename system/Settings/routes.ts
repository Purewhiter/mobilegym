import { defineRoutes } from '../../os/navigation/routes';

/** Settings's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '设置首页' },
  search: { path: '/search', description: '设置搜索页' },
  page: {
    path: '/page/:pageId',
    search: { dialog: ['ssid', 'password', 'connect', 'btName', 'value', 'list'] },
    description: '设置详情页',
    states: {
      'dialog=ssid': '添加网络 - 网络名称', 'dialog=password': '添加网络 - 密码', 'dialog=connect': '连接 WLAN - 密码',
      'dialog=btName': '蓝牙设备名称', 'dialog=value': '编辑设置值', 'dialog=list': '选择设置值',
    },
  },
});
