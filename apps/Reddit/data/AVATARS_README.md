# Reddit 真实头像说明

## 概述

本项目为 Reddit App 的所有用户配置了真实的头像图片。头像使用 DiceBear API 的 avataaars 风格生成，每个用户基于用户名有唯一且稳定的头像。

## 文件结构

```
public/reddit/avatars/
├── avatar_*.png        # 用户头像（291个唯一用户）
└── avatar_me.png       # 当前用户头像（xiaoming-ai）
```

## 头像特点

- **唯一性**：每个用户名对应唯一头像（基于 MD5 哈希）
- **稳定性**：相同用户在任何时候都会得到相同头像
- **真实感**：avataaars 风格类似 Bitmoji，具有卡通人物形象
- **离线可用**：头像已下载到本地，无需网络连接

## 使用方法

### 首次运行（已完成）

```bash
# 下载所有真实头像并更新配置
node download_real_avatars.mjs
```

该脚本会：
1. 提取配置文件中的所有作者
2. 为每个作者下载唯一头像到 `public/reddit/avatars/`
3. 更新 `redditConfig.ts` 中的 `authorAvatar` 路径
4. 更新用户头像

### 日常开发

头像已下载到本地，直接运行项目即可看到效果：

```bash
npm run dev
```

## 头像显示位置

根据截图和代码分析，头像会显示在：

1. **帖子列表** - 每个帖子作者的头像
   - 位置：帖子头部，紧邻作者用户名
   - 大小：16x16px（小头像）

2. **顶部导航栏** - 当前用户头像
   - 位置：右上角，带在线状态指示
   - 大小：32x32px（中等头像）

3. **右侧栏** - 社区成员头像（如有需要）
   - 位置：热门社区列表
   - 大小：32x32px

## 技术实现

### 数据结构

配置文件中每个帖子包含：

```typescript
{
  author: 'u/CelesteAvant',
  authorAvatar: '/reddit/avatars/avatar_f3840951.png',
  // ... 其他字段
}
```

### DOM 渲染

HomePage.tsx 中的实现（第327-332行）：

```tsx
{(post as any).authorAvatar ? (
  <img src={(post as any).authorAvatar} className="w-4 h-4 rounded-full" alt="" />
) : (
  <div className="w-4 h-4 rounded-full bg-gray-200"></div>
)}
```

### 头像映射规则

```javascript
// 基于用户名生成哈希
const hash = crypto.createHash('md5')
  .update(username)
  .digest('hex')
  .substring(0, 8);

// 头像文件名
const filename = `avatar_${hash}.png`;
```

## 重新生成头像

如果需要更新头像样式或重新下载：

```bash
# 使用不同的头像风格
# 编辑 download_real_avatars.mjs，修改 AVATAR_STYLE
const AVATAR_STYLE = 'avataaars';  // 或 'bottts', 'personas', 'identicon' 等

# 删除旧头像（可选）
rm public/reddit/avatars/avatar_*.png

# 重新下载
node download_real_avatars.mjs
```

## 可用头像风格

DiceBear 支持多种头像风格：

- **avataaars** ✓ - 类似 Bitmoji 的卡通人物（当前使用）
- **bottts** - 机器人风格
- **personas** - 多样化人物
- **identicon** - 几何图案
- **initials** - 首字母

## 统计信息

- **唯一作者数量**: 291
- **帖子总数**: 300
- **头像文件总数**: 292（291个用户 + 1个当前用户）
- **头像尺寸**: 200x200px
- **头像格式**: PNG
- **总文件大小**: 约 2-3 MB

## 注意事项

1. **首次下载需要网络连接**
   - 脚本需要访问 DiceBear API
   - 下载完成后完全离线可用

2. **头像一致性**
   - 相同用户名总是生成相同头像
   - 不要手动修改头像文件名

3. **性能优化**
   - 头像已本地化，加载速度快
   - 使用 `rounded-full` 类实现圆形显示

4. **符合项目规范**
   - 头像路径使用 `/reddit/avatars/` 前缀
   - 配置文件位于 `apps/Reddit/data/redditConfig.ts`
   - 图片资源位于 `public/reddit/avatars/`

## 维护

### 添加新用户

新增帖子时，确保包含 `authorAvatar` 字段：

```typescript
{
  author: 'u/NewUser',
  authorAvatar: '/reddit/avatars/avatar_[hash].png',
  // ... 其他字段
}
```

然后运行脚本下载新用户头像：

```bash
node download_real_avatars.mjs
```

### 更新统计

```bash
# 查看头像数量
ls public/reddit/avatars/avatar_*.png | wc -l

# 查看配置中的作者数量
grep -o "author: 'u/" apps/Reddit/data/redditConfig.ts | wc -l
```

## 相关文件

- `download_real_avatars.mjs` - 头像下载脚本（Node.js）
- `download_real_avatars.py` - 头像下载脚本（Python，备用）
- `update_real_avatars.cjs` - 旧版脚本（仅更新 URL，不下载）
- `redditConfig.ts` - Reddit 配置文件
- `HomePage.tsx` - 主页渲染组件

## API 参考

DiceBear API: https://api.dicebear.com/9.x/avataaars/png

参数：
- `seed` - 用户名（去除 'u/' 前缀）
- `size` - 图片尺寸（200px）
- `backgroundColor` - 背景色（b6e3f4,c0aede,d1d4f9）

## 作者

- 实现日期：2026-01-27
- 实现方式：基于 DiceBear API 的真实头像下载方案
