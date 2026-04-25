# XDU Campus Activities

西电校园大型活动报名与签到平台。


## 技术栈

- 后端：Spring Boot 3.5, JDK 17, MyBatis-Plus, Spring AI, Redis, RocketMQ, WebSocket, Elasticsearch
- 前端：原生 HTML + Vue 2 + Element UI
- 数据库：MySQL 8.0
- 缓存：Redis 7.2
- 本地基础设施：Docker Compose
- 静态资源代理：Nginx
- 横切能力：AOP 限流、Token Bucket 令牌桶、场景化降级、WebSocket 实时推送

## 核心特性

- 活动公开列表、分类、详情查询
- 正式 RBAC 权限模型：`USER`、`ACTIVITY_ADMIN`、`PLATFORM_ADMIN`
- 普通用户默认注册为 `USER`
- 普通用户可提交“成为活动主办方”申请，由平台管理员审核
- 平台管理员登录后进入独立后台，审核活动发布和主办方申请
- 主办方创建和编辑活动，活动默认进入待审核状态
- 学生报名、查看我的报名、活动开始前退出报名
- 报名异步确认链路：Redis 冻结名额 + RocketMQ 消费确认 + WebSocket 推送
- 报名成功后自动生成签到凭证
- 主办方按展示码或凭证 ID 进行签到核销
- 签到统计、核销记录、报名名单查询
- 报名模式支持 `审核制` 和 `先到先得`
- 基于 AOP + 本地令牌桶的接口限流与降级
- 通知中心支持离线通知、未读数、实时推送和业务跳转
- 审核历史支持活动审核、报名/退出审核和主办方申请审核留痕
- 活动 AI 辅助审核，提供结构化建议与人工复核记录
- 头像与活动图片上传到阿里云 OSS，URL 回写用户/活动数据

## 页面展示

- [首页](doc/assets/home.png)
- [活动详情页](doc/assets/activity_information.png)
- [活动发布页](doc/assets/activity_post.png)
- [签到管理页](doc/assets/activity_sign.png)
- [通知中心](doc/assets/notification.png)
- [校园圈](doc/assets/social_media_feed.png)
- [推荐页](doc/assets/recommand.png)
- [个人中心](doc/assets/personnal_information.png)
- [管理员后台](doc/assets/admin.png)
- [AI 审核建议](doc/assets/ai_review.png)

## 目录说明

- `src/main/java`：后端 Java 代码
- `src/main/resources/db`：数据库脚本
- `front/html/campus`：前端静态页面
- `docker-compose.yml`：本地 Docker 开发编排
- `docker/rocketmq/RocketMQ.conf`：RocketMQ Broker 配置
- `docker/nginx/nginx.conf`：Nginx 代理配置
- `功能模块设计.md`：模块设计说明
- `工程进展.md`：项目进展记录

## 跨平台开发说明

当前默认采用“宿主机运行 Spring Boot + Docker Compose 启动基础设施”的本地开发模式。

- Spring Boot 从宿主机直连 RocketMQ NameServer：`127.0.0.1:9876`
- RocketMQ Broker 对外注册地址固定为 `127.0.0.1`
- 该配置适用于 Windows 和 macOS 本机开发，避免 `host.docker.internal` 在不同系统上的解析和回环行为不一致，导致客户端能连 NameServer 但无法继续连接 Broker

如果后续改为“Spring Boot 也运行在 Docker 内”，则不能继续使用当前配置，需要把 Broker 对外注册地址改为容器网络内可达地址。

## 环境要求

- JDK 17
- Maven 3.6+
- Docker Desktop
- MySQL 客户端命令行工具：`mysql` / `mysqldump`

## 本地启动

### 1. 启动 Docker 基础设施

项目当前通过 Docker Compose 启动以下服务：

- MySQL 8.0
- Redis 7.2
- RocketMQ NameServer
- RocketMQ Broker
- Elasticsearch 7.17
- Nginx

启动命令：

```powershell
docker compose up -d
```

查看状态：

```powershell
docker compose ps
docker compose logs -f
```

停止服务：

```powershell
docker compose down
```

### 2. 后端配置

当前后端默认连接本机映射端口：

- MySQL：`127.0.0.1:3307`
- Redis：`127.0.0.1:6378`
- RocketMQ NameServer：`127.0.0.1:9876`
- Elasticsearch：`127.0.0.1:9200`
- Spring Boot：`127.0.0.1:8081`
- Nginx：`http://127.0.0.1:8080`

RocketMQ 本地开发额外约束：

- `docker/rocketmq/RocketMQ.conf` 中 `brokerIP1` 默认固定为 `127.0.0.1`
- 修改该值后需要重启 `campus-rmq-broker` 容器才能重新注册 Broker 地址
- 如果日志里出现 `send request to <host.docker.internal:10911> failed`，说明 Broker 仍在对外广播不可达地址

对应配置见 `src/main/resources/application.yaml`。

如果使用 OSS 上传，还需要配置环境变量：

```powershell
$env:OSS_ACCESS_KEY_ID="your-key-id"
$env:OSS_ACCESS_KEY_SECRET="your-key-secret"
```

### 3. 启动 Spring Boot

```powershell
mvn spring-boot:run
```

或：

```powershell
mvn -q -DskipTests compile
```

### 4. 默认账号

当前数据库脚本会预置一个平台管理员账号：

- 账号：`admin`
- 密码：`123456`

管理员使用密码登录页 `login2.html` 登录后，会直接跳转到平台管理后台。

## 数据库初始化与变更

