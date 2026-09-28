# inxv

一个无依赖的浅灰终端主题个人网站。访客可以输入命令进入「关于我」「项目」「友情链接」；输入 `ls` 可查看完整目录。

## 本地预览

在项目目录运行：

```sh
python3 -m http.server 8000
```

然后打开 `http://localhost:8000/`。网站是纯静态文件，不需要安装依赖或执行构建。

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

输入框支持 `Tab` 补全，以及 `↑`、`↓` 浏览输入历史。提示符使用访客本地时间，路径显示站内位置。每个栏目都有独立网址，可以直接打开和刷新。

## 修改内容

编辑 `assets/content.js` 中的文案和列表。`projects` 与 `links` 都接受下列条目；未填写时页面会显示整理中的提示。

```js
{
  title: '名称',
  description: '简短介绍',
  url: 'https://example.com',
}
```

部署时保留 `about/index.html`、`projects/index.html` 和 `links/index.html`，这样静态托管也能直接访问各栏目网址。

## Codex 设计技能

项目内置 [taste-skill](https://github.com/Leonxlnx/taste-skill) 的 `design-taste-frontend`，位于 `.agents/skills/design-taste-frontend/`。在 Codex 中输入 `$design-taste-frontend` 并描述页面设计或改版需求即可使用；它只在开发时提供设计指导，不增加网站运行依赖。
