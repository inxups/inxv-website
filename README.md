# inxv

一个使用 React 构建的浅灰终端主题个人网站。打开首页即可输入命令，或选择「关于我」「项目」「友情链接」目录浏览各栏目。

## 本地预览

先安装依赖并启动开发服务器：

```sh
npm install
npm run dev
```

按终端提示打开本地地址。生产构建和预览：

```sh
npm run build
npm run preview
```

运行 `npm test` 可检查命令和路由行为。

## 命令

| 命令 | 作用 |
| --- | --- |
| `help` | 查看命令说明 |
| `ls` | 列出当前目录 |
| `cd about`、`cd projects`、`cd links` | 进入对应页面 |
| `cd ..`、`cd /` | 返回首页 |
| `cat README.md` | 阅读当前页面 |
| `pwd`、`whoami`、`history` | 查看路径、访客身份和命令历史 |
| `back`、`clear` | 返回站内上一页、清空输出 |

提示符直接显示在终端中，没有独立输入框。在 `%` 后输入命令并按回车执行，也可以点击目录浏览。支持 `Tab` 补全，以及 `↑`、`↓` 浏览输入历史。每个栏目都有独立网址，可以直接打开和刷新。

## 修改内容

编辑 `assets/content.js` 中的文案和列表。`projects` 与 `links` 都接受下列条目；未填写时页面会显示整理中的提示。

```js
{
  title: '名称',
  description: '简短介绍',
  url: 'https://example.com',
}
```

部署时发布 `dist/` 的全部内容。构建结果包含 `about/index.html`、`projects/index.html` 和 `links/index.html`，静态托管可以直接访问和刷新各栏目网址。`assets/styles.css` 保留页面样式；终端组件与命令逻辑位于 `src/`。

## Codex 设计技能

项目内置 [taste-skill](https://github.com/Leonxlnx/taste-skill) 的 `design-taste-frontend`，位于 `.agents/skills/design-taste-frontend/`。在 Codex 中输入 `$design-taste-frontend` 并描述页面设计或改版需求即可使用；它只在开发时提供设计指导，不增加网站运行依赖。
