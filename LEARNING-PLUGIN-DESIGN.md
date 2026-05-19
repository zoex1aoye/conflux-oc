# Auto-Learning Plugin for opencode v2

> **悟已往之不谏，知来者之可追。**
> 知识需要沉淀，又需要常用常新。这个 plugin 要快速成长为项目的骨干和老开发。

## 核心理念

让 opencode 在**使用中自动学习**项目、机器、用户三个维度的上下文，实现：
- 跨 session 记住项目架构、技术选型、Runtime Requirements
- 不同 git 分支之间，核心设计交集不被冲散
- 模型从消息 1 就拥有完整上下文，从不需要问"你用的是什么系统/版本"

**知识需要沉淀，但更需要常用常新。**

---

## 分层架构（按优先级）

| 优先级 | 层 | 含什么 | 作用域 | 注入方式 |
|--------|-----|--------|--------|---------|
| **P0** | **Project** | 架构上下文、Runtime Requirements、跨分支交集知识、模块子 skill | 项目级 | `skill()` 按需加载 |
| **P1** | **Machine** | dev toolchain 版本/路径清单（java/go/node/mvn），机器身份标识 | 同机器跨 session | `client.session.prompt({ noReply: true })` 静默注入 |
| **P2** | **Platform** | 3 行 OS/Shell/Arch | 当前会话 | 同上（合并到同一条注入消息） |
| **P3** | **User** | 注释语言、详细程度（静态，不自学习） | 跨 session | 同上（合并到同一条注入消息） |

### 注入机制说明

opencode SDK 提供 `client.session.prompt({ noReply: true })` 接口，可在**不触发 AI 回复**的情况下向 session 注入一条消息。插件利用此接口在 session 创建后立即注入上下文，模型从第一条用户消息开始就拥有全部信息。

---

### 设计原则：开闭原则（OCP）

插件架构对外扩展开放，对内修改关闭。不得因加一层、加一条规则、换一个存储后端而修改核心代码。

#### 1. 层栈可配置

```jsonc
// plugin.jsonc — 层注册表
{
  "layers": [
    {
      "name": "platform",
      "priority": 0,
      "storage": "transform-only",
      "inject": "always"
    },
    {
      "name": "machine",
      "priority": 1,
      "storage": { "type": "local", "path": "machines/{id}.json" },
      "inject": "summary-only"
    },
    {
      "name": "user",
      "priority": 2,
      "storage": { "type": "local", "path": "users/{name}.json" },
      "inject": "always"
    },
    {
      "name": "project",
      "priority": 3,
      "storage": { "type": "local", "path": ".opencode/skills/" },
      "inject": "on-demand"
    }
  ]
}
```

后期加 "team" 层只需插入一项，合并/注入逻辑自动适配。

#### 2. 模型行为规则可配置

system prompt 注入不可用，因此行为规则通过注入消息的内容来传达。消息模板从规则注册表拼装：

```jsonc
{
  "behavior_rules": [
    {
      "id": "precheck-runtime",
      "trigger": "before:build_run_test",
      "rule": "先读 Project 层的 Runtime Requirements，再查 Machine 层对应 domain 的可用路径，自动 prepend 版本切换命令",
      "enabled": true
    },
    {
      "id": "knowledge-routing-cross-branch",
      "trigger": "on:note_discovery",
      "rule": "核心架构/接口约定/设计决策 → _shared/；当前分支进度/实现细节 → SKILL.md",
      "condition": "is_git_project",
      "enabled": true
    },
    {
      "id": "knowledge-source-routing",
      "trigger": "on:note_discovery",
      "rule": "只有工具输出结果写入 Machine/Platform，用户假设不进任何层",
      "enabled": true
    }
  ]
}
```

新规则只需在数组新增一项。

#### 3. 存储后端可替换

