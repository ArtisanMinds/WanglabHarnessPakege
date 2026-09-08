# Model Supplier Routes

DeepSeek and Grok select OpenCode suppliers independently. OpenAI and Claude
continue to follow cc-switch's current Codex and Claude selections. Each request
reads the selected supplier's current URL and key from the cc-switch database.
OpenCode's additive provider flags and Codex's current selection are preserved.

On the existing Wanglab relay host:

```bash
bash scripts/model-relays/install.sh
cc-switch route deepseek
cc-switch route grok
```

Add and edit suppliers with `cc-switch -a open-code`. The route selector lists
those suppliers, verifies the chosen supplier's live model catalog, and saves
its ID under `wanglab.route.deepseek` or `wanglab.route.grok` in cc-switch's
settings table. A switch applies to new requests; existing streams finish on
their original supplier. It does not copy credentials or modify Codex providers.

For scripts, use `cc-switch route deepseek <provider-id>` or
`cc-switch route grok <provider-id>`. Append `--list` to list without switching.
Before the first explicit selection, exactly one configured provider whose model
IDs match a family can be used automatically. An ambiguous or deleted selection
returns an error instead of silently choosing another supplier.

DeepSeek's official endpoint uses `/anthropic/v1/messages`. Other suppliers use
their configured API base plus `/messages`. Set `options.anthropicBaseURL` in
the supplier's OpenCode configuration when its Messages API uses another base.
Both chat and Messages requests use the selected supplier's credential.

Ports stay on localhost: DeepSeek `15724`, catalogs `15725`, Grok `15726`.
The existing Nginx routes on `31415` through `31418` need no changes.
The installer backs up the previous wrapper and relay files before restarting
`wanglab-local-model-relays.service` and checking all three local health routes.

## 中文

在服务器运行安装脚本后，用 `cc-switch route deepseek` 和
`cc-switch route grok` 分别选择供应商。在 `cc-switch -a open-code` 中添加或编辑
供应商，选择时会验证该上游的真实模型列表。两个选择独立保存，新请求立即生效，
进行中的响应继续完成。OpenAI、Claude 仍使用原有的 cc-switch 当前供应商。

Grok 留在 OpenCode 中，不进入 Codex。客户端地址和 Nginx 配置不需要修改。
官方 DeepSeek 自动使用其 Messages 路径；其他上游若有不同的 Messages 地址，
在供应商配置的 `options.anthropicBaseURL` 中设置即可。
