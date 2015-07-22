/*jshint node: true*/
module.exports = function (grunt) {
	'use strict';
	grunt.loadNpmTasks('grunt-typescript');
	grunt.loadNpmTasks('grunt-release');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.initConfig({
		typescript: {
			base: {
				src: 'src/pushbot.ts',
				dest: 'src/pushbot-out.js',
				target: 'ES5',
				module: 'commonjs'
			}
		},
		concat: {
			base: {
				src: ['COMMANDS.txt', 'src/pushbot-out.js'],
				dest: 'src/pushbot.js'
			}
		},
		clean: {
			base: {
				src: 'src/pushbot-out.js'
			}
		}
	});

	grunt.registerTask('compile', ['typescript', 'concat', 'clean']);
};
