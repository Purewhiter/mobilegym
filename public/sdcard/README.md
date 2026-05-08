# 虚拟 SD 卡

此目录**直接映射**到模拟器的 `/sdcard`。

## 使用方法

```
public/sdcard/任意路径  =  /sdcard/任意路径
```

把文件放进来就行，系统自动识别。

## 目录结构参考

```
public/sdcard/
├── Alarms/              # 闹钟铃声
├── Android/             # 应用私有数据
│   ├── data/
│   └── media/
├── Audiobooks/          # 有声读物
├── DCIM/
│   ├── Camera/          # 相机照片
│   └── Screenshots/     # 截图
├── Documents/           # 文档
├── Download/            # 下载
├── Movies/              # 视频
├── Music/               # 音乐
├── Notifications/       # 通知铃声
├── Pictures/            # 图片
├── Podcasts/            # 播客
└── Ringtones/           # 来电铃声
```

## 扫描

开发模式下通过 `/api/sdcard` 扫描目录，：

- 拖放/修改文件到这里
- 在浏览器控制台执行 `__SIM_FS__.reset()` 重新导入（会清空当前 IndexedDB 文件系统）
