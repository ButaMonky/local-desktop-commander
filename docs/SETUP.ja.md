# 導入手順

この手順は現在のCompact版だけを対象にしています。PC側の準備 → 自分用トンネル → ChatGPT接続 → 読み取り確認、の順です。

## 1. 利用できるか確認

[OpenAIのトンネル設定](https://platform.openai.com/settings/organization/tunnels) を自分のアカウントで開きます。利用権限がない場合は、組織の管理者へ確認してください。PC側を設定しても、この権限の代わりにはなりません。

接続設定の最新条件と画面は [公式ガイド](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) を確認してください。トンネルとChatGPTのカスタムMCPには、それぞれ利用権限が必要です。

## 2. ソースを入手する

GitHubの「Code → Download ZIP」でダウンロードし、自分のユーザーフォルダー内などに展開します。インストール先は後から動かさないでください。

[Node.js公式サイト](https://nodejs.org/) からNode.js **24以降**をインストールしてください。

秘密情報を含まない、動作確認用のフォルダーとテキストファイルを用意します。例として以下では `C:\\DC-Test` を使います。自分で作った実際のフォルダーに置き換えてください。

## 3. PC側を準備する

展開したフォルダーで、通常のPowerShellを開きます。管理者として実行する必要はありません。

```powershell
.\\Setup-Compact.ps1 -AllowedDirectory "C:\\DC-Test"
```

この処理は固定版の依存関係の取得、Compact変更の適用、専用設定の作成、比較テストを行います。通信状況によって時間がかかります。既存のDesktop Commanderの設定は変更しません。

設定は `dc-preview-lab/full-state/config.json` に作られます。既存ファイルがある場合は上書きしません。スクリプト実行がWindowsのポリシーで禁止されている場合、組織管理PCでは管理者に相談してください。セキュリティ設定を無効化する必要はありません。

## 4. 自分用のトンネルを設定する

1. 公式の [トンネル設定画面](https://platform.openai.com/settings/organization/tunnels) から、自分用のトンネルを作成します。
2. 対象のChatGPTワークスペースを関連付けます。
3. 自分用の実行キーを用意します。トンネルの読み取り・使用に必要な範囲の権限にします。
4. 公式配布のWindows向け `tunnel-client.exe` を入手し、展開先の `local-tunnel/bin/tunnel-client.exe` に置きます。バイナリは本リポジトリに同梱していません。元の稼働構成はv0.0.15です。異なる版では公式CLIのヘルプで引数や設定形式を確認してください。
5. `local-tunnel/profile.example.yaml` を `local-tunnel/profile.yaml` という名前で保存します。
6. `REPLACE_WITH_YOUR_TUNNEL_ID` を自分のトンネルIDへ置き換えます。
7. `C:/YOUR/INSTALL/PATH` を、このリポジトリを展開した絶対パスへ置き換えます。パスの区切りは例と同じ `/` を使います。スペースを含むパスも、例の引用符を残してください。

キーをチャットやYAMLへ貼らず、次を実行してPC上の非表示入力で保存します。

```powershell
.\\Save-TunnelKey.ps1
```

キーはWindowsのユーザーにひも付いた暗号化ファイルとして保存します。ファイルとフォルダー全体を他人に渡さないでください。この保護は、同じWindowsユーザーで動くプログラムからのアクセスを防ぐものではありません。

## 5. 起動する

```powershell
.\\Start-Compact.ps1
```

このウィンドウを開いたままにします。終了する場合はCtrl+Cで停止します。利用できない場合は [困ったとき](TROUBLESHOOTING.ja.md) を確認してください。

## 6. ChatGPTへ接続する

[公式ガイドのChatGPT接続手順](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels#connect-from-chatgpt) に従い、カスタムMCPの追加で「Tunnel」を選択し、同じ自分用トンネルを指定します。

名前は `Desktop Commander Local Compact` にします。認証とアクセス範囲は公式画面の案内に従います。本人のワークスペース用として接続し、他の利用者へ自分のPCへの接続を共有しないでください。

ツールの操作承認を確認する設定がある場合は `prompt` を維持します。このPCに対するファイル操作・ターミナル操作を許可するツールであることを確認したうえで接続します。

## 7. 新しいチャットで確認する

新しいチャットで対象ツールを選択し、実際のテストフォルダーを指定して依頼します。

> Desktop Commander Local Compactだけを使って、C:\\DC-Testの一覧を表示してください。作成・変更・削除やコマンド実行はしないでください。

続けて、用意したテキストファイルを読み取ります。必要ならターミナルの確認は、ファイルを変更しない次の指示を使います。

> Desktop Commander Local Compactのターミナルで、Get-Locationだけを実行してください。

この3つが成功してから実際の作業に使います。他のツールが代わりに実行した場合は、この接続の成功とは扱いません。

## 8. 自動起動を設定する（任意）

手動起動で接続が成功してから、一度だけ実行します。先に手動起動中のウィンドウをCtrl+Cで停止してください。

```powershell
.\\Install-Autostart.ps1
```

自分のWindowsログオン時に起動する専用タスクを登録します。5分ごとの起動確認と失敗時の再試行も設定します。既存タスクは置き換えません。同名タスクがあれば停止します。管理者権限を付けず、Windowsへログオンしている間だけ動く構成です。

インストール先を動かした場合は、タスクのパスとトンネル設定の見直しが必要です。動作確認の済んだフォルダーを維持してください。

## 停止・削除する場合

Windowsのタスクスケジューラで `Desktop Commander Local Compact - Public` を停止・無効化します。手動起動はCtrl+Cで停止します。その後ChatGPT側の本人用接続を解除します。不要になったトンネルと実行キーは公式設定画面で無効化してください。他のDesktop Commanderのタスクは変更しません。
