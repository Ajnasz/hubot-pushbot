/*jshint node: true*/

/// <reference path="typings/node.d.ts" />

var fs = require('fs');

var path = require('path');

module.exports = function (robot, scripts) {
	'use strict';
	let scriptsPath = path.resolve(__dirname, 'src');

	return fs.exists(scriptsPath, function (exists) {
		if (exists) {

			let ref = fs.readdirSync(scriptsPath);
			let results = [];

			for (let i = 0, len = ref.length; i < len; i++) {
				let script = ref[i];
				if (scripts && scripts.indexOf('*') < 0) {
					if (scripts.indexOf(script) > -1) {
						results.push(robot.loadFile(scriptsPath, script));
					}
				} else {
					results.push(robot.loadFile(scriptsPath, script));
				}
			}
			return results;
		}
	});
};
