/*jshint node:true*/
/*global describe, it, beforeEach, afterEach*/

var expect = require('chai').expect;
var sinon = require('sinon');

var pushbot = require('../src/pushbot');

var robotProto = {
	hear: function (regexp, cb) {
		'use strict';
		this.__commands.push({
			regexp: regexp,
			cb: cb
		});
	},
	logger: {
		debug: function () {},
		error: function () {}
	},
	brain: {
		data: null,
		on: function (ev, cb) {
			'use strict';
			cb();
		}
	}
};

var msgProto = {
	message: {
		room: '',
		user: {
			name: '',
			id: 0
		}
	},
	match: null,
	topic: function () {
	},
	reply: function () {
	},
	send: function () {
	}
};

function createMsg(item, message, room, userName, userId) {
	'use strict';
	var msg = Object.create(msgProto);

	msg.match = message.match(item.regexp);
	msg.message.room = room;
	msg.message.user.name = userName;
	msg.message.user.id = userId;

	return msg;
}

function createRobot() {
	'use strict';
	var robot = Object.create(robotProto);

	robot.__commands = [];
	robot.brain.data = {};

	return robot;
}

function onMessage(robot, message, room, userName, userId) {
	'use strict';
	
	var item = robot.__commands.reduce(function (result, item) {
		if (result) {
			return result;
		}

		if (item.regexp.test(message)) {
			return item;
		}
	}, null);

	var msg = null;

	if (item) {
		msg = createMsg(item, message, room, userName, userId);
	}

	return {
		item: item,
		msg: msg
	};
}


describe('pushbot', function () {
	'use strict';
	var robot, room, bot, userName, userId;
	beforeEach(function () {
		room = 'Room-' + Math.round(Math.random() * 100);
		robot = createRobot();
		bot = pushbot(robot);
		userName = 'user-' + Math.round(Math.random() * 100);
		userId = Math.round(Math.random() * 100);
	});
	afterEach(function () {
		robot = null;
		bot = null;
	});

	describe('.join', function () {

		it('should add create a storage for room sessions', function () {
			expect(robot.brain.data.pushbot[room]).to.be.an('undefined');

			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);

			expect(robot.brain.data.pushbot).to.be.an('object');
			expect(robot.brain.data.pushbot[room]).to.be.an('array');
		});

		it('should add session to robot brain', function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);

			expect(robot.brain.data.pushbot[room]).to.have.length(1);
		});

		it('should set properties to session', function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('leader', res.msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');
		});

		it('should add sender to users list', function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);
			expect(session.users[0]).to.be.an('object');
			expect(session.users[0].name).to.deep.equal(res.msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(session.users[0].state).to.deep.equal('waiting');
		});

		it('should create as many sessions, as many times called', function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);
			res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});
	});

	describe('.join with', function () {
		var newUserName = 'user2-' + Math.round(Math.random() * 100),
			newUserId = Math.round(Math.random());
		beforeEach(function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);
		});
		afterEach(function () {
		});
		it('should add a new session', function () {
			var res = onMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			res.item.cb(res.msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});
		it('should before the other session, which has mentioned username', function () {
			var res = onMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			res.item.cb(res.msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('leader', newUserName);
			expect(roomSessions[1]).to.have.property('leader', userName);
		});

		it('should have the same properties as the session with .join', function () {
			var res = onMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			res.item.cb(res.msg);
			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('leader', res.msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);
			expect(session.users[0]).to.be.an('object');
			expect(session.users[0].name).to.deep.equal(res.msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(session.users[0].state).to.deep.equal('waiting');
		});
	});

	describe('.hold', function () {
		beforeEach(function () {
			var res = onMessage(robot, '.join', room, userName, userId);
			res.item.cb(res.msg);
		});
		afterEach(function () {
		});
		it('should set session holded property to true', function () {
			var res = onMessage(robot, '.hold hold message', room, userName, userId);
			res.item.cb(res.msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holded', true);
		});

		it('should set session holdMessage property to given message', function () {
			var msg = 'hold message - ' + Math.random(Math.random() * 100);
			var res = onMessage(robot, '.hold ' + msg, room, userName, userId);
			res.item.cb(res.msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holdMessage', msg);
		});

	});

	describe.skip('.unhold', function () {});
	describe.skip('.uhoh', function () {});
	describe.skip('.good', function () {});
	describe.skip('.nevermind', function () {});
	describe.skip('.message', function () {});
	describe.skip('.at', function () {});
	describe.skip('.done', function () {});
	describe.skip('.sessions', function () {});

	describe('.clearplease', function () {
		it('should remove all sessions from the room', function () {
			var res = onMessage(robot, '.clearplease', room, userName, userId);

			sinon.spy(res.msg, 'topic');

			res.item.cb(res.msg);

			sinon.assert.called(res.msg.topic);
			sinon.assert.calledWithExactly(res.msg.topic, '');

			res.msg.topic.restore();
		});
	});
});
