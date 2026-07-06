# Gemini Markdown Viewer

ブラウザ版 Gemini (gemini.google.com) がコードブロックとして生のまま表示する Markdown を、
ページを離れずワンクリックでレンダリング表示するブラウザ拡張機能。

## 機能

- Gemini の応答内の **Markdown コードブロック**(言語ラベルが「Markdown」またはラベル不明のもの)に「👁 プレビュー」ボタンを注入。C や Python など他言語のブロックには出さない
- クリックするとオーバーレイモーダルが開き、Markdown をレンダリング表示
  (見出し・表・リスト・チェックボックス・引用・ネストしたコードブロック対応)
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

## Gemini の DOM 構造が変わったら

セレクタは `content/content.js` 冒頭の `SELECTORS` 定数にまとまっています。
`code-block` 要素が見つからない構造でも、`pre` 要素への右上フロートボタンで
フォールバック動作します。
