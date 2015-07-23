/*jshint node: true*/
module.exports = function (grunt) {
	'use strict';
	grunt.loadNpmTasks('grunt-typescript');
	grunt.loadNpmTasks('grunt-release');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-blanket');

	grunt.initConfig({
		typescript: {
			base: {
				src: 'src/pushbot.ts',
				dest: 'src/pushbot-out.js',
				target: 'ES5',
				module: 'commonjs'
			},
			index: {
				src: 'index.ts',
				dest: 'index.js',
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

	grunt.registerTask('compile', ['typescript', 'concat', 'clean']);
	grunt.registerTask('test', ['mochaTest:test', 'mochaTest:travis-cov']);
};
