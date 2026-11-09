# Video Flow

[English](README.md) | [简体中文](README.zh-CN.md)

Video Flow 是一个 Chrome 侧边栏扩展，可以把 YouTube 和 Bilibili 视频变成可搜索、可复习的学习资料。

- 带时间戳的字幕
- 原文、中文和双语模式
- AI 视频总结、章节和关键摘录
- 选中文本讲解
- 带时间戳的笔记
- 数据保存在 Chrome 本地，不包含分析统计或行为追踪

Video Flow 是本地加载的扩展，目前没有上架 Chrome 应用商店，需要使用你自己的 API Key。

## 安装

1. 把项目下载或克隆到一个长期保留的文件夹。
2. 在 Chrome 打开 `chrome://extensions`。
3. 打开 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择包含 `manifest.json` 的项目文件夹。
5. 打开扩展的 **设置** 页面。
6. 修改本地文件后，在扩展页面点击 **重新加载**。

不要移动或删除项目文件夹，否则 Chrome 会停止加载这个本地扩展。

## 配置

Video Flow 最多使用两个服务：

- **Supadata**：只有 YouTube 字幕需要。可以在 [Supadata](https://dash.supadata.ai/auth/sign-up) 创建密钥。
- **AI 网关**：用于视频总结、讲解、翻译和笔记润色。

发布版本的 AI Base URL 固定为：

```text
https://api.meding.site
```

请直接在 Video Flow 设置页面填写 Key。不要把 Key 放进聊天、源代码、截图或公开 Issue。

## 使用

1. 打开一个有字幕的 YouTube 视频或有字幕轨道的 Bilibili 视频。
2. 点击 Video Flow 扩展图标。
3. 阅读和搜索字幕。
4. 打开 **概览**，查看视频总结、章节和关键摘录。
5. 选中文本获取讲解，或保存带时间戳的笔记。

Bilibili 不需要 Supadata Key。没有可用字幕轨道的视频可能无法使用。

## 隐私

- Key、设置、笔记和最近缓存保存在 Chrome 本地。
- YouTube 字幕请求发送到 Supadata。
- Bilibili 字幕请求由浏览器发送到 Bilibili 服务。
- AI 功能会把所需字幕和视频上下文发送到配置的 AI 网关。
- Video Flow 没有账号系统、广告、分析统计或行为追踪。

完整数据流请查看 [PRIVACY.md](PRIVACY.md)。

## 开发检查

```bash
npm test
npm run check
npm run package
```

## 开源许可

MIT，详见 [LICENSE](LICENSE)。
