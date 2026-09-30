# inxv

一个使用 React 构建的浅灰终端主题个人网站。进入页面时，主内容只显示命令提示符和下方的 `#试试help?`。输入命令，或选择「关于我」「项目」「友情链接」目录即可浏览各栏目。

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
| `clear` | 清空终端输出 |

提示符直接显示在终端中，没有独立输入框。在 `%` 后输入命令并按回车执行，也可以点击目录浏览。支持 `Tab` 补全，以及 `↑`、`↓` 浏览输入历史。每个栏目都有独立网址，可以直接打开。刷新页面会清空终端，并回到根目录，右侧目录同步恢复初始状态。

## 修改内容

编辑 `assets/content.js` 中的关于我、个人链接和友情链接。`links` 接受下列条目；未填写时页面会显示整理中的提示。

```js
{
  title: '名称',
  description: '简短介绍',
  url: 'https://example.com',
}
```

部署时发布 `dist/` 的全部内容。构建结果包含 `about/index.html`、`projects/index.html` 和 `links/index.html`，静态托管可以直接访问和刷新各栏目网址。`assets/styles.css` 保留页面样式；终端组件与命令逻辑位于 `src/`。

## GitHub 项目同步与自动发布

项目页自动展示 `inxups` 的全部公开仓库，包括 fork 和已归档仓库，按最近推送时间降序排列，同时间按仓库名排序。名称、简介和链接来自 GitHub；没有简介时不显示简介。

本地更新项目数据：

```sh
npm run sync:projects
npm test
```

同步脚本分页获取完整列表，再原子替换 `assets/projects.generated.json`。普通 `npm run build` 使用已保存的数据，不请求 GitHub。同步失败时保留已有的有效数据并输出警告；没有可用数据时以失败退出，阻止发布。生成文件无需手动编辑。

`.github/workflows/pages.yml` 在推送到 `main`、手动触发或每 6 小时时同步、测试并发布到 GitHub Pages。定时任务按 UTC 的 00:23、06:23、12:23、18:23 运行，对应北京时间 08:23、14:23、20:23、02:23，GitHub 可能延迟执行。需要立即更新时，在仓库 **Actions → Sync projects and deploy Pages → Run workflow** 手动触发。

GitHub Pages 的发布来源需设置为 **GitHub Actions**。工作流使用内置 `GITHUB_TOKEN` 获取仓库，测试通过后自动提交有变化的数据，再发布 `dist/`；令牌不会进入前端。构建任务需要 `contents: write` 保存快照，部署任务需要 `pages: write` 和 `id-token: write`。若对 `main` 设置分支保护，需要允许该工作流保存生成的数据。使用仓库自带令牌提交不会再次触发 push 工作流。

## Codex 设计技能

项目内置 [taste-skill](https://github.com/Leonxlnx/taste-skill) 的 `design-taste-frontend`，位于 `.agents/skills/design-taste-frontend/`。在 Codex 中输入 `$design-taste-frontend` 并描述页面设计或改版需求即可使用；它只在开发时提供设计指导，不增加网站运行依赖。
