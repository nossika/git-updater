# git-updater

把此服务和你的项目一起部署到机器上。在你的项目中配置git-webhooks发送push消息到此服务。

此服务收到webhooks请求后，会cd到对应目录下执行git pull，并且执行构建脚本（如果有配置的话），来实现自动部署。

## 配置项

请看 `/config.js` 文件
