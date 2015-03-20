/*jshint node:true*/
/*global describe, it, beforeEach, afterEach*/

var expect = require('chai').expect;
var sinon = require('sinon');

var pushbot = require('../src/pushbot');

function rand() {
	return Math.round(Math.random() * 100);
}


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

function findCommand(robot, message) {
	'use strict';

	var item = robot.__commands.reduce(function (result, item) {
		if (result) {
			return result;
		}

		if (item.regexp.test(message)) {
			return item;
		}
	}, null);

	return item;
}

function createMessage(robot, message, room, userName, userId) {

	var item = findCommand(robot, message);

	var msg = null;

	if (item) {
		msg = createMsg(item, message, room, userName, userId);
	}

	return msg;
}

function callCommand(command, msg) {
	'use strict';
	command.cb(msg);
}
describe('pushbot', function () {
	'use strict';
	var robot, room, bot, userName, userId;
	beforeEach(function () {
		room = 'Room-' + rand();
		robot = createRobot();
		bot = pushbot(robot);
		userName = 'user-' + rand();
		userId = rand();
	});
	afterEach(function () {
		robot = null;
		bot = null;
	});

	describe('.join', function () {

		it('should add create a storage for room sessions', function () {
			expect(robot.brain.data.pushbot[room]).to.be.an('undefined');

			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);

			expect(robot.brain.data.pushbot).to.be.an('object');
			expect(robot.brain.data.pushbot[room]).to.be.an('array');
		});

		it('should add session to robot brain', function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);

			expect(robot.brain.data.pushbot[room]).to.have.length(1);
		});

		it('should set properties to session', function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('leader', msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');
		});

		it('should add sender to users list', function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);
			expect(session.users[0]).to.be.an('object');
			expect(session.users[0].name).to.deep.equal(msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(session.users[0].state).to.deep.equal('waiting');
		});

		it('should create as many sessions, as many times called', function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
			msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});
	});

	describe('.join with', function () {
		var newUserName, newUserId;
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
			newUserName = 'user2-' + rand();
			newUserId = rand();
		});
		afterEach(function () {
			newUserName = null;
			newUserId = null;
		});
		it('should add a new user to the existing session', function () {
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0].users).to.have.length(2);
		});
		it('set the second user to the new one', function () {
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0].users[1]).to.have.property('name', newUserName);
		});
	});

	describe('.join before', function () {
		var newUserName = 'user2-' + rand(),
			newUserId = rand();
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});
		it('should add a new session', function () {
			var msg = createMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			callCommand(findCommand(robot, '.join before ' + userName), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});
		it('should before the other session, which has mentioned username', function () {
			var msg = createMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			callCommand(findCommand(robot, '.join before ' + userName), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('leader', newUserName);
			expect(roomSessions[1]).to.have.property('leader', userName);
		});

		it('should have the same properties as the session with .join', function () {
			var msg = createMessage(robot, '.join before ' + userName, room, newUserName, newUserId);
			callCommand(findCommand(robot, '.join before ' + userName), msg);
			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('leader', msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);
			expect(session.users[0]).to.be.an('object');
			expect(session.users[0].name).to.deep.equal(msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(session.users[0].state).to.deep.equal('waiting');
		});
	});

	describe('.hold', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});
		it('should set session holded property to true', function () {
			var msg = createMessage(robot, '.hold hold message', room, userName, userId);
			callCommand(findCommand(robot, '.hold hold message'), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holded', true);
		});

		it('should set session holdMessage property to given message', function () {
			var holdMessage = 'hold message - ' + rand();
			var msg = createMessage(robot, '.hold ' + holdMessage, room, userName, userId);
			callCommand(findCommand(robot, '.hold ' + holdMessage), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holdMessage', holdMessage);
		});

	});

	describe('.unhold', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});
		it('should set holded channel to unhold', function () {
			var holdMessage = 'hold message - ' + rand();
			var msg = createMessage(robot, '.hold ' + holdMessage, room, userName, userId);
			callCommand(findCommand(robot, '.hold ' + holdMessage), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holdMessage', holdMessage);

			msg = createMessage(robot, '.unhold', room, userName, userId);
			callCommand(findCommand(robot, '.unhold'), msg);

			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');
		});
	});
	describe('.uhoh', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});

		it('should set user status to uhoh', function () {
			var msg = createMessage(robot, '.uhoh', room, userName, userId);
			callCommand(findCommand(robot, '.uhoh'), msg);
			var session = robot.brain.data.pushbot[room][0];

			expect(session.users[0]).to.have.property('state', 'uhoh');
		});
	});
	describe('.good', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});

		it('should set user status to good', function () {
			var msg = createMessage(robot, '.good', room, userName, userId);
			callCommand(findCommand(robot, '.good'), msg);
			var session = robot.brain.data.pushbot[room][0];

			expect(session.users[0]).to.have.property('state', 'good');
		});
	});
	describe('.nevermind', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});

		it('should remove the user from the channel', function () {
			var testUserName = 'user-' + rand();
			var testUserId = rand();
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, testUserName, testUserId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0].users).to.have.length(2);

			cmd = '.nevermind';
			msg = createMessage(robot, cmd, room, testUserName, testUserId);
			callCommand(findCommand(robot, cmd), msg);

			expect(roomSessions[0].users).to.have.length(1);

		});
	});
	describe('.message', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});

		it('should message property of the session', function () {
			var message = 'This is a message ' + rand();
			var cmd = '.message ' + message;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('message', message);
		});
	});
	describe('.at', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});

		it('should set session status', function () {
			var state = 'prod';
			var cmd = '.at ' + state;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('state', state);
		});
	});
	describe('.done', function () {
		beforeEach(function () {
			var msg = createMessage(robot, '.join', room, userName, userId);
			callCommand(findCommand(robot, '.join'), msg);
		});
		afterEach(function () {
		});
		it('should remove session', function () {
			var cmd = '.done';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot[room]).to.have.length(0);
		});
	});
	describe('.clearplease', function () {
		it('should remove all sessions from the room', function () {
			var msg = createMessage(robot, '.clearplease', room, userName, userId);

			sinon.spy(msg, 'topic');

			var cmd = findCommand(robot, '.clearplease');

			callCommand(cmd, msg);

			sinon.assert.calledOnce(msg.topic);
			sinon.assert.calledWithExactly(msg.topic, '');

			msg.topic.restore();
		});
	});
	describe.skip('.sessions', function () {});
});
