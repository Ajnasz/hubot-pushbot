// Description:
//   Pushbot for hubot
//
// Commands:
//   .join - Starts a pushbot session
//   .join before <username> - Starts a new pushbot session and moves before users's session
//   .join with <username> - Joins to a pushbot session
//   .hold <message> - Hold session, won't allow to change state or make it done
//   .unhold - Unhold session
//   .uhoh - Mark yourself as not-all-good in the current push state
//   .(good|ok) - Mark yourself as all-good in the current push state
//   .(nevermind|leave) - Hop out of queue
//   .message <message text> - Set session message
//   .kick <user> Kicks user from session
//   .at <statename> - Changes session state
//   .done - Finishes session
//   .sessions - List sessions

// The MIT License (MIT)
//
// Copyright (c) 2015 Lajos Koszti
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/*jshint node:true, newcap:false*/
/*eslint new-cap:false*/
module.exports = function (robot) {
	'use strict';

	var commands = {
		join: ['join'],
		joinBefore: ['join before'],
		joinWith: ['join with'],
		hold: ['hold'],
		unhold: ['unhold'],
		uhoh: ['uhoh', 'notgood', 'bad', 'fuck', 'fucked'],
		good: ['good', 'ok', 'in', 'go', 'great'],
		nevermind: ['leave', 'nevermind', 'nm'],
		message: ['message'],
		kick: ['kick'],
		at: ['at'],
		done: ['done'],
		sessions: ['sessions'],
		clearplease: ['clearplease']
	};

	var bot = '.';

	var messageRegexp = '[\\w\'"(){}\\[\\]+*&%$#@~<>=/\\\\ .:;!?_-]+';

	var userNameRegexp = '[\\w_-]+';

	var defaultMessage = '-';

	var emptyMessage = '-';

	var userStates = {
		good: 'good',
		uhoh: 'uhoh',
		waiting: 'waiting'
	};

	var stateNameRegexp = userNameRegexp;

	var goodUserMarker = '✓',
		holdingUserMarker = '✗';

	robot.brain.on('loaded', function () {
		if (!robot.brain.data.pushbot) {
			robot.brain.data.pushbot = {};
		}
	});

	// ERRORS
	function NotInSessionError() {
		this.name = 'NotInSessionError';
		this.message = 'User not found in session';
	}

	NotInSessionError.prototype = Error.prototype;

	function NotLeadingError() {
		this.name = 'NotLeadingError';
		this.message = 'You are not leading any session';
	}
	NotLeadingError.prototype = Error.prototype;

	function UserNotKickableError() {
		this.name = 'UserNotKickable';
		this.message = 'You can not kick user';
	}
	UserNotKickableError.prototype = Error.prototype;

	function AlreadyInSessionError() {
		this.name = 'AlreadyInSessionError';
		this.message = 'User already participating in session';
	}
	AlreadyInSessionError.prototype = Error.prototype;

	function PermissionDeniedError() {
		this.name = 'PermissionDeniedError';
		this.message = 'You have no permission to perform the action';
	}
	PermissionDeniedError.prototype = Error.prototype;

	function UsersNotReadyError(users) {
		this.name = 'UsersNotReadyError';
		if (users && users.length) {
			this.message = 'Users are not ready: ' + users.join(', ');
		} else {
			this.message = 'Users are not ready';
		}
	}
	UsersNotReadyError.prototype = Error.prototype;

	function UserNotFoundError() {
		this.name = 'UserNotFoundError';
		this.message = 'User not found';
	}
	UserNotFoundError.prototype = Error.prototype;

	function LeaderCanNotLeaveError() {
		this.name = 'LeaderCanNotLeaveError';
		this.message = 'Leader can not leave the session';
	}
	LeaderCanNotLeaveError.prototype = Error.prototype;

	function NotChangedError() {
		this.name = 'NotChangedError';
		this.message = 'Value not changed';
	}
	NotChangedError.prototype = Error.prototype;

	function RoomHoldedError() {
		this.name = 'RoomHoldedError';
		this.message = 'Room holded';
	}
	LeaderCanNotLeaveError.prototype = Error.prototype;
	// ERRORS END

	var Action = (function () {
		var actionProto = Object.create(null);

		actionProto.requireLeader = function () {
			return false;
		};

		actionProto.requireMembership = function () {
			return false;
		};

		return function Action(name) {
			var output = Object.create(actionProto);

			output.name = name;

			return output;
		};
	}());

	// has permission a <user> to do <action> in <session>
	function hasPermission(user, action, session) {
		if (action.requireLeader() && user !== session.getLeader()) {
			return false;
		}

		return true;
	}

	// TYPES
	var User = (function () {
		var userProto = Object.create(null);

		userProto.getName = function () {
			return this.name;
		};

		userProto.getState = function () {
			return this.state;
		};

		userProto.setState = function (state) {
			this.__ref.state = state;
			this.state = state;
		};

		userProto.isGood = function () {
			return this.getState() === userStates.good;
		};

		userProto.isHolding = function () {
			return this.getState() === userStates.uhoh;
		};

		return function User(user) {
			var output = Object.create(userProto);

			output.name = user.name;
			output.state = user.state;

			output.__ref = user;

			return output;
		};
	}());

	var Brain = (function () {
		var brainProto = Object.create(null);

		brainProto.getRooms = function () {
			return this.data;
		};

		brainProto.getRoom = function (room) {
			return this.getRooms()[room];
		};

		brainProto.getRoomSessions = function (room) {
			var roomData = this.getRoom(room);
			return roomData && roomData.sessions;
		};

		brainProto.hasSessions = function (room) {
			var roomSessions = this.getRoomSessions(room);

			return roomSessions && roomSessions.length > 0;
		};

		brainProto.setRoomData = function (room) {
			this.getRooms()[room] = {
				holded: false,
				sessions: []
			};
		};

		brainProto.setRoomSessions = function (room, sessions) {
			var roomData = this.getRoom(room);

			if (!roomData) {
				this.setRoomData(room);
			}
			this.getRoom(room).sessions = sessions;
		};

		brainProto.clearRoomSessions = function (room) {
			this.setRoomData(room);
		};

		brainProto.setRoomSessionAtIndex = function (room, index, session) {
			this.getRoomSessions(room)[index] = session;
		};

		brainProto.getRoomSessionAtIndex = function (room, index) {
			var rooms = this.getRoomSessions(room);

			if (rooms && rooms.length > index) {
				return rooms[index];
			}

			return null;
		};

		return function Brain() {
			var output = Object.create(brainProto);

			if (!robot.brain.data.pushbot) {
				robot.brain.data.pushbot = Object.create(null);
			}

			output.data = robot.brain.data.pushbot;

			return output;
		};
	}());

	var Room = (function () {
		var roomProto = Object.create(null);

		roomProto.isHolded = function () {
			return this.holded;
		};

		roomProto.hold = function () {
			this.holded = true;
			this.__ref.holded = true;
		};

		roomProto.unhold = function () {
			this.holded = false;
			this.__ref.holded = false;
		};

		roomProto.setHoldMessage = function (message) {
			robot.logger.debug('set hold message', message);
			this.holdMessage = message;
			this.__ref.holdMessage = message;
		};

		roomProto.getHoldMessage = function () {
			return this.holdMessage;
		};

		roomProto.isUserInSession = function (userName) {
			var roomSessions = this.sessions;

			if (!this.sessions) {
				return false;
			}

			var index = findIndex(roomSessions, function (session) {
				return findUserSessionIndex(session, userName) > -1;
			});

			return index > -1;
		};

		return function Room(room) {
			var output = Object.create(roomProto);

			output.sessions = room.sessions;
			output.holdMessage = room.holdMessage;
			output.holded = room.holded;

			output.__ref = room;

			return output;
		};
	}());

	var Session = (function () {
		var sessionProto = Object.create(null);
		/**
		 * @return String
		 */
		sessionProto.getLeader = function () {
			return this.leader;
		};

		sessionProto.getUsers = function () {
			return this.users;
		};

		sessionProto.getState = function () {
			return this.state;
		};

		/**
		 * @return String
		 */
		sessionProto.getMessage = function () {
			return this.message;
		};

		sessionProto.getHoldMessage = function () {
			return this.holdMessage;
		};

		sessionProto.setState = function (state) {
			this.state = state;
			this.__ref.state = state;
		};

		/**
		 * @param {String} message
		 */
		sessionProto.setMessage = function (message) {
			this.message = message;
			this.__ref.message = message;
		};

		/**
		 * @param {String} leaderName
		 */
		sessionProto.setLeader = function (leaderName) {
			this.leader = leaderName;
			this.__ref.leader = leaderName;
		};

		/**
		 * @param {String} userName
		 */
		sessionProto.addUser = function (userName) {
			this.getUsers().push({
				name: userName,
				state: userStates.waiting
			});
		};

		/**
		 * @return Boolean
		 */
		sessionProto.isLeaderJoined = function () {
			return this.getUsers().some(function (user) {
				this.isUserLeader(User(user).getName());
			}.bind(this));
		};

		/**
		 * @param {String} userName
		 * @return Boolean
		 */
		sessionProto.isUserLeader = function (userName) {
			return this.getLeader() === userName;
		};

		/**
		 * @return Boolean
		 */
		sessionProto.isAllUserGood = function () {
			return this.getUsers().map(User).every(function (u) {
				return u.isGood();
			});
		};

		/**
		 * @return Boolean
		 */
		sessionProto.isAnyUserBad = function () {
			return this.getUsers().map(User).some(function (u) {
				return u.isHolding();
			});
		};

		sessionProto.resetUsers = function () {
			this.getUsers().map(User).forEach(function (user) {
				user.setState(userStates.waiting);
			});
		};

		return function Session(session) {
			var output = Object.create(sessionProto);

			output.leader = session.leader;
			output.state = session.state;
			output.message = session.message;
			output.users = session.users;

			output.__ref = session;

			return output;
		};
	}());
	// TYPES END

	// HELPERS
	function getSortedSessionUsers(sess) {
		// var sess = Session(session);
		var users = sess.getUsers().map(User);
		var leader = sess.getLeader();

		users.sort(function (a, b) {
			if (a.getName() === leader) {
				return -1;
			} else if (b.getName() === leader) {
				return 1;
			} else {
				return 0;
			}
		});

		return users;
	}

	function getUserListStr(users) {
		return users.map(function (user) {
			if (user.isGood()) {
				return goodUserMarker + user.getName();
			} else if (user.isHolding()) {
				return holdingUserMarker + user.getName();
			} else {
				return user.getName();
			}
		}).join(' + ');
	}

	function getStateStrForSession(session) {
		var sess = Session(session);
		var msg = [];

		if (sess.getMessage() && sess.getMessage() !== emptyMessage) {
			msg.push(sess.getMessage());
		}

		if (sess.getState()) {
			msg.push('<' + sess.getState() + '>');
		}

		msg.push(getUserListStr(getSortedSessionUsers(sess)));

		return msg.join(' ');
	}

	function createRoom(room) {
		var brain = Brain();

		if (!brain.getRoomSessions(room)) {
			brain.setRoomSessions(room, []);
		}
	}

	function createSession(leader) {
		return {
			leader: leader,
			state: '',
			holded: false,
			holdMessage: '',
			message: defaultMessage,
			users: [{
				name: leader,
				state: userStates.waiting
			}]
		};
	}

	function setTopic(msg) {
		var topic = getTopicString(msg.message.room);

		robot.logger.debug('Set topic:', topic, 'room:', msg.message.room);

		return msg.topic(topic);
	}
	// HELPERS END

	// LOGICS
	function addSession(room, leader) {
		var roomSessions;

		createRoom(room);

		// if leader is participating in any session in the room, don't allow to
		// start a new one
		// if (isUserParticipating(room, leader)) {
		// 	return new AlreadyInSessionError();
		// }

		roomSessions = Brain().getRoomSessions(room);
		roomSessions.push(createSession(leader));

		return null;
	}

	function insertSession(room, leader, beforeIndex) {
		var roomSessions;

		// if leader is participating in any session in the room, don't allow to
		// start a new one
		// if (isUserParticipating(room, leader)) {
		// 	return new AlreadyInSessionError();
		// }

		roomSessions = Brain().getRoomSessions(room);

		roomSessions.splice(beforeIndex, 0, createSession(leader));

		return null;
	}

	function findIndex(array, test) {
		var index = -1;
		for (var i = 0, rl = array.length; i < rl; i++) {
			if (test(array[i])) {
				index = i;
				break;
			}
		}

		return index;
	}

	function removeSession(room, leader) {
		var brain = Brain();
		var roomSessions = brain.getRoomSessions(room);
		var index = -1;

		index = findIndex(roomSessions, function (session) {
			return Session(session).isUserLeader(leader);
		});

		if (index > -1) {
			roomSessions.splice(index, 1);
			brain.setRoomSessions(room, roomSessions);
		}
	}

	function findUserSessionIndex(session, userName) {
		var index = -1;
		var users = Session(session).getUsers();

		index = findIndex(users, function (user) {
			return User(user).getName() === userName;
		});

		return index;
	}

	function findSessionIndexWithUser(room, userName) {
		var brain = Brain(), roomSessions;

		if (!brain.hasSessions(room)) {
			return -1;
		}

		roomSessions = brain.getRoomSessions(room);

		var index = findIndex(roomSessions, function (session) {
			return findUserSessionIndex(session, userName) > -1;
		});

		return index;
	}

	function leaveSession(room, userName) {
		createRoom(room);

		var brain = Brain();

		var roomSessions = brain.getRoomSessions(room);

		var index = findIndex(roomSessions, function (session) {
			return findUserSessionIndex(session, userName) > -1;
		});

		var users;

		if (Room(brain.getRoom(room)).isUserInSession(userName)) {
			var session = brain.getRoomSessionAtIndex(room, index), userIndex;
			var sess = Session(session);

			if (sess.isUserLeader(userName) && findUserSessionIndex(session, userName) > 1) {
				return new LeaderCanNotLeaveError();
			}

			userIndex = findUserSessionIndex(session, userName);

			if (userIndex === -1) {
				return new UserNotFoundError();
			}
			users = sess.getUsers();
			users.splice(userIndex, 1);

			// remove session if no users left
			if (users.length === 0) {
				removeSession(room, sess.getLeader());
			} else {
				if (!sess.isLeaderJoined()) {
					sess.setLeader(users[0].name);
				}
				brain.setRoomSessionAtIndex(room, index, session);
			}

			return null;
		} else {
			return new NotInSessionError();
		}
	}

	function joinSession(room, refUser, user) {
		var session, sessionIndex;

		createRoom(room);

		sessionIndex = findSessionIndexWithUser(room, refUser);

		if (sessionIndex === -1) {
			return new NotInSessionError();
		}

		session = Brain().getRoomSessionAtIndex(room, sessionIndex);

		if (findUserSessionIndex(session, user) > -1) {
			return new AlreadyInSessionError();
		} else {
			Session(session).addUser(user);
			return null;
		}
	}

	function setUserState(room, userName, state) /* (err, bool) */ {
		var index = findSessionIndexWithUser(room, userName);
		var session, userIndex, sess, brain;

		if (index > -1) {
			brain = Brain();
			session = brain.getRoomSessionAtIndex(room, index);
			userIndex = findUserSessionIndex(session, userName);

			sess = Session(session);

			if (User(sess.getUsers()[userIndex]).getState() === state) {
				return new NotChangedError();
			}

			sess.getUsers()[userIndex].state = state;

			brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new NotInSessionError();
		}
	}

	function finish(room, userName) {
		var index, session, sess;

		var holdingUsers;

		var brain = Brain();

		if (Room(brain.getRoom(room)).isHolded()) {
			return new RoomHoldedError();
		}

		index = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			session = Brain().getRoomSessionAtIndex(room, index);

			sess = Session(session);

			if (sess.getState() && !sess.isAllUserGood()) {
				holdingUsers = sess.getUsers().map(User).filter(function (user) {
					return !user.isGood();
				});
				return new UsersNotReadyError(holdingUsers.map(User).map(function (u) {
					return u.getName();
				}));
			}

			if (!sess.isUserLeader(userName)) {
				return new PermissionDeniedError();
			}
			removeSession(room, sess.getLeader());

			return null;
		}

		return new NotInSessionError();
	}

	function setRoomState(room, userName, state) {
		var session, sess, brain;

		brain = Brain();

		if (Room(brain.getRoom(room)).isHolded()) {
			return new RoomHoldedError();
		}

		var index = findSessionIndexWithUser(room, userName);

		robot.logger.debug('set room state call', index, room, userName, state);

		if (index !== -1) {
			session = brain.getRoomSessionAtIndex(room, index);
			sess = Session(session);

			/*
			if (!sess.isUserLeader(userName)) {
				return new NotLeadingError();
			}
			*/

			if (sess.isAnyUserBad()) {
				return new UsersNotReadyError(sess.getUsers().map(User).map(function (u) {
					return u.getName();
				}));
			}

			if (sess.getState() === state) {
				return new NotChangedError();
			}

			sess.setState(state);

			sess.resetUsers();

			// brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new NotLeadingError();
		}
	}

	function unholdRoom(room) {
		var brain = Brain();
		var existingRoom = brain.getRoom(room);
		var roomObj;
		if (!existingRoom) {
			createRoom(room);
			existingRoom = brain.getRoom(room);
		}

		roomObj = Room(existingRoom);

		if (!roomObj.isHolded()) {
			return new NotChangedError();
		}

		roomObj.unhold();
		roomObj.setHoldMessage('');

		return null;
	}

	function holdRoom(room, message) {
		var brain = Brain();
		var existingRoom = brain.getRoom(room);
		var roomObj;
		if (!existingRoom) {
			createRoom(room);
			existingRoom = brain.getRoom(room);
		}

		roomObj = Room(existingRoom);

		roomObj.hold();
		roomObj.setHoldMessage(message);

		return null;
	}

	function getTopicString(room) {
		var brain = Brain();
		var roomObj = Room(brain.getRoom(room));
		var roomSessions = Brain().getRoomSessions(room);

		var topic = [];

		if (roomObj.isHolded()) {
			topic.push('HOLD: ☂ ' + roomObj.getHoldMessage() + ' ☂');
		}

		topic = topic.concat(roomSessions.map(getStateStrForSession));

		return topic.join(' | ');
	}

	function kickUser(room, leader, userName) {
		var index = findSessionIndexWithUser(room, leader);
		var session;

		if (index === -1) {
			return new NotInSessionError();
		}

		session = Brain().getRoomSessionAtIndex(room, index);
		if (!hasPermission(leader, Action('kick'), Session(session))) {
			return new PermissionDeniedError();
		}

		if (leader === userName) {
			return new UserNotKickableError();
		}

		return leaveSession(room, userName);
	}

	function setMessage(room, userName, message) {
		var sessionIndex = findSessionIndexWithUser(room, userName);

		if (sessionIndex === -1) {
			return new NotInSessionError();
		}

		var session = Brain().getRoomSessionAtIndex(room, sessionIndex);
		var sess = Session(session);

		if (sess.getMessage() === message) {
			return new NotChangedError();
		}

		sess.setMessage(message);

		return null;

	}

	// LOGICS END

	// COMMAND CALLBACKS
	function onJoinCommand(msg) {
		var room = msg.message.room;

		var leader = msg.message.user.name;

		var err = addSession(room, leader);

		if (err) {
			msg.reply(err);
			robot.logger.error(err);
		} else {
			setTopic(msg);
		}
	}

	function onNevermindCommand(msg) {
		var room = msg.message.room;

		var userName = msg.message.user.name;

		var err = leaveSession(room, userName);

		if (err && err.name !== 'NotInSessionError') {
			msg.reply(err.message);
			robot.logger.error('.nevermind:', err);
		} else {
			setTopic(msg);
		}
	}

	function onJoinWithCommand(msg) {
		var room = msg.message.room;
		var leader = msg.match[1];
		var userName = msg.message.user.name;

		var err = joinSession(room, leader, userName);

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.join with:', err);
		} else {
			setTopic(msg);
		}
	}

	function onJoinBeforeCommand(msg) {
		var room = msg.message.room;
		var refUser = msg.match[1];
		var leader = msg.message.user.name;

		var sessionIndex = findSessionIndexWithUser(room, refUser);
		var err;

		if (sessionIndex === -1) {
			err = new NotInSessionError();
		} else {
			err = insertSession(room, leader, sessionIndex);
		}

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.join before:', err);
		} else {
			setTopic(msg);
		}

	}

	function onDoneCommand(msg) {
		var userName = msg.message.user.name;
		var room = msg.message.room;

		var err = finish(room, userName);
		var nextSession;

		if (err) {
			if (err.name !== 'NotInSessionError') {
				msg.reply(err.message);
			}
		} else {
			nextSession = Brain().getRoomSessionAtIndex(room, 0);

			if (nextSession) {
				msg.send(nextSession.users.map(User).map(function (u) {
					return u.getName();
				}).join(', ') + ': You are up!');
			}

			setTopic(msg);
		}
	}

	function onAtCommand(msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;

		var err = setRoomState(room, userName, msg.match[1]);

		robot.logger.debug('set room state', err);

		if (err) {
			if (err.name !== 'NotChangedError') {
				msg.reply(err.message);
				robot.logger.error('.at:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onGoodCommand(msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;
		var session, sess;
		var sessionIndex;

		var err = setUserState(room, userName, userStates.good);

		if (err) {
			if (err.name !== 'NotChangedError') {
				msg.reply(err.message);
				robot.logger.error('.good:', err);
			}
		} else {
			sessionIndex = findSessionIndexWithUser(room, userName);

			session = Brain().getRoomSessionAtIndex(room, sessionIndex);

			sess = Session(session);

			if (sess.isAllUserGood()) {
				msg.send(getSortedSessionUsers(sess).map(function (user) {
					return user.getName();
				}).join(', ') + ': Everyone is ready');
			}
			setTopic(msg);
		}
	}

	function onUhOhCommand(msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;

		var err = setUserState(room, userName, userStates.uhoh);

		if (err) {
			if (err.name !== 'NotChangedError') {
				msg.reply(err.message);
				robot.logger.error('.uhoh:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onHoldCommand(msg) {
		robot.logger.debug('COMMANBD HOLD');
		var room = msg.message.room;
		var message = msg.match[1];

		var err = holdRoom(room, message);

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.hold:', err);
		} else {
			setTopic(msg);
		}
	}

	function onUnholdCommand(msg) {
		var room = msg.message.room;

		var err = unholdRoom(room);

		if (err) {
			if (err.name !== 'NotChangedError') {
				msg.reply(err.message);
				robot.logger.error('.unhold:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onSessionsCommand(msg) {
		var room = msg.message.room;
		var brain = Brain();

		var roomSessions = brain.getRoomSessions(room);

		if (roomSessions.length) {
			msg.send(roomSessions.map(function (session) {
				var msg = [];
				var sess = Session(session);

				if (sess.getState()) {
					msg.push('<' + sess.getState() + '>');
				}

				if (sess.getMessage() && sess.getMessage() !== emptyMessage) {
					msg.push('message: ' + sess.getMessage());
				}
				msg.push('leader: ' + sess.getLeader());
				msg.push('participants: ' + getUserListStr(getSortedSessionUsers(sess)));

				return msg.join(', ');
			}).join('\n'));
		}
	}

	function onKickCommand(msg) {
		var room = msg.message.room;

		var user = msg.message.user.name;

		var err = kickUser(room, user, msg.match[1]);

		if (err && err.name !== 'NotInSessionError') {
			msg.reply(err.message);
			robot.logger.error('.kick:', err);
		} else {
			setTopic(msg);
		}
	}

	function onMessageCommand(msg) {
		var room = msg.message.room;

		var userName = msg.message.user.name;

		var err = setMessage(room, userName, msg.match[1]);

		if (err ) {
			if (err.name !== 'NotChangedError') {
				msg.reply(err.message);
			}
		} else {
			setTopic(msg);
		}
	}

	function onClearPleaseCommand(msg) {
		Brain().clearRoomSessions(msg.message.room);
		setTopic(msg);
	}

	function createCommandRegexp(commands, args) {
		if (args) {
			return new RegExp('^\\' + bot + '(?:' + commands.join('|') + ') (' + args + ')$');
		} else {
			return new RegExp('^\\' + bot + '(?:' + commands.join('|') + ')$');
		}
	}

	// COMMAND CALLBACKS END

	// .join command
	robot.hear(createCommandRegexp(commands.join), onJoinCommand);

	// .nevermind command
	robot.hear(createCommandRegexp(commands.nevermind), onNevermindCommand);

	// .join with command
	robot.hear(createCommandRegexp(commands.joinWith, userNameRegexp), onJoinWithCommand);

	// .join before command
	robot.hear(createCommandRegexp(commands.joinBefore, userNameRegexp), onJoinBeforeCommand);

	// .done command
	robot.hear(createCommandRegexp(commands.done), onDoneCommand);

	// at command
	robot.hear(createCommandRegexp(commands.at, stateNameRegexp), onAtCommand);

	// .good command
	robot.hear(createCommandRegexp(commands.good), onGoodCommand);

	// .uhoh command
	robot.hear(createCommandRegexp(commands.uhoh), onUhOhCommand);

	// .hold command
	robot.hear(createCommandRegexp(commands.hold, messageRegexp), onHoldCommand);

	// .unhold command
	robot.hear(createCommandRegexp(commands.unhold), onUnholdCommand);

	// .sessions command
	robot.hear(createCommandRegexp(commands.sessions), onSessionsCommand);

	// .kick command
	robot.hear(createCommandRegexp(commands.kick, userNameRegexp), onKickCommand);

	// .message command
	robot.hear(createCommandRegexp(commands.message, messageRegexp), onMessageCommand);

	// .clearplease command
	robot.hear(createCommandRegexp(commands.clearplease), onClearPleaseCommand);
};
