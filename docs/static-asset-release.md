# 静的 Asset の build / release

## 保証すること

- SCSS は開発環境で明示的に CSS へ build し、生成 CSS もレビュー・commit する。
- JavaScript は build 時に全ブラウザーモジュールの構文と相対 import の参照先を検証する。
- 本番の `collectstatic` は CSS、JavaScript、画像を content hash 付きファイル名にする。
- ES Module 内の相対 import も hash 付き URL に書き換える。
- HTML は常に `Cache-Control: no-store`、hash 付き Asset は IIS で一年間 immutable とする。

## 開発・レビュー・commit

仮想環境を有効化してから実行する。

```powershell
npm ci
npm run build
python manage.py check
python manage.py test myapp.test_static_release
git status --short
git diff --check
git diff
```

SCSS の入口は `myapp/templates/_assets.scss-build.html` で管理する。SCSS の入口を追加した場合は、
この build manifest と実際に CSS を読むテンプレートの両方を更新する。

生成 CSS を含む差分をレビューして commit する。`staticfiles/` は release ごとの生成物なので
commit しない。

## IIS release

本番サーバーで release 対象 commit を checkout/fast-forward し、仮想環境を有効化して実行する。

```powershell
.\scripts\release-iis.ps1 -AppPoolName "<Application Pool 名>"
```

スクリプトは checkout、IIS site、physical path、App Pool の組み合わせ、clean worktree、
`DEBUG=False`、runtime Sass 無効、Django deploy check を確認する。既存 staticfiles と rollback 情報を
checkout の隣の `myproject-release-backups/` に保存した後で App Pool を停止し、`collectstatic --clear` と
manifest 検証を行う。
検証済みの `staticfiles/web.config` を配置してから App Pool を起動する。途中で失敗した場合、旧 HTML と
不完全な Asset の混在を避けるため App Pool は停止したままとなる。

`web.config` は manifest に記録された hash 付きファイルだけに一致する IIS `<location>` を生成する。
static root の既定値は `no-store` のため、hash なし URL、manifest、存在しない URL は immutable にならない。
IIS URL Rewrite module には依存しない。

SCSS、source map、旧検証用 `static/js/test.js`、テストディレクトリは本番の収集対象外とする。

release 後は HTML 応答の `Cache-Control: no-store` と、HTML 内の `/static/...<hash>...` URL、
hash 付き静的ファイル応答の `Cache-Control: public, max-age=31536000, immutable`、hash なし URL の
`Cache-Control: no-store, max-age=0` をブラウザー版・アプリ版の両方で確認する。JS/CSS の内容を変えて
再 release し、URL が変わることも確認する。
