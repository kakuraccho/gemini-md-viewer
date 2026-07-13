# Gemini Markdown Viewer

ブラウザ版 Gemini (gemini.google.com) がコードブロックとして生のまま表示する Markdown を、
ページを離れずワンクリックでレンダリング表示するブラウザ拡張機能。

## 機能

- Gemini の応答内の **Markdown コードブロック**(言語ラベルが「Markdown」またはラベル不明のもの)に「👁 プレビュー」ボタンを注入。C や Python など他言語のブロックには出さない
- 「👁 プレビュー」をクリックするとオーバーレイモーダルが開き、Markdown をレンダリング表示
  (見出し・表・リスト・チェックボックス・引用・ネストしたコードブロック対応)
- 「⇄ 置換」をクリックするとコードブロックがその場でレンダリング表示に置き換わる
  (「元に戻す」の再クリックで生データ表示に復帰)
- ストリーミング生成の途中でもクリック時点の最新テキストを表示
- モーダル内の「Raw をコピー」ボタンで元テキストをクリップボードへ
- 閉じる: ✕ ボタン / モーダル外クリック / Esc キー
- レンダリング結果は DOMPurify でサニタイズ済み(XSS 対策)

## インストール(開発版の読み込み)

### Firefox

1. アドレスバーに `about:debugging#/runtime/this-firefox` を入力
2. 「一時的なアドオンを読み込む...」をクリック
3. このフォルダの `manifest.json` を選択

4. **重要: サイトへのアクセス許可を付与する**(Manifest V3 の仕様で、これをしないとボタンが出ません)
   - `about:addons` を開く → 「Gemini Markdown Viewer」をクリック → 「権限」タブ
   - 「gemini.google.com のデータへのアクセス」(オプションの権限)を **ON** にする
   - または、gemini.google.com を開いた状態でツールバーの拡張機能(パズル)アイコン →
     この拡張機能の「許可」を選択
5. Gemini のタブを**リロード**する

※ Firefox の Manifest V3 ではサイトアクセス権限がデフォルトで OFF のため、手動で許可が必要です。
※ 一時的なアドオンは Firefox 再起動で消えます。恒久的に使うには AMO での署名が必要です。

### Chrome / Edge

1. `chrome://extensions`(Edge は `edge://extensions`)を開く
2. 「デベロッパー モード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
4. Gemini のタブを開いていた場合は**リロード**する

※ `browser_specific_settings` キーに関する警告が出ますが無視して問題ありません(Firefox 用の設定です)。

## トラブルシューティング: ボタンが表示されない

1. **Firefox の場合**: 上記のサイトアクセス許可(手順 4)を付与したか確認
2. Gemini のタブをリロードしたか確認(拡張機能の読み込み前に開いていたタブには注入されません)
3. Gemini のページで F12 → コンソールに `[mdviewer] initialized: ...` が出ているか確認
   - **出ていない** → content script が動いていない(権限 or リロードの問題)
   - **出ている**のにボタンがない → DOM 構造の問題なので、コンソール出力の数値を開発者に共有

## 動作確認(ログイン不要)

`test/fixture.html` をブラウザで直接開くと、Gemini の DOM 構造を模したページで
ボタン注入・モーダル表示・XSS サニタイズを確認できます。

## 構成

| パス | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3(Firefox / Chrome 共通) |
| `content/content.js` | コードブロック検出・ボタン注入・モーダル表示 |
| `content/content.css` | 注入ボタンのスタイル |
| `vendor/marked.min.js` | Markdown パーサ (marked v15) |
| `vendor/purify.min.js` | サニタイザ (DOMPurify v3) |
| `test/fixture.html` | ローカル検証用の Gemini 模擬ページ |

## AMO (addons.mozilla.org) への公開手順

### 1. 提出用 ZIP のビルド

```sh
npx web-ext lint    # AMO バリデータでチェック (errors: 0 であること)
npx web-ext build   # web-ext-artifacts/gemini_markdown_viewer-x.y.z.zip を生成
```

開発用ファイル(test/ など)は `web-ext-config.mjs` の設定で自動的に除外される。
バージョンを上げるときは `manifest.json` の `version` を更新してからビルドする。

### 2. AMO へ提出

1. [Firefox アカウント](https://accounts.firefox.com/)を用意し、
   [AMO Developer Hub](https://addons.mozilla.org/developers/) にログイン
2. 「Submit a New Add-on」→ 配布方法は **「On this site」(AMO で公開)** を選択
3. ビルドした ZIP をアップロード → 自動バリデーションが通るのを確認
4. **審査員向けメモ (Notes to Reviewer)** に同梱ライブラリの出典を書く(下記をコピペ可):

   ```
   Bundled third-party libraries (unmodified official minified builds):
   - marked v15.0.12  https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js
   - DOMPurify v3.4.11  https://cdn.jsdelivr.net/npm/dompurify@3.4.11/dist/purify.min.js
   - highlight.js v11.11.1  https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js
   All innerHTML assignments are sanitized with DOMPurify before insertion.
   ```

5. リスティング情報を入力(名前・概要・詳細説明・カテゴリ・スクリーンショット・ライセンス)
6. 送信すると審査キューに入る(通常数日)。承認されると AMO で公開される

### 補足

- **データ収集**: 何も収集しないため、`manifest.json` で
  `data_collection_permissions: { required: ["none"] }` を宣言済み
  (2025年11月以降の新規提出で必須)。プライバシーポリシーの提出は不要
- **対応バージョン**: Firefox 140+ / Firefox for Android 142+
  (`data_collection_permissions` 対応バージョンに合わせている)
- lint で出る `UNSAFE_VAR_ASSIGNMENT` 警告は innerHTML への代入に対するもので、
  すべて DOMPurify でサニタイズ済み(エラーではないので提出可能)

## Gemini の DOM 構造が変わったら

セレクタは `content/content.js` 冒頭の `SELECTORS` 定数にまとまっています。
`code-block` 要素が見つからない構造でも、`pre` 要素への右上フロートボタンで
フォールバック動作します。
