# GitHub Pages 发布说明

## 你现在已经具备的配置
- 自动部署工作流：`.github/workflows/pages.yml`
- 发布目录：`web-game`

## 发布步骤
1. 在 GitHub 新建仓库（例如 `tetris-mobile`）。
2. 把本地 `D:\apple\elsfangkuai` 整个项目上传到该仓库。
3. 打开仓库 `Settings -> Pages`：
   - `Source` 选择 `GitHub Actions`。
4. 回到仓库 `Actions` 页面，等待 `Deploy Web Game to GitHub Pages` 成功。
5. 成功后会得到公网地址：
   - `https://<你的GitHub用户名>.github.io/<仓库名>/`

示例：
- 用户名 `alice`，仓库名 `tetris-mobile`
- 链接就是 `https://alice.github.io/tetris-mobile/`

## 更新游戏
以后只要推送到 `main` 或 `master` 分支，会自动重新部署。
