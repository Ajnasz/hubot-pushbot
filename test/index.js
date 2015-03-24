/*jshint node:true*/
/*global describe, it, beforeEach, afterEach*/

var expect = require('chai').expect;
var sinon = require('sinon');

var pushbot = require('../src/pushbot');

function rand() {
	'use strict';
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
	'use strict';

	var item = findCommand(robot, message);

	var msg = null;

	if (item) {
		msg = createMsg(item, message, room, userName, userId);
	}

	return msg;
}

function callCommand(command, msg) {
	'use strict';

	if (typeof command === 'undefined') {
		throw new Error('Command not found');
	}

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

			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot).to.be.an('object');
			expect(robot.brain.data.pushbot[room]).to.be.an('array');
		});

		it('should add session to robot brain', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(robot.brain.data.pushbot[room]).to.have.length(1);
		});

		it('should set properties to session', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = robot.brain.data.pushbot[room][0];

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

			var session = robot.brain.data.pushbot[room][0];

			expect(session.users).to.be.an('array');
			expect(session.users).to.have.length(1);
			expect(session.users[0]).to.be.an('object');
			expect(session.users[0].name).to.deep.equal(msg.message.user.name);

			// TODO We should be able to set this from configuration
			expect(session.users[0].state).to.deep.equal('waiting');
		});

		it('should create as many sessions, as many times called', function () {
			var cmd = '.join';
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);


			msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});

		describe('set topic', function () {
			it('should add username to room topic', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, userName, userId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName);

				msg.topic.restore();
			});

			it('should separate sessions by |', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, userName, userId);

				callCommand(findCommand(robot, cmd), msg);
				var newUserName = 'user-' + rand();
				var newUserId = rand();
				msg = createMessage(robot, cmd, room, newUserName, newUserId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' | ' + newUserName);

				msg.topic.restore();

				msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' | ' + newUserName + ' | ' + userName);

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
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0].users).to.have.length(2);
		});
		it('should set the second user to the new one', function () {
			var cmd = '.join with ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);

			callCommand(findCommand(robot, cmd), msg);
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0].users[1]).to.have.property('name', newUserName);
		});

		describe('set topic', function () {
			it('should add new username to title', function () {
				var cmd = '.join with ' + userName;
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' + ' + newUserName);

				msg.topic.restore();
			});

			it('should add new username to title', function () {
				var cmd = '.join with ' + userName;
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' + ' + newUserName);

				msg.topic.restore();
			});

			it('should add new username to title', function () {
				var cmd = '.join';
				var msg = createMessage(robot, cmd, room, newUserName, newUserId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' | ' + newUserName);
				msg.topic.restore();
				cmd = '.join with ' + newUserName;
				msg = createMessage(robot, cmd, room, userName, userId);
				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledOnce(msg.topic);
				sinon.assert.calledWithExactly(msg.topic, userName + ' | ' + newUserName + ' + ' + userName);
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
			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions).to.have.length(2);
		});
		it('should before the other session, which has mentioned username', function () {
			var cmd = '.join before ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('leader', newUserName);
			expect(roomSessions[1]).to.have.property('leader', userName);
		});

		it('should have the same properties as the session with .join', function () {
			var cmd = '.join before ' + userName;
			var msg = createMessage(robot, cmd, room, newUserName, newUserId);
			callCommand(findCommand(robot, cmd), msg);

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

		describe('set topic', function () {
			it('should add usernames to topic in order', function () {
				var users = ['user-' + rand(), 'user-' + rand()];
				users.forEach(function (name, i) {
					var cmd = '.join before ' + userName;
					var msg = createMessage(robot, cmd, room, name, rand());

					sinon.spy(msg, 'topic');

					callCommand(findCommand(robot, cmd), msg);
					sinon.assert.calledOnce(msg.topic);
					sinon.assert.calledWithExactly(msg.topic, users.slice(0, i + 1).concat([userName]).join(' | '));

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
		it('should set session holded property to true', function () {
			var holdMessage = 'hold message - ' + rand();
			var cmd = '.hold ' + holdMessage;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holded', true);
		});

		it('should set session holdMessage property to given message', function () {
			var holdMessage = 'hold message - ' + rand();
			var cmd = '.hold ' + holdMessage;
			var msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holdMessage', holdMessage);
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

			var session = robot.brain.data.pushbot[room][0];

			expect(session).to.have.property('holdMessage', holdMessage);

			cmd = '.unhold';
			msg = createMessage(robot, cmd, room, userName, userId);
			callCommand(findCommand(robot, cmd), msg);

			expect(session).to.have.property('holded', false);
			expect(session).to.have.property('holdMessage', '');
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
				sinon.assert.calledWithExactly(msg.topic, userName);
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
			var session = robot.brain.data.pushbot[room][0];

			expect(session.users[0]).to.have.property('state', 'uhoh');
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
			var session = robot.brain.data.pushbot[room][0];

			expect(session.users[0]).to.have.property('state', 'good');
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

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('message', message);
		});

		describe('set topic', function () {
			it('should add message to the topic', function () {
				var message = 'This is a message ' + rand();
				var cmd = '.message ' + message;
				var msg = createMessage(robot, cmd, room, userName, userId);

				sinon.spy(msg, 'topic');

				callCommand(findCommand(robot, cmd), msg);

				sinon.assert.calledWithExactly(msg.topic, message + ' ' + userName);

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

					sinon.assert.calledWithExactly(msg.topic, userName);
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

			var roomSessions = robot.brain.data.pushbot[room];

			expect(roomSessions[0]).to.have.property('state', state);
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

			expect(robot.brain.data.pushbot[room]).to.have.length(0);
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

			expect(robot.brain.data.pushbot[room]).to.have.length(0);
		});

		it ('should reset channel title', function () {
			sinon.spy(msg, 'topic');
			var cmd = findCommand(robot, '.clearplease');

			callCommand(cmd, msg);

			sinon.assert.calledOnce(msg.topic);
			sinon.assert.calledWithExactly(msg.topic, '');

			msg.topic.restore();
		});
	});
	describe.skip('.kick', function () {});
	describe.skip('.sessions', function () {});

	describe('use cases', function () {
		describe('when the user isn\'t joined to session', function () {
			describe('and there is one session', function () {
				var newUserName = 'user-' + rand();
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
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
					var cmd = '.hold foobar';
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

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
					var cmd = '.hold foobar';
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

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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

						callCommand(findCommand(robot, cmd), msg);

						sinon.assert.calledOnce(msg.reply);
						sinon.assert.calledWithExactly(msg.reply, 'User not found in session');
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
			});
		});
	});
});
