# dsh-artcards

为 DeepSeek Harness（DSH）Web 增加产物卡片。

当对话创建或修改文件后，插件会在回复下方展示文件名、类型和目录，并支持：

- 在 Finder 或文件管理器中定位文件；
- 使用默认应用打开文件；
- 在 macOS 上选择本机已安装的 Markdown 编辑器或 IDE 打开文件。

## 效果

![DSH 产物卡片效果](docs/images/artifact-cards.jpg)

## 安装

需要 DeepSeek Harness、Node.js 22 或更高版本，以及已经初始化的 DSH `web` profile。

在项目目录执行：

```bash
./install.sh
```

安装完成后重启 DSH：

```bash
dsh web
```

## 使用

在 DSH Web 中执行一项会创建或修改文件的任务。任务完成后，回复下方会自动出现产物卡片。

点击文件名可以使用 DSH 默认方式打开文件；也可以选择 Finder、默认应用或插件识别到的本机编辑器，然后点击“打开”。

## 卸载

在项目目录执行：

```bash
./uninstall.sh
```

卸载完成后重启 `dsh web`。

## 说明

- 已在 macOS、DeepSeek Harness `0.1.0-rc.7` 和 Node.js 24 环境验证。
- 本机文件打开功能需要通过本机 loopback 地址访问 DSH Web。
- 更详细的安装和故障排查见[安装教程](安装教程.md)。

## License

MIT
