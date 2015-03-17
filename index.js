/*jshint node: true*/

var fs = require('fs');

var path = require('path');

module.exports = function(robot, scripts) {
	'use strict';
	var scriptsPath;
	scriptsPath = path.resolve(__dirname, 'src');
	return fs.exists(scriptsPath, function(exists) {
		var i, len, ref, results, script;

		if (exists) {

			ref = fs.readdirSync(scriptsPath);
			results = [];

			for (i = 0, len = ref.length; i < len; i++) {
				script = ref[i];
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
