# Windows Server / SQL Server 移行用エクスポート

元Site: https://monja-accounting.mnoda1979.chatgpt.site/
元ソース commit: 7b74eaf9ce3d8fbbcd64824b1ebd906ede2694b5
取得日: 2026-10-12

## 内容と実行方式

画面は既存のReact画面を通常のJavaScriptへ変換したものです。`public/app.js` と `public/styles.css` は作成済みなので、Windows側でコンパイル・TypeScript・JSX・Tailwindビルドは不要です。Node.jsで `server.js` を実行します。React等の画面依存ライブラリは app.js 内に同梱されています。インターネット上のCDNには依存しません。

`lib/*.js` は既存の会計・消費税・CSV処理を引き継いだ、コンパイル不要のサーバー用JavaScriptです。`screen-source/` は編集用のJavaScriptコンポーネントです。通常実行は public/app.js を使用します。screen-source の部品を変更して再結合する場合は別途バンドル作業が必要ですが、public/app.js自体を変更する場合は再ビルド不要です。

元Siteは変更・再公開していません。実運用データの書込みやテスト会社の新規作成もしていません。

## DB取得状況（重要）

全9テーブルのSQL Server用CREATE TABLE、インデックス、既存保護トリガー相当を `sql/01-create-tables.sql` に同梱しました。現在の保存構造を維持し、詳細情報は nvarchar(max) のJSONです。税情報を推測・再計算していません。全項目を通常の列へ正規化したDBではありません。

取得済み: companies 2 / accounts 53 / years 2 / periods 24 / subaccounts 2 / journals 10 / lines 20 / tax_codes 7 / audit 53。
auditの実件数は55件ですが、長い2件は取得機能の文字数上限により全文を取得できませんでした。両方ともACCOUNT_INITIALIZE履歴の可能性がありますが、内容を推測して復元していません。対象IDは data/database-partial.json の missing を参照してください。

`data/database-partial.json` と `sql/02-data-PARTIAL.sql` はその2件を含まない部分エクスポートです。完全な本番復元には使用しないでください。欠けた履歴を勝手に再生成していません。取得前後の会社バージョンはそれぞれ1と14で変わっていません。

完全移行には元Siteで会社を選択し、設定 → 全データJSONを保存、を会社ごとに実行してください（現在は2社）。この経路は長い監査履歴を含みます。取得した2つのJSONを、次のimport-data.jsで空の移行先DBへ投入できます。部分エクスポートはこのインポーターが拒否します。

## セットアップ

1. Windows ServerへNode.js 22以降とSQL Server Express 2025、SSMSをインストールします。
2. SQL Serverで新しい空DB `MonjaAccounting` を作成し、そのDBを選択して `sql/01-create-tables.sql` をSSMSで実行します。既存DBへ上書きしないでください。
3. SQL ServerのTCP/IPを有効化し、使用する固定TCPポートを `.env` に設定します。SQLポートはインターネットへ公開しないでください。
4. 本フォルダーで `npm ci --ignore-scripts` を実行します。依存ライブラリのインストールだけで、アプリのコンパイルはありません。
5. `.env.example` を `.env` としてコピーし、DB接続と公開URLを設定します。URL末尾の `/` は不要です。TLS証明書を正しく設定し、DB_TRUST_CERT=falseを基本とします。
6. DBの空テーブルへ完全バックアップを取り込みます。

```powershell
node --env-file=.env scripts/import-data.js "C:\backups\company1.json" "C:\backups\company2.json"
```

取込は全ファイルを1トランザクションで実行し、既存データがあるDBを拒否します。元のID・owner・監査履歴・明細版を保持します。

7. 移行先ログインユーザーを設定します。PowerShellでパスワードを対話入力し、一時環境変数で生成スクリプトへ渡します。

```powershell
$secure = Read-Host "Login password (16 characters or more)" -AsSecureString
$env:APP_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
node scripts/create-user.js
Remove-Item Env:APP_PASSWORD
```

ownerの入力には、取得済みJSONの companies.owner 値を使用します。これはChatGPTのログインIDではなく、元DBの会社所有者識別子です。既存の監査記録と会社所有者を維持するため同じ識別子を利用します。users.jsonはパスワードのsaltとscrypt hashを保存します。ChatGPT認証は移行先では利用せず、HTTPSのBasic認証に置き換えています。同じownerの複数ユーザーを登録すると同じ監査実行者IDになるため、この版は一人管理者運用を前提とします。

8. `npm start` でアプリを起動します。IISから `http://127.0.0.1:3000` へ転送します。IISにURL RewriteとApplication Request Routingを導入し、サーバー設定でProxyを有効にします。公開用HTTPS証明書とホスト名を設定し、`iis-web.config.example` をIIS専用の空フォルダーへ `web.config` として配置します。ソース・data・.env・users.jsonをIISの静的公開フォルダーへ置かないでください。

9. Nodeを再起動時にも起動するWindowsサービス等として登録します。サービスの作業ディレクトリはこのフォルダー、起動コマンドは `node --env-file=.env server.js` です。DBアプリユーザーは対象DBだけの必要権限に限定してください。インポート用ユーザーは別途必要に応じて使い分けます。

## 保持する動作

仕訳、複合仕訳、元帳、試算表、P/L、B/S、消費税計算・集計、CSV出力と確認付き取込、OPEN/CLOSED/LOCKED判定は元の会計ロジックを継承しています。更新はSQL Server側でトランザクション化し、会社versionで同時更新を検出します。明細・監査ログの更新、物理削除、税区分の税率・種別変更はDBトリガーでも拒否します。SQLを直接実行できる管理者の権限まで制限するものではありません。

## 確認範囲・未完了

JavaScript構文、画面JS/CSS生成、取得JSON、既存「テスト」会社の集計、およびHTTPサーバーの認証と静的配信を最小限確認します。この作業環境にはSQL ServerとWindows Serverがないため、DDL適用・実SQLトランザクション・IIS・画面操作の実機確認は未実施です。本番運用開始前に移行先で確認が必要です。元アプリの網羅的回帰テストも未実施です。

このパッケージは移行用エクスポートで、完全DB取得と移行先での動作確認まで完了した本番リリースではありません。

## バックアップ

SQL Serverの定期バックアップをVM外にも保存してください。パッケージには会計データを含むため公開配布しないでください。元Siteを停止・削除する前に、完全バックアップと移行先の残高・監査履歴・件数を照合してください。
