# Campus Activities Frontend

校园活动平台的新前端工程，使用 React、TypeScript、Vite 和 Ant Design Mobile。

## 开发

首次拉取或切换机器时，在仓库根目录执行：

```bash
./scripts/bootstrap.sh
```

该脚本通过 `npm ci` 严格按照 `package-lock.json` 安装全部前端依赖。
新增或升级依赖时必须同时提交 `package.json` 和 `package-lock.json`。

启动开发服务器：

```bash
npm run dev
```

开发服务器监听 `http://127.0.0.1:5173`，并将 `/api` 和 `/api/ws` 代理到
`http://127.0.0.1:8081`。

## 目录约定

```text
src/
├── app/                    # 应用 Provider 与初始化
├── api/                    # HTTP 客户端、公共 DTO 与 query keys
├── components/
│   ├── layout/
│   │   └── ComponentName/  # 布局实现、样式和 index.ts
│   ├── ui/
│   │   └── ComponentName/  # 通用 UI 实现、样式和 index.ts
│   └── __tests__/          # 跨组件组合测试
├── features/               # 按业务域组织，域内再分 api/model/providers
├── pages/
│   └── PageName/           # 路由页面实现、样式和 index.ts
├── router/                 # 路由表与守卫
├── styles/                 # 全局 Design Tokens
└── test/                   # 测试环境与 MSW 基础设施
```

可复用组件和路由页面采用 PascalCase 独立目录，样式与实现就近维护。
目录根级 `index.ts` 作为公共导出边界，业务代码不跨目录引用内部实现文件。
业务域同时包含多种职责时，按 `api/`、`model/`、`providers/` 或
`components/` 继续分层，测试跟随被测模块维护。

### 模块编写规则

- `components/ui`、`components/layout` 和 `pages` 下的模块目录使用
  PascalCase，必须包含同名实现文件和 `index.ts`。
- `features` 下的业务域目录使用 lowerCamelCase，域根级只保留
  `index.ts`，具体实现进入职责子目录。
- 跨模块引用使用 `index.ts` 暴露的公共 API，不直接引用其他模块内部文件。
- 样式、测试、类型和辅助函数优先与所属模块就近维护；确认跨域复用后再提升到
  全局目录。

执行前端 lint 时会同时校验代码和目录结构：

```bash
npm run lint
```

仅检查目录结构可执行 `npm run lint:structure`。

## 测试

```bash
npm test
```

`npm test` 运行 Vitest 单元与组件测试。

## 生产构建

```bash
npm run build
npm start
```

Node 托管服务默认监听 `3000`。可通过 `PORT` 修改监听端口，通过
`BACKEND_URL` 修改后端地址。该服务同时提供 SPA fallback、`/api`
HTTP 代理和 `/api/ws` WebSocket 升级，是迁移完成后的默认生产入口。

在仓库根目录可执行 `./scripts/start-frontend.sh`，一次完成锁定依赖
安装、生产构建和 Node 服务启动。该脚本用于生产模式，不提供 Vite
开发热更新；日常开发仍使用 `npm run dev`。`dist/` 是可重建产物，
不提交 Git。
