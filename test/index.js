/*jshint node:true*/
/*global describe, it, beforeEach, afterEach*/

'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');

var pushbot = require('../src/pushbot');

var UserStates = {
	Good: 0,
	Uhoh: 1,
	Waiting: 2
};

function rand() {
	return Math.round(Math.random() * 10000000);
}


var robotProto = {
	hear: function (regexp, cb) {
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
	var msg = Object.create(msgProto);

	msg.match = message.match(item.regexp);
	msg.message.room = room;
	msg.message.user.name = userName;
	msg.message.user.id = userId;

	return msg;
}

function createRobot() {
	var robot = Object.create(robotProto);

	robot.__commands = [];
	robot.brain.data = {};

	return robot;
}

function findCommand(robot, message) {
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
	if (typeof command === 'undefined') {
		throw new Error('Command not found');
	}

	command.cb(msg);
}

function getRoom(robot, room) {
	return robot.brain.data.pushbot[room];
}

function getRoomSessions(robot, room) {
	return getRoom(robot, room).sessions;
}

function getFirstRoomSession(robot, room) {
	return getRoomSessions(robot, room)[0];
}

function getSessionsFirstUser(session) {
	return session.users[0];
}

function getFirstSessionsFirstUser(robot, room) {
	return getSessionsFirstUser(getFirstRoomSession(robot, room));
}

function ensureTopic(msg, topic) {
	sinon.assert.calledWithExactly(msg.topic, topic);
}

function ensureReply(msg, reply) {
	sinon.assert.calledWithExactly(msg.reply, reply);
}

function genUserName() {
	return 'user-special.chars_' + rand();
}

describe('pushbot', function () {
	var robot, room, bot, userName, userId;
	beforeEach(function () {
		room = 'Room-' + rand();
		robot = createRobot();
		bot = pushbot(robot);
		userName = genUserName();
		userId = rand();
	});
	afterEach(function () {
		robot = null;
		bot = null;
	});

	describe('.join', function () {

		it('should add create a storage for room sessions', function () {
			expect(robot.brain.data.pushbot[room]).to.be.an('undefined');

			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot).to.be.an('object');
			expect(robot.brain.data.pushbot[room]).to.be.an('object');
			expect(robot.brain.data.pushbot[room].sessions).to.be.an('array');
			expect(robot.brain.data.pushbot[room].holded).to.be.an('boolean');
		});

		it('should add session to robot brain', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot[room].sessions).to.have.length(1);
		});

		it('should set properties to session', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);

			expect(session).to.have.property('leader', msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');
		});

		it('should add sender to users list', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);

			var firstUser = getSessionsFirstUser(session);
			expect(firstUser).to.be.an('object');
			expect(firstUser.name).to.deep.equal(msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(firstUser.state).to.deep.equal(UserStates.Waiting);
		});

		it('should create as many sessions, as many times called', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);


			msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = getRoomSessions(robot, room);

			expect(roomSessions).to.have.length(2);
		});

		it('should run the command even if with whitespace on the end', function () {
			expect(robot.brain.data.pushbot[room]).to.be.an('undefined');

			var cmd = '.join ';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot).to.be.an('object');
			expect(robot.brain.data.pushbot[room]).to.be.an('object');
			expect(robot.brain.data.pushbot[room].sessions).to.be.an('array');
		});

		describe('set topic', function () {
			it('should add username to room topic', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, userName, userId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName);

				msg.topic.restore();
			});

			it('should separate sessions by |', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, userName, userId);

				callCommand(findCommand(robot, cmd), msg);
				var newUserName = genUserName();
				var newUserId = rand();
				msg = createMessage(robot, cmd, room, newUserName, newUserId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' | ' + newUserName);

				msg.topic.restore();

				msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' | ' + newUserName + ' | ' + userName);

				msg.topic.restore();
			});
		});
	});

	describe('.join with', function () {
		var newUserName, newUserId;
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

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

			expect(getFirstRoomSession(robot, room).users).to.have.length(2);
		});
		it('should set the second user to the new one', function () {
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users[1]).to.have.property('name', newUserName);
		});

		it('should run the command even with whitespace on the end', function () {
			var cmd = '.join with ' + userName + '\t';
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users).to.have.length(2);
		});

		it('should not allow to join to a session where he already in', function () {
			var cmd = '.join with ' + userName + '\t';
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);
			msg = createMessage(robot, cmd, room, newUserName, newUserId);
			sinon.spy(msg, 'reply');
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users).to.have.length(2);
			ensureReply(msg, 'User already participating in session');
		});

		describe('set topic', function () {
			it('should add new username to title', function () {
				var cmd = '.join with ' + userName;
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' + ' + newUserName);

				msg.topic.restore();
			});

			it('should add new username to title', function () {
				var cmd = '.join with ' + userName;
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' + ' + newUserName);

				msg.topic.restore();
			});

			it('should add new username to title', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' | ' + newUserName);
				msg.topic.restore();
				cmd = '.join with ' + newUserName;
				msg = createMessage(robot, cmd, room, userName, userId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName + ' | ' + newUserName + ' + ' + userName);
				msg.topic.restore();
			});
		});
	});

	describe('.join before', function () {
		var newUserName = 'user2-' + rand(),
			newUserId = rand();
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});
		it('should add a new session', function () {
			var cmd = '.join before ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = getRoomSessions(robot, room);

			expect(roomSessions).to.have.length(2);
		});
		it('should before the other session, which has mentioned username', function () {
			var cmd = '.join before ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = getRoomSessions(robot, room);

			expect(getFirstRoomSession(robot, room)).to.have.property('leader', newUserName);
			expect(roomSessions[1]).to.have.property('leader', userName);
		});

		it('should have the same properties as the session with .join', function () {
			var cmd = '.join before ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);

			expect(session).to.have.property('leader', msg.message.user.name);
			expect(session).to.have.property('state', '');
			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');

			// TODO We should be able to set this from configuration
			expect(session).to.have.property('message', '-');

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);

			var firstUser = getSessionsFirstUser(session);

			expect(firstUser).to.be.an('object');
			expect(firstUser.name).to.deep.equal(msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(firstUser.state).to.deep.equal(UserStates.Waiting);
		});

		describe('set topic', function () {
			it('should add usernames to topic in order', function () {
				var users = [genUserName(), genUserName()];
				users.forEach(function (name, i) {
					var cmd = '.join before ' + userName;
					var msg = createMessage(robot, cmd, room, name, rand());

					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);
					sinon.assert.calledOnce(msg.topic);
					ensureTopic(msg, users.slice(0, i + 1).concat([userName]).join(' | '));

					msg.topic.restore();
				});
			});
		});
	});

	describe('.hold', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});
		it('should set room holded property to true', function () {
			var holdMessage = 'hold message - ' + rand();
			var cmd = '.hold ' + holdMessage;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomData = getRoom(robot, room);

			expect(roomData).to.have.property('holded', true);
		});

		it('should set room holdMessage property to given message', function () {
			var holdMessage = 'hold message - ' + rand();
			var cmd = '.hold ' + holdMessage;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomData = getRoom(robot, room);

			expect(roomData).to.have.property('holdMessage', holdMessage);
		});

		describe('set title', function () {
			it('should add HOLD and hold message to title', function () {
				var holdMessage = 'hold message - ' + rand();
				var cmd = '.hold ' + holdMessage;
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				var regexp = new RegExp('^HOLD: . ' + holdMessage);
				sinon.assert.calledWithMatch(msg.topic, sinon.match(regexp));

				msg.topic.restore();
			});
		});
	});

	describe('.unhold', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});
		it('should set holded channel to unhold', function () {
			var holdMessage = 'hold message - ' + rand();
			var cmd = '.hold ' + holdMessage;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomData = getRoom(robot, room);

			expect(roomData).to.have.property('holdMessage', holdMessage);

			cmd = '.unhold';
			msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(roomData).to.have.property('holded', false);
			expect(roomData).to.have.property('holdMessage', '');
		});

		describe('set topic', function () {
			it('should restore the original title', function () {
				var holdMessage = 'hold message - ' + rand();
				var cmd = '.hold ' + holdMessage;
				var msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);

				cmd = '.unhold';
				msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName);
			});
		});
	});
	describe('.uhoh', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should set user status to uhoh', function () {
			var cmd = '.uhoh';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
			expect(getFirstSessionsFirstUser(robot, room)).to.have.property('state', UserStates.Uhoh);
		});
	});
	describe('.good', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should set user status to good', function () {
			var cmd = '.good';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstSessionsFirstUser(robot, room)).to.have.property('state', UserStates.Good);
		});

		it('should send with everyone is ready if every user is good', function () {
			var cmd = '.good';
			var msg = createMessage(robot, cmd, room, userName, userId);

			sinon.spy(msg, 'send');

			callCommand(findCommand(robot, cmd), msg);

			sinon.assert.calledWithExactly(msg.send, userName + ': Everyone is ready');
		});

		describe('set topic', function () {
			it('should mark if a user is good next to it\'s username', function () {
				var cmd = '.good';
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				var regexp = new RegExp('✓' + userName);
				sinon.assert.calledWithMatch(msg.topic, sinon.match(regexp));
			});
		});
	});
	describe('.nevermind', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should remove the user from the channel', function () {
			var testUserName = genUserName();
			var testUserId = rand();
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, testUserName, testUserId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users).to.have.length(2);

			cmd = '.nevermind';
			msg = createMessage(robot, cmd, room, testUserName, testUserId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users).to.have.length(1);

		});

		it('should not do anything if user not in session', function () {
			var testUserName = genUserName();
			var testUserId = rand();

			var cmd = '.nevermind';
			var msg = createMessage(robot, cmd, room, testUserName, testUserId);

			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room).users).to.have.length(1);
		});
	});
	describe('.message', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should set message property of the session', function () {
			var message = 'This is a message ' + rand();
			var cmd = '.message ' + message;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room)).to.have.property('message', message);
		});

		it('should accept non us characters', function () {
			var message = 'This is a message ' + rand() + ' árvíztűrő tükörfúrógép';
			var cmd = '.message ' + message;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room)).to.have.property('message', message);
		});

		describe('set topic', function () {
			it('should add message to the topic', function () {
				var message = 'This is a message ' + rand();
				var cmd = '.message ' + message;
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				ensureTopic(msg, message + ' ' + userName);

				msg.topic.restore();
			});

			describe('when the message is "-"', function () {

				it('should remove the message from the topic', function () {
					var message = 'This is a message ' + rand();
					var cmd = '.message ' + message;
					var msg = createMessage(robot, cmd, room, userName, userId);
					callCommand(findCommand(robot, cmd), msg);

					cmd = '.message -';

					msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);

					ensureTopic(msg, userName);
				});
			});
		});
	});
	describe('.at', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should set session status', function () {
			var state = 'prod';
			var cmd = '.at ' + state;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room)).to.have.property('state', state);
		});

		it('should accept non us characters', function () {
			var state = 'árvíztűrés';
			var cmd = '.at ' + state;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room)).to.have.property('state', state);
		});

		it('should not allow user, who is not in session to change state', function () {
			var state = 'foo';
			var cmd = '.at ' + state;
			var msg = createMessage(robot, cmd, room, 'unkown-' + genUserName(), rand());

			sinon.spy(msg, 'reply');
			callCommand(findCommand(robot, cmd), msg);

			expect(getFirstRoomSession(robot, room)).to.have.property('state', '');
			ensureReply(msg, 'You are not leading any session');
		});
	});
	describe('.done', function () {
		beforeEach(function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
		});
		afterEach(function () {
		});

		it('should remove session', function () {
			var cmd = '.done';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = getRoomSessions(robot, room);

			expect(roomSessions).to.have.length(0);
		});

		describe('has more sessions', function () {
			var newUserName = 'user2-' + rand();
			var newUserId = rand();

			beforeEach(function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);
				callCommand(findCommand(robot, cmd), msg);
			});
			it('should remove session, and call for next session', function () {
				var cmd = '.done';
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'send');
				sinon.spy(msg, 'topic');
				callCommand(findCommand(robot, cmd), msg);

				var roomSessions = getRoomSessions(robot, room);

				expect(roomSessions).to.have.length(1);
				sinon.assert.calledWithExactly(msg.send, newUserName + ': You are up!');
				ensureTopic(msg, newUserName);
			});
		});

		describe('has no sessions', function () {
			it('must do nothing', function () {
				var cmd = '.done';
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'send');
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				var roomSessions = getRoomSessions(robot, room);

				expect(roomSessions).to.have.length(0);
				sinon.assert.notCalled(msg.send);
				ensureTopic(msg, '');
			});
		});
	});
	describe('.clearplease', function () {
		var msg;
		beforeEach(function () {
			msg = createMessage(robot, '.clearplease', room, userName, userId);
		});
		afterEach(function () {
			msg = null;
		});
		it('should remove all sessions from the room', function () {
			var cmd = findCommand(robot, '.clearplease');

			callCommand(cmd, msg);
			var roomSessions = getRoomSessions(robot, room);

			expect(roomSessions).to.have.length(0);
		});

		it('should reset channel title', function () {
			sinon.spy(msg, 'topic');
			var cmd = findCommand(robot, '.clearplease');

			callCommand(cmd, msg);

			sinon.assert.calledOnce(msg.topic);
			ensureTopic(msg, '');

			msg.topic.restore();
		});
	});
	describe('.kick', function () {
		var newUserName = genUserName();
		var newUserId = rand();

		beforeEach(function () {
			var cmd, msg, session;

			cmd = '.join';
			msg = createMessage(robot, cmd, room, userName, userId);

			callCommand(findCommand(robot, cmd), msg);

			session = getFirstRoomSession(robot, room);

			expect(session.users).to.have.length(1);

			cmd = '.join with ' + userName;
			msg = createMessage(robot, cmd, room, newUserName, newUserId);

			sinon.spy(msg, 'reply');

			callCommand(findCommand(robot, cmd), msg);

			sinon.assert.notCalled(msg.reply);

			session = getFirstRoomSession(robot, room);

			expect(session.users).to.have.length(2);
		});
		afterEach(function () {
		});

		it('should remove user from the queue', function () {
			var cmd = '.kick ' + newUserName;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);

			expect(session.users).to.have.length(1);
		});

		it('should remove user from the topic', function () {
			var cmd = '.kick ' + newUserName;
			var msg = createMessage(robot, cmd, room, userName, userId);

			sinon.spy(msg, 'topic');

			callCommand(findCommand(robot, cmd), msg);

			sinon.assert.calledOnce(msg.topic);
			ensureTopic(msg, userName);
		});

		it('should not allow to kick, if user not in session', function () {
			var cmd = '.kick ' + newUserName;
			var thirdUserName = genUserName();
			var thirdUserId = genUserName();
			var msg = createMessage(robot, cmd, room, thirdUserName, thirdUserId);

			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);

			expect(session.users).to.have.length(2);
		});

		describe('user in good state', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.good';
				msg = createMessage(robot, cmd, room, newUserName, newUserId);
				callCommand(findCommand(robot, cmd), msg);
			});
			afterEach(function () {
			});
			it('should remove user from the queue', function () {
				var cmd = '.kick ' + newUserName;
				var msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);

				var session = getFirstRoomSession(robot, room);

				expect(session.users).to.have.length(1);
			});

			it('should remove user from the topic', function () {
				var cmd = '.kick ' + newUserName;
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName);
			});
		});

		describe('user in bad state', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.bad';
				msg = createMessage(robot, cmd, room, newUserName, newUserId);
				callCommand(findCommand(robot, cmd), msg);
			});
			afterEach(function () {
			});
			it('should remove user from the queue', function () {
				var session = getFirstRoomSession(robot, room);

				var cmd = '.kick ' + newUserName;
				var msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);

				expect(session.users).to.have.length(1);
			});

			it('should remove user from the topic', function () {
				var cmd = '.kick ' + newUserName;
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				ensureTopic(msg, userName);
			});
		});
	});
	describe('.sessions', function () {
		describe('no sessions', function () {
			it('should reply to user that no sessions', function () {
				var cmd = '.sessions';
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'reply');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.reply);
				ensureReply(msg, 'No sessions so far');
			});
		});
		describe('with sessions', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.join';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);
			});
			it('should reply to user that no sessions', function () {
				var cmd = '.sessions';
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'reply');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.reply);
				ensureReply(msg, 'leader: ' + userName);
			});

			describe('with more users', function () {
				var newUserName = 'new-user-' + rand();
				var newUserId = rand();

				beforeEach(function () {
					var cmd, msg;
					cmd = '.join with ' + userName;
					msg = createMessage(robot, cmd, room, newUserName, newUserId);
					callCommand(findCommand(robot, cmd), msg);
				});
				it('should reply to user that no sessions', function () {
					var cmd = '.sessions';
					var msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'reply');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.calledOnce(msg.reply);
					ensureReply(msg, 'leader: ' + userName + ', participants: ' + newUserName);
				});

				it('should include state', function () {
					var cmd = '.at prod';
					var msg = createMessage(robot, cmd, room, userName, userId);

					callCommand(findCommand(robot, cmd), msg);

					cmd = '.sessions';

					msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'reply');
					callCommand(findCommand(robot, cmd), msg);
					ensureReply(msg, '<prod>, leader: ' + userName + ', participants: ' + newUserName);

				});

				it('should include message', function () {
					var cmd = '.message foo bar baz';
					var msg = createMessage(robot, cmd, room, userName, userId);

					callCommand(findCommand(robot, cmd), msg);

					cmd = '.sessions';

					msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'reply');
					callCommand(findCommand(robot, cmd), msg);
					ensureReply(msg, 'message: foo bar baz, leader: ' + userName + ', participants: ' + newUserName);
				});

				it('should include message and state', function () {
					var cmd = '.message foo bar baz';
					var msg = createMessage(robot, cmd, room, userName, userId);

					callCommand(findCommand(robot, cmd), msg);
					cmd = '.at prod';
					msg = createMessage(robot, cmd, room, userName, userId);
					callCommand(findCommand(robot, cmd), msg);

					cmd = '.sessions';

					msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'reply');
					callCommand(findCommand(robot, cmd), msg);
					ensureReply(msg, '<prod>, message: foo bar baz, leader: ' + userName + ', participants: ' + newUserName);
				});
			});
		});
	});

	describe('.drive', function () {
		var newUserName = genUserName();
		var newUserId = rand();
		beforeEach(function () {
			var cmd, msg;
			cmd = '.join';
			msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			cmd = '.join with ' + userName;
			msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);

			var session = getFirstRoomSession(robot, room);
			expect(session.users).to.have.length(2);
		});

		afterEach(function () {
		});

		it('should change the leader', function () {
			var cmd, msg;
			cmd = '.drive';
			msg = createMessage(robot, cmd, room, newUserName, newUserId);

			sinon.spy(msg, 'reply');

			callCommand(findCommand(robot, cmd), msg);

			sinon.assert.notCalled(msg.reply);
			msg.reply.restore();

			var session = getFirstRoomSession(robot, room);
			expect(session.leader).to.deep.equal(newUserName);
		});

		it('should set new topic, where the new user is on the first place', function () {
			var cmd, msg;
			cmd = '.drive';
			msg = createMessage(robot, cmd, room, newUserName, newUserId);

			sinon.spy(msg, 'topic');

			callCommand(findCommand(robot, cmd), msg);

			ensureTopic(msg, newUserName + ' + ' + userName);
			msg.topic.restore();
		});

		it('should not call reply or topic if the leader wants to drive', function () {
			var cmd, msg;
			cmd = '.drive';
			msg = createMessage(robot, cmd, room, userName, userId);

			sinon.spy(msg, 'topic');
			sinon.spy(msg, 'reply');

			callCommand(findCommand(robot, cmd), msg);

			sinon.assert.notCalled(msg.topic);
			sinon.assert.notCalled(msg.reply);
			msg.topic.restore();
			msg.reply.restore();
		});
	});

	describe('use cases', function () {
		describe('when the user isn\'t joined to session', function () {
			describe('and there is one session', function () {
				var newUserName = genUserName();
				var newUserId = rand();
				beforeEach(function () {
					var cmd = '.join';
					var msg = createMessage(robot, cmd, room, newUserName, newUserId);
					callCommand(findCommand(robot, cmd), msg);
				});
				afterEach(function () {
				});
				describe('tries to set himeself as good', function () {
					var cmd = '.good';
					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should reply that the user is not in session', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						ensureReply(msg, 'User not found in session');
						msg.reply.restore();
					});
				});
				describe('tries to set himeself as bad', function () {
					var cmd = '.bad';
					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should reply that the user is not in session', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						ensureReply(msg, 'User not found in session');
						msg.reply.restore();
					});

					it('should not call send', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.send);
						msg.send.restore();
					});
				});
				describe('tries to set hold message', function () {
					var holdMessage = 'foobar';
					var cmd = '.hold ' + holdMessage;
					it('should change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.topic);
						var regexp = new RegExp('^HOLD: . ' + holdMessage);
						sinon.assert.calledWithMatch(msg.topic, sinon.match(regexp));
						msg.topic.restore();
					});

					it('should not reply or send anything', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');
						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.reply);
						sinon.assert.notCalled(msg.send);

						msg.reply.restore();
						msg.send.restore();
					});

					it('should not call send', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.send);
						msg.send.restore();
					});
				});
				describe('tries to send unhold', function () {
					var cmd = '.unhold';
					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should not reply or send anything', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');
						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.reply);
						sinon.assert.notCalled(msg.send);

						msg.reply.restore();
						msg.send.restore();
					});
				});
			});

			describe('and not even one session exists', function () {
				describe('tries to set himeself as good', function () {
					var cmd = '.good';
					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should reply that the user is not in session', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						ensureReply(msg, 'User not found in session');
						msg.reply.restore();
					});
				});
				describe('tries to set himeself as bad', function () {
					var cmd = '.bad';
					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should reply that the user is not in session', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						ensureReply(msg, 'User not found in session');
						msg.reply.restore();
					});

					it('should not call send', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.send);
						msg.send.restore();
					});
				});
				describe('tries to set hold message', function () {
					var holdMessage = 'foobar';
					var cmd = '.hold ' + holdMessage;

					it('should change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.topic);
						var regexp = new RegExp('^HOLD: . ' + holdMessage);
						sinon.assert.calledWithMatch(msg.topic, sinon.match(regexp));
						msg.topic.restore();
					});

					it('should not reply or send anything', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');
						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.reply);
						sinon.assert.notCalled(msg.send);

						msg.reply.restore();
						msg.send.restore();
					});

					it('should not call send', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.send);
						msg.send.restore();
					});
				});


				// --------------------------------

				describe('tries to send unhold', function () {
					var cmd = '.unhold';

					it('should not change the topic', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'topic');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.topic);
						msg.topic.restore();
					});

					it('should not reply or send anything', function () {
						var msg = createMessage(robot, cmd, room, userName, userId);

						sinon.spy(msg, 'reply');
						sinon.spy(msg, 'send');

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.notCalled(msg.reply);
						sinon.assert.notCalled(msg.send);

						msg.reply.restore();
						msg.send.restore();
					});
				});
			});

		});
		describe('when the user is joined to session', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.join';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);
			});
			afterEach(function () {
			});

			describe('user tries to finish a session', function () {
				var cmd, msg;
				beforeEach(function () {
					cmd = '.done';
					msg = createMessage(robot, cmd, room, userName, userId);
				});
				afterEach(function () {
					cmd = null;
					msg = null;
				});

				it('should remove the session', function () {
					callCommand(findCommand(robot, cmd), msg);

					var roomSessions = getRoomSessions(robot, room);
					expect(roomSessions).to.have.length(0);
				});
			});
		});
		describe('when hold is set', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.join';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);

				cmd = '.hold foobar';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);
			});
			afterEach(function () {
			});
			describe('user tries to change session state', function () {
				var cmd, msg;
				beforeEach(function () {
					cmd = '.at prod';
					msg = createMessage(robot, cmd, room, userName, userId);
				});
				afterEach(function () {
					cmd = null;
					msg = null;
				});
				it('should not allow to change session state', function () {
					callCommand(findCommand(robot, cmd), msg);

					var session = getFirstRoomSession(robot, room);

					expect(session).to.have.property('state', '');
				});
				it('should reply, that the room is in hold', function () {
					sinon.spy(msg, 'reply');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.calledOnce(msg.reply);
					ensureReply(msg, 'Room holded');

					msg.reply.restore();
				});
				it('should not change the topic', function () {
					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.notCalled(msg.topic);

					msg.topic.restore();
				});
			});
			describe('user tries to mark session done', function () {
				var cmd, msg;
				beforeEach(function () {
					cmd = '.done';
					msg = createMessage(robot, cmd, room, userName, userId);
				});
				afterEach(function () {
					cmd = null;
					msg = null;
				});
				it('should not allow to remove session', function () {
					var cmd = '.done';
					var msg = createMessage(robot, cmd, room, userName, userId);

					callCommand(findCommand(robot, cmd), msg);

					var roomSessions = getRoomSessions(robot, room);

					expect(roomSessions).to.have.length(1);
				});
				it('should reply, that the room is in hold', function () {
					var cmd = '.done';
					var msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'reply');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.calledOnce(msg.reply);
					ensureReply(msg, 'Room holded');

					msg.reply.restore();
				});
				it('should not change the topic', function () {
					var cmd = '.done';
					var msg = createMessage(robot, cmd, room, userName, userId);

					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.notCalled(msg.topic);

					msg.topic.restore();
				});
			});
		});
		describe('when uhoh is set', function () {
			beforeEach(function () {
				var cmd, msg;
				cmd = '.join';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);

				cmd = '.join with ' + userName;

				msg = createMessage(robot, cmd, room, 'other-user-' + rand(), rand());
				callCommand(findCommand(robot, cmd), msg);

				cmd = '.uhoh';
				msg = createMessage(robot, cmd, room, userName, userId);
				callCommand(findCommand(robot, cmd), msg);
			});
			afterEach(function () {
			});
			describe('user tries to change session state', function () {
				var cmd, msg;
				beforeEach(function () {
					cmd = '.at prod';
					msg = createMessage(robot, cmd, room, userName, userId);
				});
				afterEach(function () {
					cmd = null;
					msg = null;
				});
				it('should not allow to change session state', function () {
					callCommand(findCommand(robot, cmd), msg);

					var session = getFirstRoomSession(robot, room);

					expect(session).to.have.property('state', '');
				});
				it('should reply that the room is holded by the user', function () {
					sinon.spy(msg, 'reply');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.calledOnce(msg.reply);

					ensureReply(msg, 'Users are not ready: ' + userName);

					msg.reply.restore();
				});
				it('should not change the topic', function () {
					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);

					sinon.assert.notCalled(msg.topic);

					msg.topic.restore();
				});
			});
		});
	});
});
