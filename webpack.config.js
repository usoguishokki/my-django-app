const path = require('path');

module.exports = {
  // あなたの主要なJSファイルへのパスを適切に変更してください
  entry: {
    tableDisplay: './src/tableDisplay.js'
  },  
  output: {
    path: path.resolve(__dirname, './myapp/static/js'),//出力先のパス
    filename: '[name].bundle.js',//出力ファイル名
  },
  module: {
    rules: [
      {
        test: /\.css$/,//CSSファイルに適用
        use: [
          'style-loader',//<style>タグとしてスタイルを適用
          'css-loader',//CSSファイルをJavaScriptsに読み込む
        ],
      },
    ],
  },
};