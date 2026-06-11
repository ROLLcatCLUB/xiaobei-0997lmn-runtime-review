# GitHub 审核区交接流程

这份文档用于把本地审核包上传到 GitHub，让另一个 GPT 会话通过 GitHub 页面或 raw 链接读取并复核。

## 目标

把某一轮本地审核材料整理成一个独立 GitHub 仓库，例如：

```text
ROLLcatCLUB/xiaobei-0952g-r1-review
```

另一个 GPT 会话只需要读取这个仓库里的 `result.json`、`report.md`、`manifest.json`、validator 和 ZIP，即可做审核。

## 推荐目录

本地建议使用独立 review 区，不要直接把整个主项目推上去：

```text
D:\Documents\SmartEdu\xiaobei-github-review\<review-repo-name>
```

示例：

```text
D:\Documents\SmartEdu\xiaobei-github-review\xiaobei-0952g-r1-review
```

## 基本流程

### 1. 确认 GitHub CLI 已登录

在 PowerShell 运行：

```powershell
gh auth status -h github.com
```

看到类似下面内容即可：

```text
Logged in to github.com account ROLLcatCLUB
Token scopes: repo
```

如果没登录，先运行：

```powershell
gh auth login -h github.com
```

协议选 `HTTPS` 即可。

### 2. 在主项目里完成本地审核包

通常本地会有这些文件：

```text
docs/audit/<stage>_result.json
docs/audit/<stage>_report.md
docs/audit/<stage>_checklist.json
scripts/validate_<stage>.py
docs/audit_packages/<stage>_manifest.json
docs/audit_packages/<stage>.zip
```

如果有截图或 DOM evidence，也一起放：

```text
docs/audit/screenshots/<stage>.png
docs/audit/screenshots/<stage>_dom_evidence.json
```

先在主项目根目录复跑 validator：

```powershell
python scripts/validate_<stage>.py
python scripts/validate_<stage>.py --root D:\Documents\SmartEdu\xiaobei-core
```

### 3. 创建独立 review 文件夹

示例：

```powershell
$reviewRoot = "D:\Documents\SmartEdu\xiaobei-github-review"
$repoName = "xiaobei-0952g-r1-review"
$target = Join-Path $reviewRoot $repoName

New-Item -ItemType Directory -Force -Path $reviewRoot | Out-Null
if (Test-Path $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
```

### 4. 只复制本轮审核材料

不要复制整个 `xiaobei-core`。

示例：

```powershell
$entries = @(
  "docs/audit/<stage>_result.json",
  "docs/audit/<stage>_report.md",
  "docs/audit/<stage>_checklist.json",
  "scripts/validate_<stage>.py",
  "docs/audit_packages/<stage>_manifest.json",
  "docs/audit_packages/<stage>.zip"
)

foreach ($rel in $entries) {
  $dest = Join-Path $target $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path "D:\Documents\SmartEdu\xiaobei-core" $rel) -Destination $dest -Force
}
```

如果本轮允许前端 adapter、fixture 或截图证据进审核区，也按 manifest 逐项复制。

### 5. 写 review README

在 review 仓库根目录放一个简短 `README.md`：

```markdown
# Xiaobei <stage> Review Area

This repository contains review materials for `<stage>`.

Final status: `<final_status>`.

This is a review area only. It is not the full source repository.
```

### 6. 初始化 Git 并推送

```powershell
Set-Location $target
git init -b master
git add .
git commit -m "Add <stage> review package"
gh repo create ROLLcatCLUB/<review-repo-name> --public --source . --remote origin --push
```

如果远程仓库已经存在，则用：

```powershell
git remote add origin https://github.com/ROLLcatCLUB/<review-repo-name>.git
git push -u origin master --force
```

## 给 GPT 的审核入口

发给另一个 GPT 会话时，给这几个链接最稳：

```text
GitHub repo:
https://github.com/ROLLcatCLUB/<review-repo-name>

result.json:
https://raw.githubusercontent.com/ROLLcatCLUB/<review-repo-name>/master/docs/audit/<stage>_result.json

report.md:
https://raw.githubusercontent.com/ROLLcatCLUB/<review-repo-name>/master/docs/audit/<stage>_report.md

manifest.json:
https://raw.githubusercontent.com/ROLLcatCLUB/<review-repo-name>/master/docs/audit_packages/<stage>_manifest.json
```

如果有 validator：

```text
https://raw.githubusercontent.com/ROLLcatCLUB/<review-repo-name>/master/scripts/validate_<stage>.py
```

## 给 GPT 的审核口径模板

可以直接贴：

```text
请审核这个 GitHub review area：

<repo-url>

重点读取：
- result.json
- report.md
- checklist.json
- manifest.json
- validator
- ZIP entry 对齐情况

请判断：
1. final_status 是否可收
2. validator 是否通过
3. manifest 与 ZIP 是否对齐
4. 是否夹带 forbidden files
5. 是否违反本阶段边界
6. 是否可以进入 recommended_next_stage

注意：
这个仓库是 review area，不是完整源码仓库。
如果 ZIP 没有包含某些本地证据文件，只能把那些字段视为 local repo evidence，不要说成 ZIP 内可重算证据。
```

## 注意事项

- 每一轮最好一个独立 review repo，例如 `xiaobei-0952f-r2-r1-review`。
- 不要把 `.env`、token、secret、真实课堂数据、学生个人数据传进 GitHub。
- 不要把整个工作区推给 GPT 审核，只推本轮 manifest 允许的文件。
- 如果需要审核 ZIP 内容，确保 ZIP 也进入 review repo。
- 如果 validator 要求 ZIP 存在，review repo 里必须包含原 ZIP。
- 如果 `raw.githubusercontent.com` 链接返回 404，通常是仓库没推成功、分支名不是 `master`、路径写错或仓库权限不可读。

## 0952G_R1 示例

```text
Repo:
https://github.com/ROLLcatCLUB/xiaobei-0952g-r1-review

result:
https://raw.githubusercontent.com/ROLLcatCLUB/xiaobei-0952g-r1-review/master/docs/audit/provider_backed_runtime_control_dry_run_0952G_R1_result.json

report:
https://raw.githubusercontent.com/ROLLcatCLUB/xiaobei-0952g-r1-review/master/docs/audit/provider_backed_runtime_control_dry_run_0952G_R1_report.md

manifest:
https://raw.githubusercontent.com/ROLLcatCLUB/xiaobei-0952g-r1-review/master/docs/audit_packages/provider_backed_runtime_control_dry_run_0952G_R1_manifest.json
```

