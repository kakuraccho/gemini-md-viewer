// web-ext (lint / build) の設定
// AMO へ提出する ZIP に拡張機能本体だけが入るよう、開発用ファイルを除外する
export default {
  ignoreFiles: [
    "test",
    "test/**",
    ".claude",
    ".claude/**",
    "dempasai-site",
    "dempasai-site/**",
    "web-ext-config.mjs",
    "README.md",
    "web-ext-artifacts",
    "web-ext-artifacts/**",
  ],
  build: {
    overwriteDest: true,
  },
};
