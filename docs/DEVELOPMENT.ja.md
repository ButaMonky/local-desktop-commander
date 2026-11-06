# 開発者向け

## 構成

- `dc-preview-lab/patches/contracts.js`：Compact変更のソース
- `dc-preview-lab/build.mjs`：固定した上流パッケージから候補版を再現
- `dc-preview-lab/full-server.mjs`：現在の本番構成から抽出したMCP起動処理
- `Start-Compact.ps1`：公開用の相対パスに整理したトンネル起動処理
- `Save-TunnelKey.ps1`：本人用キーの暗号化保存
- `Install-Autostart.ps1`：本人のログオン時の起動登録
- `dc-preview-lab/*test.mjs`：上流との比較テスト

Node.js 24以降を使います。依存関係の固定版は0.2.52です。上流の最新へ自動更新しません。

## ビルドとテスト

```powershell
npm.cmd ci --prefix dc-preview-lab/runtime-deps --ignore-scripts
npm.cmd run build
npm.cmd test
```

初回以外の再ビルドは別の新しい展開先で行います。ビルド処理は既存candidateを上書きしません。

標準テストは、プレビュー広告の抑制、全ツール定義の比較、実際のstdio接続で日本語・絵文字を含むファイルの読み取り結果が上流と一致することを確認します。stdio比較テストのネットワーク遮断は検証用の仕組みであり、本番のセキュリティサンドボックスではありません。

`npm.cmd run test:full` は追加検証です。既存の `~/.claude-server-commander/config.json` を読み、その設定をテスト専用フォルダーへ複製します。上流index.jsを起動するため、初回サービスなどの外部通信が発生し得ます。テスト専用ファイルの読み書き・編集・ターミナル実行と、既存設定への書き込みが起きないことを検証します。

## 起動処理の注意点

通常の導入ではSetupで専用設定を先に生成します。現在のfull-serverには元の構成との互換性のため、専用設定がない場合に既存Desktop Commanderの設定を読み込んで複製する処理が残っています。公開用Startスクリプトは専用設定がない場合に停止します。ユーザーへ直接full-serverの起動を案内しないでください。

ターミナル機能は通常ユーザーの権限で動作します。allowedDirectoriesはOSレベルの隔離ではありません。キーをMCP子プロセスへ引き継がないよう、full-serverの初期化中に環境変数を除去します。ログやconfigには実パス・履歴が含まれ得るため非公開です。

## 検証の範囲

公開前の検証結果は [検証記録](VERIFICATION.ja.md) に記載します。元の利用者環境で動いていた構成と、公開用に整えたスクリプトの検証を混同しません。別アカウントのChatGPT接続、別PC、スマホ、タスク登録からの再起動は、実際に確認できた場合だけ動作確認済みとします。
