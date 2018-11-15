const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const webpack = require('webpack');

module.exports = merge(common, {
	plugins:[
		new webpack.DefinePlugin({
			'process.env': {'NODE_ENV':JSON.stringify('production')}
		})
	],
	optimization: {
		minimizer: [new UglifyJSPlugin()]
	}
});