```
StorageAdapter 接口：
  read(path)    → string
  write(path, content) → void
  list(dir)     → string[]
  delete(path)  → void

实现：
  LocalStorageAdapter（默认）
  S3Adapter / GitAdapter / NotionAdapter（可插拔）
```

#### 4. 知识格式可扩展

```
_shared/ 内允许不同扩展名，各配解析器：
  .md    → MarkdownParser（默认）
  .yaml  → YamlParser（结构化配置、schema）
  .json  → JsonParser
  .proto → ProtoParser（protobuf 定义）
```

---

## P0 — Project 层

### 核心问题

你在 git 分支间切换时：
- 每个分支有不同的进度和功能
- 但 auth flow 架构、权限模型、token 刷新机制是所有分支共享的核心设计
- 每次新 session 模型应知道核心设计，不需要重新扫描项目

### 存储结构

```
your-project/.opencode/skills/
├── SKILL.md                        ← Per-branch（在 git 中，分支专用）
│                                     当前分支的进度、功能详情、待办
├── _shared/                         ← 跨分支交集知识（在 git 中）
│   ├── architecture.md              ← 核心架构、auth flow、设计决策
│   ├── interface-contracts.md       ← 接口约定、API 协议
│   ├── permissions-model.md         ← 权限模型、token 刷新机制
│   └── runtime-requirements.yaml    ← 标准化版本声明（见下）
│
├── auth-module/
│   ├── SKILL.md                     ← 模块详情（per-branch）
│   ├── decisions/                   ← 决策日志
│   │   ├── 2026-01-lark-adoption.md
│   │   └── 2026-03-lark-to-feishu.md
│   └── _archive/                    ← 冻结存档
│       ├── lark/SKILL.md
│       └── feishu/SKILL.md
└── payments/
    └── SKILL.md
```

### SKILL.md 格式要求

opencode 原生技能系统要求每个 SKILL.md 以 YAML frontmatter 开头：

```markdown
---
name: auth-module
description: Authentication module design and decisions for the CRM system
---

## Current State
...
```

- `name`：仅含小写字母、数字、连字符，1-64 字符
- `description`：1-1024 字符，供 `skill()` 工具按需加载时匹配

### Runtime Requirements 标准区块

每个子 skill 的 SKILL.md 中，或 `_shared/runtime-requirements.yaml`：

```yaml
# runtime-requirements.yaml
java:
  version: "11"
  source: "/usr/lib/jvm/java-11-temurin"
  switching: "export JAVA_HOME=/usr/lib/jvm/java-11-temurin && export PATH=$JAVA_HOME/bin:$PATH"
node:
  version: "18+"
go:
  version: "1.22"
build: "mvn clean compile"
test: "mvn test"
```

### Git 知识模型：知识路由规则

**读取时**：加载 `SKILL.md` + `_shared/*` 合并。分支信息不覆盖交集信息。

**写入时**，模型自动判断知识范围：

| 知识类型 | 示例 | 路由目标 | 说明 |
|---------|------|---------|------|
| 核心架构 / 接口约定 / 设计决策 | "token 刷新使用 refresh_token grant flow" | `_shared/` | 跨所有分支成立 |
| 当前分支进度 / 实现细节 | "admin 角色 CRUD 已完成，下一步做 rate limiting" | `SKILL.md`（分支级） | 仅当前分支 |
| 模块级子 skill | "auth-module 依赖 Spring Security 6" | `auth-module/SKILL.md` | 分支可能有不同实现 |
| 版本信息 | "此项目需要 JDK 11" | `_shared/runtime-requirements.yaml` | 跨分支成立 |

模型不确定时 → 写入 `SKILL.md` + 询问用户。

### 三层保持策略

每个模块 skill 维护三层结构，通过 **`file.edited` hook 自动维护**：

```
auth-module/
├── SKILL.md          ← 当前真理：当前 SDK、API、表结构
├── decisions/        ← 决策日志：每条一个文件，记录变更原因
└── _archive/         ← 冻结存档：旧 variant 的完整上下文
```

