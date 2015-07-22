/*jshint node:true*/
/* global describe, it, before, after */
'use strict';

var fs = require('fs');
var expect = require('chai').expect;
var path = require('path');

function getFileComments(cb) {
	fs.readFile(path.join(__dirname, '../src/pushbot.js'), function (err, data) {
		if (err) {
			throw err;
		}

		var lines = data.toString('utf8').split('\n');

		var commentLines = lines.filter(function (line) {
			return line.slice(0, 2) === '//';
		});

		cb(lines, commentLines);

	});
}

function trimComment(text) {
	return text.replace(/^\/\/\s*/, '').trim();
}

describe('pusbot docs', function () {
	var lines = null,
		commentLines = null;
	before(function (done) {
		getFileComments(function (fileLines, fileCommentLines) {
			lines = fileLines;
			commentLines = fileCommentLines;
			done();
		});
	});
	after(function () {
		lines = null;
		commentLines = null;
	});

	it('should contain comments', function () {
		expect(commentLines.length).to.be.above(0);
	});

	it('should be a comment', function () {
		expect(lines[0]).to.equal(commentLines[0]);
	});

	it('should start with Description section', function () {
		expect(commentLines[0]).to.have.string('Description');
	});

	it('should have description text', function () {
		return expect(trimComment(commentLines[1])).to.not.empty;
	});

	it('should have Dependencies section', function () {
		var dependencies = commentLines.indexOf('// Dependencies:');
		expect(dependencies).to.be.above(-1);
	});

	it('should list dependencies', function () {
		var dependencies = commentLines.indexOf('// Dependencies:');
		return expect(trimComment(commentLines[dependencies + 1])).to.not.empty;
	});

	it('should have Commands section', function () {
		var commands = commentLines.indexOf('// Commands:');
		expect(commands).to.be.above(-1);
	});

	it('should list commands', function () {
		var commands = commentLines.indexOf('// Commands:');
		return expect(trimComment(commentLines[commands + 1])).to.not.empty;
	});
});
