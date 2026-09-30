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

项目页自动展示 `inxups` 的全部公开仓库，包括 fork 和已归档仓库，按最近推送时间降序排列，同时间按仓库名排序。项目名称进入本站 `/projects/仓库名/` 详情页，右侧 projects 目录也列出每个项目。详情包含 star、fork 数、是否为 fork、GitHub 链接、README，以及最新正式 Release 的日期、发布说明和下载链接；缺失 README 或 Release 时显示简短提示。

在项目列表中可输入 `cd mineGPT`，也可从任意位置输入 `cd /projects/mineGPT`，`cat README.md` 阅读项目内容，`cd ..` 返回项目列表。支持项目名称补全、浏览器前进后退和直接打开详情网址；刷新时仍按全站约定回到根目录。

本地更新项目数据：

```sh
npm run sync:projects
npm run sync:activity
npm test
```

同步脚本分页获取完整列表，以受限并发同步各仓库的 README 和最新正式 Release，再原子替换 `assets/projects.generated.json`。404 视为没有相应内容，其他错误优先保留该字段的已有内容；无法获取完整项目数据时回退到整个快照，没有可用数据则以失败退出，阻止发布。普通 `npm run build` 使用已保存的数据，不请求 GitHub，并为每个项目生成独立的静态 HTML 入口。生成文件无需手动编辑。

README 和发布说明支持 GitHub 风格的 Markdown、表格、代码和图片，HTML 经清理后显示。相对文档链接指向仓库文件，相对图片链接指向原始文件，外部链接在新标签页打开。所有 GitHub 请求发生在构建前，访客无需调用 GitHub API。

`projects/README.md` 总览还展示最近一年的 GitHub 贡献日历。`sync:activity` 读取 `inxups` 公开主页的贡献数据，将每日次数和 GitHub 颜色等级保存到 `assets/github-activity.generated.json`，随每次发布和每 6 小时的定时任务更新。同步失败或返回不完整日历时保留已有快照；没有可用快照则阻止发布。日历支持悬停、点击和方向键查看日期及次数，手机上可横向滑动，默认展示最近的日期。

`.github/workflows/pages.yml` 在推送到 `main`、手动触发或每 6 小时时同步、测试并发布到 GitHub Pages。定时任务按 UTC 的 00:23、06:23、12:23、18:23 运行，对应北京时间 08:23、14:23、20:23、02:23，GitHub 可能延迟执行。需要立即更新时，在仓库 **Actions → Sync projects and deploy Pages → Run workflow** 手动触发。

GitHub Pages 的发布来源需设置为 **GitHub Actions**。工作流使用内置 `GITHUB_TOKEN` 获取仓库，测试通过后自动提交有变化的数据，再发布 `dist/`；令牌不会进入前端。构建任务需要 `contents: write` 保存快照，部署任务需要 `pages: write` 和 `id-token: write`。若对 `main` 设置分支保护，需要允许该工作流保存生成的数据。使用仓库自带令牌提交不会再次触发 push 工作流。

## Codex 设计技能

项目内置 [taste-skill](https://github.com/Leonxlnx/taste-skill) 的 `design-taste-frontend`，位于 `.agents/skills/design-taste-frontend/`。在 Codex 中输入 `$design-taste-frontend` 并描述页面设计或改版需求即可使用；它只在开发时提供设计指导，不增加网站运行依赖。
