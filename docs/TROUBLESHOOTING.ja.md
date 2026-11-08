# 困ったとき

| 症状 | 最初に確認すること |
|---|---|
| ChatGPTにトンネルが出ない | 対象ワークスペースとの関連付け、本人の利用権限 |
| ツールが見つからない | 接続の作成が完了したか、新しいチャットで対象を選べるか |
| 内部エラーになる | PCの電源、スリープ、ネット接続、起動ウィンドウのエラー |
| 読み取れない | 実際の絶対パス、許可したフォルダー、ファイルのアクセス権 |
| スマホからだけ使えない | その画面がカスタムツールを呼べるか。PC接続成功だけでは判定できません |
| PC再起動後に使えない | Windowsへのログオン、自動起動タスクの状態、保存先を動かしていないか |
| candidate already exists | ビルド済みです。自動削除はしません。更新を試す際は別フォルダーに新しく展開 |
| Credential file already exists | キーを上書きしないための停止です。キー変更は保存先を確認してから行ってください |
| HTTP 401 / expired_secret_key | APIキー失効。下記のローテーション手順で更新し、Compactだけ再起動します |
| MCP SSE probe returned 429 | 401とは別原因の可能性。PCのトンネルログと通信状態を確認します |

`The tool failed internally.` だけでは原因は特定できません。ファイルの削除や全設定の初期化はしないでください。

診断ログは `local-tunnel/runtime.log`、専用設定は `dc-preview-lab/full-state/` にあります。これらには個人情報・操作履歴が含まれる可能性があるため、GitHubのIssueへ丸ごと貼らないでください。エラー文、WindowsとNodeのバージョン、再現手順を、秘密情報を除いて伝えてください。

トンネルの診断方法は [公式ガイド](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) を確認してください。インストールしたクライアントの `help quickstart` でも対応する手順を確認できます。

書き込みやコマンド実行中に接続が切れた場合、処理が済んでいる可能性があります。結果を確認してから再試行してください。

## APIキー失効の復旧（HTTP 401 / expired_secret_key）

トンネルログの 401 Unauthorized、expired_secret_key（Your API key has expired）、または control-plane degraded / http_status 401 は、PC側のトンネルが期限切れのキーを利用している典型的な症状です。ChatGPTのプランの制限とは別です。

1. [OpenAI PlatformのAPIキー管理](https://platform.openai.com/settings/organization/api-keys)で、使用するトンネルと同じ組織・プロジェクトに新しいキーを発行します。Permissions は Restricted、Tunnels は Read と Use を許可し、不要な権限は付けません。利用期間も確認します。
2. 発行直後に表示される秘密キー全文をコピーします。Tracking ID（key_ で始まるもの）は使用できません。秘密キーをチャット、Issue、ログ、ソースに貼り付けないでください。
3. インストール時と**同じWindowsアカウント**で、インストール先の通常PowerShellから次を実行します。

~~~powershell
.\Update-TunnelKey.ps1
~~~

4. 新しいキーを非表示入力に貼り付けます。スクリプトは旧キーの読み取り検証後、同じフォルダーでDPAPI暗号化ファイルを置換し、暗号化された旧キーのバックアップを作ります。既存ファイルがない場合は初期登録の Save-TunnelKey.ps1 を使用してください。
5. **対象Compactトンネルだけ**を停止してから起動し直します。稼働中のプロセスは古いキーを読み込んだままなので、キー更新だけでは復旧しません。手動起動なら Ctrl+C で終了を確認して Start-Compact.ps1 を再実行。自動起動なら Windowsタスク「Desktop Commander Local Compact - Public」を停止し、当該インストールの tunnel-client.exe まで終了したことを確認してから再開してください。Remote版や無関係なnode.exeは停止しません。
6. PCの診断APIとChatGPTのCompactツール呼び出しで、両方の復旧を確認します。

~~~powershell
$healthBase = (Get-Content .\local-tunnel\health.url -Raw).Trim().TrimEnd('/')
Invoke-RestMethod ($healthBase + '/health/control-plane') |
    Select-Object status, state, reason_code
~~~

正常であれば status が ok、state が polling などになり、401が消えます。最後にChatGPTからCompact版でテスト用フォルダーを読み取ります。Stop-ScheduledTask が子プロセスまで止めたとは限りません。古い tunnel-client.exe が残っている場合、起動引数とパスで対象を厳密に特定し、他の作業を止めないよう注意してください。

更新後も401が続く場合は、**プロジェクト・Tunnels権限・コピーした値が秘密キー全文か・Windowsユーザー・起動時刻**を確認します。429だけが出る場合は別の接続制限や一時的な障害の可能性があります。429をキー期限切れと断定せず、PCのログに401がないか調べ、無条件のキー再発行や連続再試行を避けます。復旧確認まで暗号化バックアップは削除しないでください。
