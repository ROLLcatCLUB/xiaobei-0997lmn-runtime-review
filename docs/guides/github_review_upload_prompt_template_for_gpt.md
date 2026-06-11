# GitHub Review Upload Prompt Template For GPT

这份模板用于新 Codex 会话把本地审核材料上传到 GitHub review area，并给另一个 GPT 做复核。

## 1. 上传前确认

在主项目根目录先确认：

```powershell
cd D:\Documents\SmartEdu\xiaobei-core
gh auth status -h github.com
```

必须确认：

```text
Logged in to github.com account ROLLcatCLUB
Token scopes includes repo
```

## 2. 本地复跑 validator

每个阶段至少跑：

```powershell
python scripts/validate_<stage>.py
python scripts/validate_<stage>.py --root .
```

如果阶段有浏览器/runtime smoke，还要确认依赖服务已启动，例如：

```powershell
python scripts/run_teaching_planning_runtime_0997N.py
```

再跑对应 smoke：

```powershell
node scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js
```

## 3. 只复制审核材料

不要上传整个主项目。新建独立目录：

```powershell
$reviewRoot = "D:\Documents\SmartEdu\xiaobei-github-review"
$repoName = "xiaobei-<stage-or-line>-review"
$target = Join-Path $reviewRoot $repoName
```

复制范围以 manifest 为准：

```text
docs/foundation/<stage>.md/json
docs/audit/<stage>_report.md
docs/audit/<stage>_result.json
docs/audit/<stage>_checklist.json
scripts/validate_<stage>.py
docs/audit_packages/<stage>_manifest.json
docs/audit_packages/<stage>.zip
```

如果 manifest 明确包含前端 adapter、后端 readonly route、smoke 脚本或 handoff 文档，也一并复制。

## 4. 禁止上传

不要上传：

```text
.env
token
secret
真实学生数据
真实课堂日志
飞书 token
provider raw prompt/response
node_modules
__pycache__
整个 xiaobei-core 仓库
```

## 5. 初始化和推送

如果是新 review repo：

```powershell
Set-Location $target
git init -b master
git add .
git commit -m "Add <stage> review package"
gh repo create ROLLcatCLUB/<repoName> --public --source . --remote origin --push
```

如果 GitHub repo 已存在：

```powershell
Set-Location $target
git init -b master
git add .
git commit -m "Refresh <stage> review package"
git remote add origin https://github.com/ROLLcatCLUB/<repoName>.git
git push -u origin master --force
```

## 6. 发给 GPT 的审核口径

把下面这段贴给 GPT：

```text
请审核这个 GitHub review area：

<repo-url>

重点读取：
- README.md
- docs/audit/*_result.json
- docs/audit/*_report.md
- docs/audit/*_checklist.json
- docs/audit_packages/*_manifest.json
- scripts/validate_*.py
- ZIP 包及 ZIP entry 对齐情况

请判断：
1. final_status 是否可收
2. validator no-arg / --root 是否通过
3. manifest_minus_zip / zip_minus_manifest 是否为空
4. ZIP 内部路径是否 clean
5. 是否夹带 forbidden files
6. 是否违反本阶段边界
7. 是否可以进入 recommended_next_stage

注意：
这是 review area，不是完整源码仓库。
如果某个 validator 需要 runtime 服务或上游 evidence，请区分“review tree 可复跑”和“单 ZIP 裸解包可复跑”。
不要把 package caveat 误判成业务失败。
```

## 7. Raw 链接模板

```text
Repo:
https://github.com/ROLLcatCLUB/<repoName>

README:
https://raw.githubusercontent.com/ROLLcatCLUB/<repoName>/master/README.md

Result:
https://raw.githubusercontent.com/ROLLcatCLUB/<repoName>/master/docs/audit/<stage>_result.json

Report:
https://raw.githubusercontent.com/ROLLcatCLUB/<repoName>/master/docs/audit/<stage>_report.md

Manifest:
https://raw.githubusercontent.com/ROLLcatCLUB/<repoName>/master/docs/audit_packages/<stage>_manifest.json

Validator:
https://raw.githubusercontent.com/ROLLcatCLUB/<repoName>/master/scripts/validate_<stage>.py
```
