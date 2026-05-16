# .debug-archive/

> `debug-checklist` skill 的输出归宿。一次调试症状对应一份 markdown 存档。

## 文件命名

`YYYY-MM-DD-HHMM-<slug>.md`，slug 从症状关键词派生（max 40 字符，全小写连字符）。

例：`2026-05-12-1430-can-loss-on-startup.md`

## Schema

由 `.agents/skills/debug-checklist/SKILL.md` 定义。每份文件含：

- frontmatter：`date` / `symptom` / `project` / `relatedCommits` / `relatedFiles` / `status`
- 正文：生成的检查清单原样保存
- 可选追加：用户事后填写的"实际查到的"

## 维护

- `status` 字段由用户手动改：`open` / `resolved` / `abandoned`。skill 不主动改已存档文件。
- 不要在这里删旧文件——它是 Trail facet 的原料。

## 边界

- 这里**只存** debug-checklist 的产出，**不放**：
  - 个人日报/周报（→ `docs/daily/`）
  - dogfood 反馈（→ `docs/dogfood/`）
  - v0.3 InvestigationRecord 等 pre-pivot 数据
- 不存任何含密钥 / token / 远端凭据的内容。
