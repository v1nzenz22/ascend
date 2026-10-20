# CLAUDE.md

本文件指导 Claude Code 在本仓库中的工作方式。

## 项目

ascend 是一个面向所有人的极简卡路里与营养追踪应用。手机优先（先 iPhone），桌面浏览器中作为仪表盘使用。离线优先，零遥测，数据只存在用户设备本地。之前的浏览器项目已经放弃；`design/` 中的旧素材保留原样，作为设计历史。

阶段计划见 `ROADMAP.md`。一次只做一个阶段，每个阶段结束都要构建、测试，再向用户汇报。

## 语言规则（最重要）

- 和用户的所有对话、提问、计划和汇报：**只用德语**。用户称呼你为 **Klot**。
- 内部工作用**中文**：内部笔记、子代理之间的任务说明和交接、本文件、`.claude/agents/` 中的定义。
- 代码、变量名、注释、提交信息：**英语**。仓库文档（README、ROADMAP、`docs/`）也用英语。
- 应用界面：先做**德语**，所有文字走 i18n 模块，为多语言做好准备。
- 用户是初学者：在聊天和注释中解释「为什么」，优先简单易读的代码。

## 隐私与安全（硬性规则）

1. **零遥测**：应用、构建脚本和依赖都不得发送使用数据；没有第三方追踪、分析或崩溃上报 SDK。
2. **数据只存本地**：默认只存在设备的 IndexedDB 中，没有账号，没有云同步。
3. **外部请求只能由用户主动触发**：例如点击「搜索」或扫码时请求 Open Food Facts。输入时不自动搜索；先查本地缓存。
4. **不用 CDN**：字体用系统字体，wasm、图标等资源随应用一起部署。
5. **密钥不进仓库**：代码和 Git 历史中不得有 API 密钥、token 或 `.env`。
6. **仓库中没有个人数据**：没有真实姓名、邮箱（提交使用 GitHub noreply 地址）、主目录路径、非回环 IP。`.githooks/pre-commit` 会强制检查（每个克隆执行一次 `git config core.hooksPath .githooks`）。私人关键词写在 `.git/info/personal-patterns`，绝不写进被跟踪的文件。

任何可能导致用户未触发的网络请求的改动：先停下来问用户。

> **计划中的变更（待用户决定）**：用户希望增加**不需要邮箱的私密账号**，用于端到端加密同步和设备连接；记录仍可完全离线。方案见 `docs/design/account-and-sync.md`（第 9.1 节有新的隐私条文草稿，第 12 节是待决定的问题）。在用户批准之前，上面的规则 2（无账号）继续有效，不要实现账号或服务器功能。

## 技术栈

- **PWA**：Vite + TypeScript（strict），不用 UI 框架。
- **存储**：IndexedDB，通过 Dexie。
- **离线**：vite-plugin-pwa（Workbox）生成 Service Worker 和 manifest。
- **条形码**：`barcode-detector`（zxing-wasm），wasm 文件自托管。
- **图表**：自己用 SVG 绘制，不引入图表库。
- **i18n**：自建小模块 + `Intl`（日期、数字、单位）。
- **测试**：vitest（逻辑）、Playwright（iPhone/WebKit、桌面/Chromium、离线）。
- **外部数据**：Open Food Facts（ODbL）。必须显示署名 "Contains data from Open Food Facts"，单位以 `_100g` 字段为准，kcal 缺失时由 kJ ÷ 4.184 换算。

上述依赖在对应阶段由用户批准后才安装（见下文「依赖」）。

## 目录结构（第 2 阶段起逐步建立）

```
src/            应用代码（app、db、i18n、features/*、ui/*）
src/i18n/       翻译文件（de 为默认）
public/         图标、manifest 资源、自托管 wasm
tests/unit/     vitest 测试
tests/e2e/      Playwright 测试；tests/fixtures/ 放模拟的 OFF 响应
docs/design/    architect 写的设计文档（英文）
design/         Logo、设计 token、模板、设计历史（不要修改旧素材）
design/figcraft FigCraft 设计文件与导出
.claude/        子代理、钩子、技能、设置
.githooks/      防止个人数据进入仓库的提交钩子
```