**自动维护流程**：
1. 模型通过 `edit` 工具修改 `SKILL.md`
2. `file.edited` hook 检测到实质性变更（非排版/typo）
3. 自动在 `decisions/` 下创建日期文件，询问用户补充变更原因
4. 如果检测到旧 variant 被替换，自动移至 `_archive/` 并更新 Migration Map

### Migration Map

SKILL.md 中设 `Migration Map` 区块，标记旧模块中哪些功能已有新实现：

```markdown
### Migration Map
当修改以下文件时，优先升级为 SDK 调用：
- `lark/message.go` → 已有 `feishusdk.SendMessage()`
- `feishu/api.go`   → 已有 `feishusdk.CreateEvent()`
```

模型修改涉及旧 API 时自动提醒用户是否顺手迁移。

### 冷启动自举

新项目没有 skill 时，模型通过读取代码（`pom.xml`、`package.json`、go.mod 等）自然发现技术栈和版本信息，调用 `note_discovery` 写入 → 知识路由判定后归入对应位置。**不需要提前准备任何 skill。**

---

## P1 — Machine 层

### 范围

聚焦 dev toolchain 清单，不做通用系统调优记录：

```json
{
  "machine_id": "GLO-NX6",
  "hostname": "zoex1aoye-laptop",
  "last_updated": "2026-05-19",
  "domains": {
    "java_dev": {
      "jdk8": "/usr/lib/jvm/java-8-temurin",
      "jdk11": "/usr/lib/jvm/java-11-temurin",
      "maven": "/usr/share/maven"
    },
    "go_dev": {
      "version": "1.22.2",
      "gopath": "/home/zoex1aoye/go"
    },
    "node_dev": {
      "versions": ["18", "20", "22"],
      "nvm_dir": "/home/zoex1aoye/.nvm"
    }
  }
}
```

### Machine 身份识别

```
Primary key: DMI product_name（硬件决定的唯一标识）

检测顺序（fallback 链）：
  1. cat /sys/devices/virtual/dmi/id/product_name
  2. cat /etc/machine-id（Linux 原生唯一 ID）
  3. hostname + MAC 地址列表 hash（最后 fallback）

注意：更换硬件或虚拟硬件环境后，DMI 变化 → 自动重新生成 machine profile
```

路径：`~/.config/opencode/plugins/learning-plugin/machines/{sanitized_id}.json`

---

## P2 — Platform 层

插件自动检测，内容包含在 noReply 注入消息中：

```
用户操作系统: Linux (Ubuntu 25.04)
Shell: bash (/usr/bin/bash)
架构: x86_64
```

**注意**：用户可能询问其他操作系统的场景（如"Windows 下 PowerShell 怎么写"）。模型基于对话上下文判断目标环境，假设场景中的其他 OS 信息不应污染本机 Platform。

---

## P3 — User 层

仅做静态输出偏好注入，不自学习：

```json
{
  "user": "zoex",
  "last_updated": "2026-05-19",
  "output_preferences": {
    "comment_style": "中文注释，每行配置说明作用",
    "language": "技术解释用中文，命令输出保留原文",
    "verbosity": "concise"
  },
  "security_boundaries": {
    "sudo": "list commands for user to run manually"
  }
}
```

---

## 信息源决定路由

系统环境信息（Machine / Platform）的写入遵循一条核心原则：**信息来源决定路由，不是内容。**

| 信息源 | 示例 | 路由目标 |
|--------|------|---------|
| 工具输出（`lspci`, `uname`, `DMI`, `/proc/…`, `$SHELL`） | `lspci` 输出的硬件列表 | **Current Machine / Platform**（写入持久层） |
| 用户明确指另一台真实机器 | "我的 T14 Gen3 有睡眠问题" | **Machine stub**（用户提供的标识，等待真实工具输出时合并） |
| 假设 / 目标环境 | "假设 R5 6600H 上部署模型", "Windows 下 PowerShell 命令" | **不进任何层**，纯会话上下文 |
| 巧合与本机配置相同的假设 | 本机是 R5 6600H，讨论中也说 R5 6600H | **仍然是假设**，不污染 Machine profile |

