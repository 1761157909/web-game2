# 俄罗斯方块（手机版）

## 运行（局域网手机可访问）
1. 在电脑上打开 PowerShell，执行：
   ```powershell
   cd D:\apple\elsfangkuai\web-game
   .\start-server.ps1 -Port 8080
   ```
2. 保持窗口不关闭，用手机（同一 Wi-Fi）打开：
   `http://172.31.113.17:8080/`

## 操作方式
- 手机按钮：左移、右移、旋转、下落、落底
- 键盘：
  - `←` `→`：移动
  - `↑`：旋转
  - `↓`：软降
  - `空格`：硬降
  - `P`：暂停/继续

## 部署到公网（生成可分享链接）
可把 `web-game` 文件夹上传到任意静态托管：
- Cloudflare Pages
- Netlify
- Vercel

上传后就会得到一个公网 HTTPS 链接，手机可直接点击游玩。
