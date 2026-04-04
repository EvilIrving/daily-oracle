# 多语言支持 TODO

## 目标语言

覆盖约 70-75% 全球网民，共 9 种语言：

| 优先级 | 语言 | 代码 | 备注 |
|--------|------|------|------|
| P0 | 简体中文 | zh-Hans | 大陆 + 新马 |
| P0 | 繁体中文 | zh-Hant | 港澳台 + 海外华人 |
| P0 | 英语 | en | 全球通用 |
| P1 | 日语 | ja | 日本 |
| P1 | 韩语 | ko | 韩国 + 朝鲜 |
| P1 | 西班牙语 | es | 拉美 + 西班牙 |
| P2 | 法语 | fr | 法国 + 非洲 + 加拿大 |
| P2 | 德语 | de | 德国 + 奥地利 + 瑞士 |
| P2 | 俄语 | ru | 俄罗斯 + 东欧 |

---

## App 层 (SwiftUI)

- [ ] 配置 `Localizable.xcstrings` 或 `.strings` 文件
- [ ] P0: 简中、繁体、英文 UI 文案本地化
- [ ] P1: 日/韩/西班牙语 UI 文案
- [ ] P2: 法/德/俄语 UI 文案
- [ ] 德语：预留文案长度弹性（单词超长）
- [ ] 俄语：预留 +30% 长度
- [ ] 日韩：中文字体优化

---

## 内容层 (名句/宜忌)

### Schema 变更

```sql
-- 名句表 / 宜忌表 需要增加：
original_language TEXT  -- 原著语言（如 "de" 表示歌德原文是德语）
language TEXT           -- 当前记录的语言（用户看到的语言）
```

### 内容隔离原则

- 德语用户只看德语内容（歌德、尼采等）
- 西班牙语用户只看西语内容（博尔赫斯、马尔克斯等）
- **不允许**德语用户看到法语或俄语内容

### 工作台生产侧

- [ ] 书目上传增加 `language` 字段
- [ ] 名句提取时标记 `original_language` + `language`
- [ ] 审核队列按语言过滤

### Edge Function

- [ ] `daily-oracle` 接口增加 `language` 参数
- [ ] 返回内容按 `WHERE language = :user_language` 过滤

---

## 工作流

1. 文案集中管理，用 `LocalizedStringKey` 或 Swift 6 `Translatable` 协议
2. 用 `stringsextract` 自动生成 `.strings` 模板
3. 翻译走 Crowdin / Lokalise / Phrase 平台
4. 加伪语言模式测 UI 溢出

---

## 参考

- 覆盖人口：~70-75% 全球网民
- 技术成本：9 套 `.strings` 文件 + CJK 字体优化
- 内容策略：母语内容优先，翻译作品作补充