### 规则详解

**规则 1：只有工具输出才是 Machine/Platform 的合格来源**

无论对话中如何描述硬件、OS、Shell，只要不是通过工具执行（`read` `/proc/cpuinfo`、`uname -a`、`lspci`）获取的数据，就不能写入 Machine 或 Platform 层。

**规则 2：假设即使命中本机，也不污染本机 profile**

模型需要主动识别并提示：
```
你的本机配置恰好和假设一致（都是 R5 6600H），
需要切换到真实环境测试吗？
```
用户说"试试" → 工具执行 → 工具输出出现 → 写入 Machine。

**规则 3：另一台真实机器 → Machine stub**

用户明确说"另一台电脑"时，用用户提供的标识（型号 / hostname）创建 stub。等到在该机器上使用 opencode 时，真实 DMI 检测到后自动与 stub 合并。

**规则 4：假设 / 目标环境不进任何持久层**

用户假设的配置、目标操作系统的命令询问，只在当前会话中作为上下文使用。不写入 Machine 或 Project 任何层。

---

## Session 启动静默校验

知识过期比没有知识更糟糕。每次新 session 启动时，插件静默做一次校验，校验结果决定注入消息的内容：

```
session.created hook 触发
    ↓
插件执行：
  读 pom.xml / package.json / go.mod → 获取当前实际版本
  读 _shared/runtime-requirements.yaml → 获取记录版本
  执行 which java go node mvn → 获取 toolchain 路径快照
    ↓
比对结果 → 决定 noReply 注入消息是否包含"版本不一致提示"
    ↓
调用 client.session.prompt({
  path: { id: sessionId },
  body: {
    noReply: true,
    parts: [{ type: "text", text: compiledContext }]
  }
})
    ↓
注入消息在模型第一次看到对话时就存在
```

校验逻辑：
- 实际版本 ≠ 记录版本 → 注入消息末尾追加："检测到 pom.xml 中 java.version=17，但记录的 Runtime Requirements 是 JDK 11。如已升级，请确认是否更新记录。"
- toolchain 路径变化 → 自动更新 Machine 层（不打扰用户）
- 完全一致 → 注入纯上下文消息

---

## 注入机制

### 整体流程

```
session.created hook
  ↓
插件执行静默校验：读 pom.xml, which java/go/node, 读 _shared/
  ↓ 比对版本 → 决定注入内容
  ↓
client.session.prompt({ noReply: true, parts: [compiledContext] })
  ↓ 注入内容包含：
     [1] 当前 session 上下文
         - 用户操作系统: Linux (Ubuntu 25.04)
         - Shell: bash (/usr/bin/bash)
         - 架构: x86_64
         - 你的机器: GLO-NX6 (zoex1aoye-laptop)
         - 可用 toolchain: java_dev, go_dev, node_dev（调用 get_machine_context 获取详情）
         - 你的偏好: 中文注释、concise
         - 安全边界: sudo 命令列出给用户手动执行
         - 当前项目 Runtime Requirements: JDK 11, Maven
         - 当前分支: feature/new-auth

     [2] 知识路由规则（见行为规则）
         - 核心设计决策 → _shared/
         - 分支进度 → SKILL.md
         - 只有工具输出写入 Machine/Platform

     [3] 版本不一致提示（如有）
  ↓
用户发出第一条消息 → 模型已拥有全部上下文
  ↓
模型发现值得记的知识 → 调用 note_discovery / 编辑 SKILL.md
  ↓
file.edited hook → 检测 SKILL.md 变更 → 自动维护 decisions/ + _archive/
  ↓
模型执行 build/run/test → tool.execute.before 拦截
  ↓ 查 Runtime Requirements + Machine 路径 → 自动 prepend 版本切换
```

