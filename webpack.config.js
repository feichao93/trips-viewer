const webpack = require('webpack')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MinifyPlugin = require('babel-minify-webpack-plugin')

module.exports = env => {
  env = env || {}
  const isProduction = env.prod

  return {
    context: __dirname,
    devtool: isProduction ? false : 'source-map',

    entry: ['./src/main.tsx'],

    output: {
      path: path.join(__dirname, './docs/'),
      filename: isProduction ? 'viewer.[chunkhash:6].js' : 'bundle.js',
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },

    module: {
      loaders: [
        { test: /\.tsx?$/, loaders: ['ts-loader'] },
        { test: /\.styl$/, loaders: ['style-loader', 'css-loader', 'stylus-loader'] },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({ template: 'public/index.html' }),
      new webpack.DefinePlugin({
        'node.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      }),
      new webpack.NamedModulesPlugin(),
      new webpack.ProvidePlugin({
        Snabbdom: 'snabbdom-pragma',
      }),
    ].concat(
      isProduction
        ? [new MinifyPlugin({}, { comments: false })]
        : [new webpack.HotModuleReplacementPlugin()],
    ),

    devServer: {
      port: 8080,
      hot: true,
      contentBase: 'public',
    },
  }
}
