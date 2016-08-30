/*jshint node: true*/
module.exports = function (grunt) {
	'use strict';
	grunt.task.loadNpmTasks('grunt-ts');
	grunt.task.loadNpmTasks('grunt-release');
	grunt.task.loadNpmTasks('grunt-contrib-concat');
	grunt.task.loadNpmTasks('grunt-contrib-clean');
	grunt.task.loadNpmTasks('grunt-mocha-test');

	grunt.initConfig({
		ts: {
			options: {
				target: 'ES5',
				sourceMap: false
			},
			base: {
				src: 'src/pushbot.ts',
				dest: 'src/pushbot-out.js',
			},
			index: {
				src: 'index.ts',
				dest: 'index.js',
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
		},
		mochaTest: {
			test: {
				options: {
					ui: 'bdd',
					reporter: 'spec',
					require: 'coverage/blanket'
				},
				src: ['test/*.js']
			},
			'html-cov': {
				options: {
					reporter: 'html-cov',
					quiet: true,
					captureFile: 'coverage.html'
				},
				src: ['test/*.js']
			},
			'travis-cov': {
				options: {
					reporter: 'travis-cov'
				},
				src: ['test/*.js']
			}
		}
	});

	grunt.registerTask('compile', ['ts', 'concat', 'clean']);
	grunt.registerTask('test', ['mochaTest:test', 'mochaTest:travis-cov']);
};