### Plugin Hooks（对接 opencode v2 公开 API）

| Hook / API | 用途 |
|------------|------|
| `session.created` | 触发静默校验（读 pom.xml、which java 等），组装上下文 |
| `client.session.prompt({ noReply: true })` | **核心**：将上下文静默注入为 session 的第一条消息 |
| `file.edited` | 检测 SKILL.md 实质性变更，自动维护 decisions/ + _archive/ |
| `tool.execute.before` | 拦截 build/run/test 命令，自动 prepend 版本切换 |
| `experimental.session.compacting` | 可选：在 compaction 时补充持久上下文（与 Tune Context 共存） |

### 自定义工具

| 工具 | 触发时机 | 参数 | 用途 |
|------|---------|------|------|
| `note_discovery` | 模型发现值得记住的信息 | `domain`, `content`, `layer`, `scope` ("branch" / "cross") | 路由写入对应知识位置 |
| `get_machine_context` | 模型需要 machine domain 详情 | `domain` | 返回对应 domain 的完整 JSON |

### 关键实现

**`session.created`** — 静默校验 + 注入：
```ts
"session.created": async (input, output) => {
  const sessionId = input.sessionId
  const pomVersion = await readPomJavaVersion()
  const recordedVersion = await readRuntimeRequirements()
  const platform = await detectPlatform()
  const machine = await loadMachineProfile()
  const userPrefs = await loadUserPreferences()
  const branch = await getCurrentBranch()
  let ctx = buildContextMessage(platform, machine, userPrefs, branch)
  if (pomVersion && recordedVersion && pomVersion !== recordedVersion) {
    ctx += `\n注意：pom.xml 中 java.version=${pomVersion}，但记录的是 JDK ${recordedVersion}。`
  }
  await client.session.prompt({
    path: { id: sessionId },
    body: { noReply: true, parts: [{ type: "text", text: ctx }] },
  })
}
```

**`tool.execute.before`** — 版本切换自动 prepend：
```ts
"tool.execute.before": async (input, output) => {
  if (isBuildOrRunCommand(input.args.command)) {
    const runtime = await readRuntimeRequirements()
    const switchingCmd = runtime.java?.switching
    if (switchingCmd) {
      output.args.command = `${switchingCmd} && ${output.args.command}`
    }
  }
}
```

---

## 隐私边界

### 数据准入

| 数据类型 | 能否记录 | 存哪里 | 进 git |
|---------|---------|--------|--------|
| `cat /proc/cpuinfo`, DMI | ✅ 可 | Machine | ❌ |
| `which java go node` 输出 | ✅ 可 | Machine | ❌ |
| 项目用 JDK8 + Maven | ✅ 可 | Project | ✅ |
| 核心架构 / 设计决策 | ✅ 可 | Project `_shared/` | ✅ |
| `~/.ssh/id_rsa` 内容 | ❌ 绝对不 | — | — |
| `export TOKEN=xxx` | ❌ 绝对不 | — | — |
| 工具输出中的命令行参数 | ⚠️ 需用户确认 | Machine | ❌ |

### 三条红线

1. **不主动读** `~/.ssh/`、`~/.gnupg/`、`.env`、`*token*`、`*secret*`、`*credential*`
2. **Machine 和 User** 默认在 `~/.config/opencode/plugins/`，不进任何 git 仓库
3. **Project 层**在 `.opencode/skills/` 下，进 git，团队共享

---

## 文件结构

```
~/.config/opencode/plugins/learning-plugin/
├── plugin.jsonc                    ← 层注册表 + behavior_rules + 存储适配器配置
├── machines/
│   └── GLO-NX6.json                ← 当前机器 machine profile（自动维护）
└── users/
    └── zoex.json                   ← user profile（静态配置）

项目目录/.opencode/skills/
├── SKILL.md                        ← 分支级上下文
├── _shared/                        ← 跨分支交集知识（进 git）
│   ├── architecture.md
│   ├── runtime-requirements.yaml
│   └── permissions-model.md
├── auth-module/
│   ├── SKILL.md
│   ├── decisions/
│   └── _archive/
├── payments/
│   └── SKILL.md
└── ...
```

