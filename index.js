var SourceMapConsumer = require("source-map").SourceMapConsumer;
var SourceMapSource = require("webpack-sources").SourceMapSource;
var RawSource = require("webpack-sources").RawSource;
var ModuleFilenameHelpers = require("webpack/lib/ModuleFilenameHelpers");
const name = "es3ify";
var transform = require(name).transform;


function Es3ifyPlugin(options) {
	if (typeof options !== "object") options = {};
	if (typeof options.compressor !== "undefined") {
		options.compress = options.compressor;
	}
	this.options = options;
}
module.exports = Es3ifyPlugin;

Es3ifyPlugin.prototype.apply = function (compiler) {
	var options = this.options;
	options.test = options.test || /\.js($|\?)/i;

	if (compiler.hooks) {
		compiler.hooks.compilation.tap(name, function (compilation) {
			if (options.sourceMap !== false) {
				compilation.hooks.buildModule.tap(name, buildModuleHook);
			}
			compilation.hooks.optimizeChunkAssets.tapAsync(name, optimizeChunkAssetsHook(compilation));
		});
	} else {
		compiler.plugin("compilation", function (compilation) {
			if (options.sourceMap !== false) {
				compilation.plugin("build-module", buildModuleHook);
			}
			compilation.plugin("optimize-chunk-assets", optimizeChunkAssetsHook(compilation));
		});
	}

	function buildModuleHook(module) {
		// to get detailed location info about errors
		module.useSourceMap = true;
	}

	function optimizeChunkAssetsHook(compilation) {
		return function (chunks, callback) {
			var files = [];
			chunks.forEach(function (chunk) {
				chunk.files.forEach(function (file) {
					files.push(file);
				});
			});
			compilation.additionalChunkAssets.forEach(function (file) {
				files.push(file);
			});
			files = files.filter(ModuleFilenameHelpers.matchObject.bind(undefined, options));
			files.forEach(function (file) {
				try {
					var asset = compilation.assets[file];
					var inputSourceMap, input;
					if (options.sourceMap !== false) {
						if (asset.sourceAndMap) {
							var sourceAndMap = asset.sourceAndMap();
							inputSourceMap = sourceAndMap.map;
							input = sourceAndMap.source;
						} else {
							inputSourceMap = asset.map();
							input = asset.source();
						}
						var sourceMap = new SourceMapConsumer(inputSourceMap);
					} else {
						input = asset.source();
					}
					var map;
					if (options.sourceMap !== false) {
						map = inputSourceMap;
					}
					var stream = transform(input);
					compilation.assets[file] = (map ?
						new SourceMapSource(stream, file, map, input, inputSourceMap) :
						new RawSource(stream));
				} catch (err) {
					if (err.line) {
						compilation.errors.push(new Error(file + " from es3ify\n" + err.message + " [" + file + ":" + err.line + "," + err.col + "]"));
					} else if (err.msg) {
						compilation.errors.push(new Error(file + " from es3ify\n" + err.msg));
					} else
						compilation.errors.push(new Error(file + " from es3ify\n" + err.stack));
				}
			});
			callback();
		}
	}
};