## 常用命令

```
npm run check      # typecheck + lint + 格式检查
npm run format     # prettier --write
npm run dev        # Vite 开发服务器（第 2 阶段起）
npm run build      # 生产构建（第 2 阶段起）
npm test           # vitest（第 2 阶段起）
npx playwright test  # 界面测试（第 2 阶段起）
bash .claude/hooks/test.sh  # 钩子回归测试
```

Node 版本固定在 `.node-version`（24，用 fnm）。GUI 应用和钩子不加载 `~/.zshrc`，需要时使用 fnm 默认路径 `${HOME}/.local/share/fnm/aliases/default/bin`。

## 编码规范

- TypeScript strict；不用 `any`（无法避免时注释原因）；小模块，一个模块一件事。
- UI 文本全部走 i18n；日期和数字用 `Intl`；德语小数逗号要能正确输入。
- 营养数据保存快照：记录里复制当时的营养值，修改食物不会改变历史。
- 目标没有预设值，由用户自己设置。
- 无障碍：语义化 HTML、图标按钮 `aria-label`、可见的 `:focus-visible`、对比度 ≥ 4.5:1。参考 `.claude/skills/web-design-guidelines/guidelines.md`。
- 外部数据和用户输入只用 `textContent` 渲染，不用 `innerHTML`。
- 设计以 `design/tokens.json` 为准：平面颜色，无渐变，系统字体。
- 修改后 PostToolUse 钩子自动运行 Prettier 和 ESLint。

## 依赖

- 添加任何依赖前：向用户说明用途和许可证，获得批准；先让 `security-reviewer` 检查。
- 许可证必须与 MPL-2.0 兼容（MIT、BSD、Apache-2.0、ISC、MPL-2.0）。
- 版本精确锁定（`.npmrc` 中 `save-exact=true`），提交 `package-lock.json`。

## 工作方式与子代理

主会话只负责协调、决策和用德语向用户汇报。尽量把工作委派给子代理；互不依赖的任务并行执行。给子代理的任务说明用中文，写清文件范围和完成标准。

| 子代理              | 用途                                                           |
| ------------------- | -------------------------------------------------------------- |
| `researcher`        | 只读调研（API、库、许可证、平台限制），附来源                  |
| `architect`         | 技术方案和数据模型，给出选项和推荐，写 `docs/design/`          |
| `implementer`       | 按已批准的计划实现，带测试，不提交                             |
| `security-reviewer` | 存储、密钥、权限、依赖、隐私；每个阶段结束和每次添加依赖时运行 |
| `reviewer`          | 每次提交前审查 diff                                            |
| `ui-tester`         | Playwright：iPhone 尺寸、桌面仪表盘、离线模式                  |
| `bug-hunter`        | 阶段结束后全代码库找 bug                                       |
| `docs-writer`       | README、ROADMAP、应用内说明文字                                |

标准流程：`architect` 设计 → 用户确认 → `implementer` 实现 → `ui-tester` 测试 → `reviewer` + `security-reviewer` 审查 → 主会话提交并推送 → 用德语汇报。

## Git

- 小步提交，Conventional Commits（`feat:`、`fix:`、`docs:`、`chore:`、`test:`、`refactor:`），合适时加 scope。
- 每次提交后立即 `git push` 到 `origin`（私有 GitHub 仓库）。这是用户的要求。
- 绝不 force push，未经用户同意绝不改写 Git 历史。
- 不提交数据库文件、导出数据、`.env`。

## 设计工具

- DesignCraft 和 FigCraft（ArtCraft 套件，开源 MIT/Apache-2.0）通过各自的 CLI MCP 服务器使用，只在本地注册，读取范围 `design/`，写入范围分别是 `design/designcraft/` 和 `design/figcraft/`。
- 只在用户选择时才使用在线分享功能。
