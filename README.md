# XDU Campus Activities Platform

> 面向高校场景的校园大型活动报名、审核、签到、通知与校园圈互动平台。

## 目录

| 分类 | 内容 |
|---|---|
| 项目概览 | [项目简介](#项目简介) · [核心功能](#核心功能) · [技术栈](#技术栈) |
| 系统设计 | [系统架构](#系统架构) · [项目亮点](#项目亮点) · [核心流程](#核心流程) |
| 页面展示 | [用户端](#用户端) · [活动负责人端](#活动负责人端) · [平台管理员端](#平台管理员端) |
| 工程说明 | [项目结构](#项目结构) · [本地运行](#本地运行) · [配置说明](#配置说明) |
| 扩展规划 | [后续优化](#后续优化) · [项目说明](#项目说明) |

---

## 项目简介

本项目聚焦校园大型活动管理全链路，覆盖活动发布、平台审核、报名审核、异步确认、签到核销、通知推送、校园圈互动、AI 审核建议与个性化推荐等能力。  
系统面向三类角色：普通用户、活动负责人、平台管理员，支持从活动创建到活动履约的完整业务闭环。

---

## 核心功能

### 普通用户端

- 浏览活动首页、分类列表、活动详情
- 支持审核制与先到先得两种报名方式
- 查看我的报名、报名状态、签到凭证、收藏活动
- 查看通知中心、活动审核结果、报名结果与退出审核结果
- 使用校园圈发布动态、点赞、评论
- 基于行为画像查看“为你推荐”内容

### 活动负责人端

- 发起活动、编辑活动、上传活动图片
- 管理自己创建的活动与报名名单
- 审核报名申请与退出申请
- 查看签到数据看板、核销记录、报名趋势与签到趋势
- 使用展示码或凭证 ID 完成签到核销

### 平台管理员端

- 审核活动发布申请
- 审核普通用户成为活动负责人的申请
- 查看 AI 审核建议与相似活动参考
- 查看通知中心与审核历史
- 下架已发布活动并记录审核结果

---

## 技术栈

### 后端

- Spring Boot 3.5
- JDK 17
- MyBatis-Plus
- Spring WebSocket
- Spring AI
- AOP

### 前端

- React 18、TypeScript、Vite、Ant Design Mobile
- Node.js、Express 生产托管与反向代理
- Vitest、Testing Library、MSW

### 中间件

- MySQL 8.0
- Redis 7.2
- RocketMQ 4.9
- Elasticsearch 7.17
- Docker Compose

### AI 能力

- Qwen 大模型审核建议生成
- 活动向量召回
- 用户偏好画像构建
- 规则推荐 + 向量推荐融合排序

---

## 系统架构

系统采用前后端分离架构：

- React 前端在开发环境由 Vite 提供，并代理 `/api` 与 `/api/ws`
- React 生产构建由 Node.js 托管并代理后端请求
- Spring Boot 提供活动、报名、审核、签到、通知、推荐等业务接口
- MySQL 负责核心业务数据持久化
- Redis 负责登录态、活动缓存、报名状态缓存、签到聚合缓存
- RocketMQ 负责报名异步确认、通知事件、AI 审核事件、搜索索引同步
- Elasticsearch 负责活动搜索、筛选、聚合与向量召回
- WebSocket 负责报名结果与通知的实时推送

---

## 项目亮点

### 1. Spring Security + RBAC 权限体系

当前项目采用正式 RBAC 角色权限模型，区分 `USER`、`ACTIVITY_ADMIN`、`PLATFORM_ADMIN` 三类角色，并通过角色与权限缓存支撑页面显隐与接口鉴权。

### 2. 审核制 + 先到先得制双报名模式

活动支持两种报名方式：审核制活动由负责人审核通过后确认名额，先到先得活动走 Redis 冻结名额 + MQ 异步确认链路，兼顾灵活性与并发性能。

### 3. 状态模式管理报名/退出审批流

报名申请、报名成功、报名驳回、退出申请、退出通过等状态均围绕统一活动状态流转，保证普通用户、负责人和通知中心看到一致结果。

### 4. Redis + Lua + MQ + WebSocket 高峰报名链路

先到先得活动通过 Redis + Lua 做原子校验与冻结名额，再由 RocketMQ 异步落库，最后通过 WebSocket 把最终结果推送给前端，降低高峰期数据库压力。

### 5. AOP + 令牌桶限流与降级

对报名、搜索、热点活动详情、通知查询、审核列表等关键接口统一接入基于 AOP 的限流能力，并提供按场景拆分的降级策略。

### 6. 消息通知中心

系统支持活动审核、报名成功/失败、报名审核、退出审核、主办方申请审核、动态互动等通知落库，并通过 WebSocket 进行实时推送。

### 7. 校园圈点赞评论系统

项目内置校园圈动态流，支持关联活动发布动态、点赞/取消点赞、评论/删除评论与通知联动，增强活动后的社交互动能力。

### 8. AI 审核与智能推荐

引入 AI 审核建议、相似活动召回、活动向量索引与用户画像构建，为管理员审核与个性化推荐提供支撑。

---

## 页面展示

### 用户端

#### 首页

[查看首页预览图](doc/assets/home.png)

#### 活动详情页

[查看活动详情页预览图](doc/assets/activity_information.png)

#### 发现页：校园圈

[查看发现页校园圈预览图](doc/assets/social_media_feed.png)

#### 发现页：为你推荐

[查看发现页为你推荐预览图](doc/assets/recommand.png)

#### 消息通知中心

[查看消息通知中心预览图](doc/assets/notification.png)

#### 我的页面

[查看我的页面预览图](doc/assets/personnal_information.png)

### 活动负责人端

#### 活动发布页

[查看活动发布页预览图](doc/assets/activity_post.png)

#### 签到管理页

[查看签到管理页预览图](doc/assets/activity_sign.png)

### 平台管理员端

#### 活动审核页

[查看活动审核页预览图](doc/assets/admin.png)

#### AI 审核建议页

[查看 AI 审核建议预览图](doc/assets/ai_review.png)

---

## 核心流程

```text
活动发布审核流程

[活动负责人创建/编辑活动]
            |
            v
      [活动进入待审核]
            |
            v
      [平台管理员审核]
            |
            v
      [AI 审核建议辅助]
            |
            v
         [通过/驳回]
            |
            v
    [通知中心与页面状态同步]
```

```text
审核制报名流程

[用户提交报名申请]
          |
          v
[负责人查看待审核请求]
          |
          v
     [审核通过/驳回]
          |
          v
[生成报名结果与签到凭证]
          |
          v
[通知中心/页面状态同步]
```

```text
先到先得报名流程

[用户发起报名]
      |
      v
[Redis + Lua 原子校验]
      |
      v
[冻结名额并返回待确认]
      |
      v
[RocketMQ 异步落库]
      |
      v
[生成报名记录与签到凭证]
      |
      v
[WebSocket 推送最终结果]
```

```text
活动签到流程

[报名成功生成唯一凭证]
          |
          v
[负责人输入展示码/凭证 ID]
          |
          v
[校验活动/时间窗口/凭证状态/幂等]
          |
          v
      [更新签到状态]
          |
          v
[记录核销人/时间/统计数据]
```

```text
消息通知流程

[审核/报名/退出/点赞/评论事件]
               |
               v
            [通知落库]
               |
               v
      [WebSocket 实时推送]
               |
               v
 [前端刷新未读数与通知列表]
```

```text
AI 推荐流程

[用户行为 + 偏好标签]
          |
          v
      [生成用户画像]
          |
          v
[活动内容写入 ES 与向量索引]
          |
          v
   [规则召回 + 向量召回]
          |
          v
 [输出推荐理由与排序结果]
```

---

## 项目结构

```text
xdu-campus-activities
├── backend                      # Spring Boot 后端工程
│   ├── pom.xml
│   └── src
├── frontend                     # React + TypeScript 新前端工程
│   ├── src
│   └── server                   # 生产静态托管及 API/WS 代理
├── docker                       # RocketMQ、MySQL 等基础设施配置
├── doc                          # 设计文档与页面展示图
└── docker-compose.yml           # 本地基础设施编排
```

---

## 本地运行

### 首次使用

```bash
git clone <your-repo-url>
cd xdu-campus-activities
./scripts/bootstrap.sh
```

`bootstrap.sh` 校验 Node.js 版本，并根据 lockfile 安装前端依赖。每台机器
首次拉取项目时执行一次即可。

### 日常开发

1. 启动 MySQL、Redis、RocketMQ 和 Elasticsearch：

```bash
docker compose up -d
```

2. 在一个终端启动后端：

```bash
mvn -f backend/pom.xml spring-boot:run
```

3. 在另一个终端启动前端：

```bash
npm --prefix frontend run dev
```

打开 `http://127.0.0.1:5173`。这是本项目默认的本地开发方式。

### 生产运行（可选）

后端已启动时，在仓库根目录执行：

```bash
./scripts/start-frontend.sh
```

该脚本自动安装依赖、构建前端并启动 Node.js 托管，访问地址为
`http://127.0.0.1:3000`。它不提供开发热更新，日常开发不要使用。

### 可选配置

OSS 上传和 AI 功能需要在后端运行环境中配置
`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`QWEN_API_KEY`、
`QWEN_BASE_URL`、`QWEN_MODEL` 和 `QWEN_EMBEDDING_MODEL`。

---

## 数据库设计

核心数据表包括：

- 用户与权限：`tb_user`、`tb_user_info`、`sys_role`、`sys_permission`、`sys_user_role`、`sys_role_permission`
- 活动域：`tb_activity`、`tb_activity_registration`
- 签到域：`tb_activity_voucher`、`tb_activity_check_in_record`
- 通知域：`sys_notification`
- 校园圈：`tb_activity_post`、`tb_activity_post_image`、`tb_activity_post_like`、`tb_activity_post_comment`
- 推荐与画像：`tb_user_preference_tag`、`tb_user_profile_embedding`

详细设计见：[doc/功能模块设计.md](doc/功能模块设计.md)

---

## 配置说明

### MySQL 配置

- 本机映射端口：`3307`
- 默认数据库：`campus`

### Redis 配置

- 本机映射端口：`6378`
- 用于登录态、活动缓存、状态缓存、签到看板缓存

### RocketMQ 配置

- NameServer 默认地址：`rocketmq-namesrv:9876`
- Broker 默认广播地址：`rocketmq-broker`
- 宿主机调试 Spring Boot 时，Broker IP 默认使用 `127.0.0.1`

### Elasticsearch 配置

- 默认地址：`http://elasticsearch:9200`
- 默认索引：`activity_index_dev`
- 用于活动搜索、分类聚合、向量召回

### AI API 配置

- `QWEN_BASE_URL`
- `QWEN_API_KEY`
- `QWEN_MODEL`
- `QWEN_EMBEDDING_MODEL`

---

## 后续优化

- 补充独立的角色权限管理后台
- 补充分类标签管理后台
- 增加导出签到名单与报名名单能力
- 完善接口文档与自动化测试覆盖率
- 优化推荐链路的实时性与可解释性

---

## 项目说明

- 默认平台管理员账号：`admin / 123456`
- 默认活动负责人账号：`test / 123456`
- 项目文档入口：[doc/功能模块设计.md](doc/功能模块设计.md)