### 首次初始化

MySQL 容器第一次启动时，会执行 `src/main/resources/db/init` 下的初始化脚本。

初始化表只保留当前活动平台所需的数据结构。

### 当前核心表

- 用户与权限：
  - `tb_user`
  - `tb_user_info`
  - `sys_role`
  - `sys_permission`
  - `sys_user_role`
  - `sys_role_permission`
  - `organizer_apply`
- 活动与报名：
  - `tb_activity`
  - `tb_activity_registration`
  - `tb_activity_voucher`
  - `tb_activity_check_in_record`

### 结构变更脚本

当前常用结构变更脚本位于 `src/main/resources/db/migration`：

- `rbac_upgrade.sql`
- `organizer_admin_upgrade.sql`
- `activity_upgrade.sql`
- `activity_checkin_voucher_upgrade.sql`
- `activity_images_upgrade.sql`
- `activity_registration_async_upgrade.sql`
- `user_profile_upgrade.sql`
- `user_role_upgrade.sql`

### 从本地 MySQL 导出并导入到 Docker MySQL

```powershell
mysqldump -u[用户名] -p[密码] --default-character-set=utf8mb4 --single-transaction --routines --triggers campus > D:\Java\IDEA_JAVA_projects\xdu-campus-activities\docker\mysql\campus.sql
```

导入到 Docker MySQL：

```powershell
mysql -h127.0.0.1 -P3307 -u[用户名] -p[密码] campus < "D:\Java\IDEA_JAVA_projects\xdu-campus-activities\docker\mysql\campus.sql"
```

### 手动重建数据库后的注意事项

如果你是直接手动重建或修改了 MySQL，而不是通过应用接口改数据：

- Redis 不会自动失效
- Elasticsearch 不会自动同步

这时建议同步处理：

1. 清 Redis 登录态和业务缓存
2. 删除并重建 ES 索引 `activity_index_dev`
3. 重启 Spring Boot，让搜索服务重新初始化索引

否则会出现“数据库已变更，但前端列表仍看到旧缓存/旧索引”的现象。

## 报名异步确认链路

当前报名不是“同步插库后直接成功”，而是异步确认流程：

1. 前端调用 `POST /activity/{id}/register`
2. 后端先通过 Redis + Lua 校验活动状态、报名时间、重复报名、剩余名额
3. Redis 先冻结名额，接口返回 `PENDING_CONFIRM`
4. RocketMQ 消费者异步落库并生成签到凭证
5. 后端通过 WebSocket 推送最终结果
6. 前端通过 `GET /activity/{id}/register/status` 兜底刷新状态

相关资源：

- Topic：`activity-register-topic`
- WebSocket：`/ws/activity-registration?token={token}`
- Lua 脚本：`src/main/resources/activity_register.lua`

## 活动审核与权限流程

### 用户与角色

- 新注册用户默认绑定 `USER`
- `USER` 可以浏览活动、报名、查看我的报名和签到状态
- 用户提交主办方申请并经管理员审核通过后，追加绑定 `ACTIVITY_ADMIN`
- `PLATFORM_ADMIN` 负责审核活动和审核主办方申请

### 活动审核

1. 主办方创建/编辑活动
2. 活动状态进入待审核
3. 平台管理员在后台审核通过后，活动才会出现在首页和公开详情页
4. 驳回活动不会在首页显示

### 管理员后台

- 页面：`http://127.0.0.1:8080/admin-dashboard.html`
- 能力：
  - 审核待发布活动
  - 审核普通用户成为主办方的申请

## 搜索与缓存

- Redis 负责登录态、活动详情缓存、活动列表缓存、报名状态缓存
- Elasticsearch 负责活动大厅搜索、筛选、排序和分类聚合
- 活动状态变更会触发 Redis 缓存失效和 ES 索引同步
- 首页活动列表最终会以数据库中的 `status=已通过` 作为兜底过滤，避免 ES 异步延迟导致未通过活动短暂可见

## 页面入口

- 首页：`http://127.0.0.1:8080/index.html`
- 活动详情：`http://127.0.0.1:8080/activity-detail.html?id={activityId}`
- 活动管理：`http://127.0.0.1:8080/activity-manage.html`
- 个人中心：`http://127.0.0.1:8080/info.html`
- 管理员后台：`http://127.0.0.1:8080/admin-dashboard.html`
- 验证码登录：`http://127.0.0.1:8080/login.html`
- 密码登录：`http://127.0.0.1:8080/login2.html`

## 角色说明

- `USER`：可浏览活动、报名、查看凭证、退出未开始活动
- `ACTIVITY_ADMIN`：可发起活动、编辑自己创建的活动、查看报名名单、核销签到
- `PLATFORM_ADMIN`：可审核活动、审核主办方申请、访问管理员后台

## 当前已知事项

- 报名结果默认先显示“报名确认中”，随后由 RocketMQ 消费和 WebSocket / 轮询更新为最终结果
- 如果 RocketMQ 或 WebSocket 未正常启动，前端可能会依赖状态轮询更新
- Nginx 当前只代理静态页面和后端接口，Spring Boot 仍需单独启动
- `/user/me` 当前直接返回 Redis 登录态，若你手动重建 MySQL 但未清 Redis，前端用户信息可能与数据库短暂不一致
- 头像文件本身存储在 OSS，数据库 `tb_user.icon` 保存的是头像 URL，Redis 登录态会缓存该 URL

## 参考文档

- [功能模块设计](doc/功能模块设计.md)
- [工程进展](doc/工程进展.md)