---

## 成本说明

| 操作 | 预估 Token | 频次 |
|------|-----------|------|
| `client.session.prompt({ noReply })` 注入上下文 | ~200-300 | 每个新 session 一次（注入消息自身 token） |
| `get_machine_context('java_dev')` | 50-150 | 按需，每次 tool call |
| `note_discovery` 写入 | ~20 | 每次模型发现 |
| Session 启动静默校验 | ~100 | 每次新 session（一次性，无模型交互） |
| `file.edited` hook 维护 decisions/ | ~10 | 每次 SKILL.md 变更 |
| `tool.execute.before` 版本切换 | ~5 | 每次 build/run 命令 |

**每个新 session**：~300 tokens（注入消息自身，零工具调用开销）
**后续同 session**：0 tokens（注入消息已在历史中）
**跨 session**：~300 tokens（每次新 session 重新注入最新上下文）

按每天 3 个新 session 估算，约 **900 tokens/天**（\$0.0018，GPT-4o 级别）。无额外模型交互开销。

---

## 已确认搁置的机制

以下内容从 v1 设计中有意移除或搁置，以避免过度设计：

| 机制 | 搁置原因 |
|------|---------|
| `user-tmp-scenario`（场景覆盖） | 单人使用，场景切换频率低，暂不需要 |
| `workflow_patterns` 自学习 | 核心痛点是项目上下文，非工作流模式 |
| User 层自学习（偏好 + 工作流） | 模型 1 条消息可适应，不值得系统维护 |
| Pending 复杂 UX（冲突检测、review 流程） | 单人使用，层级冲突概率低 |
| Command history 分析 | 改为"工具输出中出现的命令行参数" |

---

## 实现顺序

### Phase 1 — 核心上下文 + 版本切换（P0 链路）

| # | 任务 | 产出 |
|---|------|------|
| 1 | 创建项目结构（package.json, tsconfig.json, 目录） | 骨架 |
| 2 | 实现 `plugin.jsonc` 层注册表 + 配置加载 | 可配置化 |
| 3 | 实现静默校验（读 pom.xml / which java / Machine profile） | 数据收集 |
| 4 | 实现 `client.session.prompt({ noReply: true })` 注入 | **核心：上下文自消息 1 可见** |
| 5 | 实现 `tool.execute.before` 版本切换自动 prepend | 核心体验 |
| 6 | 注册 `note_discovery` + `get_machine_context` 工具 | 知识路由 |

### Phase 2 — 知识沉淀

| # | 任务 | 产出 |
|---|------|------|
| 7 | Machine 层 dev toolchain 自动检测初始化 | 首次 session 自动生成 domain 骨架 |
| 8 | Machine ID fallback 链（DMI → /etc/machine-id → hostname + MAC） | 机器识别 |
| 9 | `file.edited` hook → 三层保持：decisions/ + _archive/ | 知识演进不丢失 |
| 10 | Migration Map 检测与提示 | 旧 API 迁移提醒 |

### Phase 3 — 加固

| # | 任务 | 产出 |
|---|------|------|
| 11 | 隐私边界校验（工具输出敏感参数过滤） | 安全 |
| 12 | 与 Tune Context Plugin 同时加载测试 | 兼容性验证 |
| 13 | npm 包分发 + 首次安装体验 | 可发布 |

---

## v1 留下的有效内容

- 密码黑名单机制 ✓（转入隐私边界）
- 项目结构扫描 ✓（project-spark 自动维护）
- 用户名解析 fallback 链 ✓
- 首次安装体验流程 ✓
- npm 包分发方式 ✓
- 技能膨胀管理 ✓（pending 定期整理）
