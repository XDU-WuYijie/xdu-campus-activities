# Campus Activities Frontend

校园活动平台的新前端工程，使用 React、TypeScript、Vite 和 Ant Design Mobile。

## 开发

```bash
npm install
npm run dev
```

开发服务器监听 `http://127.0.0.1:5173`，并将 `/api` 和 `/api/ws` 代理到
`http://127.0.0.1:8081`。

## 生产构建

```bash
npm run build
npm start
```

Node 托管服务默认监听 `3000`。可通过 `PORT` 修改监听端口，通过
`BACKEND_URL` 修改后端地址。
