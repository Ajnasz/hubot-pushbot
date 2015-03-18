// Description:
//   Pushbot for pushbot
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

	var messageRegexp = '([\\w\'"(){}\\[\\]+*&%$#@~<>=/\\\\ .:;!?_-]+)';

	var defaultMessage = '-';

	var emptyMessage = '-';

	var userStates = {
		good: 'good',
		uhoh: 'uhoh',
		waiting: 'waiting'
	};

	var validStates = [
		'commit',
		'push',
		'trunk',
		'qa',
		'dev',
		'preprod',
		'prod',
		'production'
	];

	robot.brain.on('loaded', function () {
		if (!robot.brain.data.pushbot) {
			robot.brain.data.pushbot = {};
		}
	});


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

	function SessionHoldedError() {
		this.name = 'SessionHoldedError';
		this.message = 'Session holded';
	}
	LeaderCanNotLeaveError.prototype = Error.prototype;

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

	function User(user) {
		var output = Object.create(userProto);

		output.name = user.name;
		output.state = user.state;

		output.__ref = user;

		return output;
	}

	var brainProto = {
		getSessions: function () {
			return this.data;
		},

		getRoomSessions: function (room) {
			return this.getSessions()[room];
		},

		setRoomSessions: function (room, sessions) {
			this.getSessions()[room] = sessions;
		},

		clearRoomSessions: function (room) {
			this.getSessions()[room] = [];
		},

		setRoomSessionAtIndex: function (room, index, session) {
			this.getSessions()[room][index] = session;
		},

		getRoomSessionAtIndex: function (room, index) {
			var rooms = this.getRoomSessions(room);

			if (rooms.length > index) {
				return rooms[index];
			}

			return null;
		}

	};

	function Brain() {
		var output = Object.create(brainProto);

		if (!robot.brain.data.pushbot) {
			robot.brain.data.pushbot = Object.create(null);
		}

		output.data = robot.brain.data.pushbot;

		return output;
	}

	var sessionProto = {
		/**
		 * @return String
		 */
		getLeader: function () {
			return this.leader;
		},

		getUsers: function () {
			return this.users;
		},

		getState: function () {
			return this.state;
		},

		/**
		 * @return String
		 */
		getMessage: function () {
			return this.message;
		},

		isHolded: function () {
			return this.holded;
		},

		getHoldMessage: function () {
			return this.holdMessage;
		},

		setHoldMessage: function (message) {
			robot.logger.debug('set hold message', message);
			this.holdMessage = message;
			this.__ref.holdMessage = message;
		},

		hold: function () {
			this.holded = true;
			this.__ref.holded = true;
		},

		unhold: function () {
			this.holded = false;
			this.__ref.holded = false;
		},

		setState: function (state) {
			this.state = state;
			this.__ref.state = state;
		},

		/**
		 * @param {String} message
		 */
		setMessage: function (message) {
			this.message = message;
			this.__ref.message = message;
		},

		/**
		 * @param {String} leaderName
		 */
		setLeader: function (leaderName) {
			this.leader = leaderName;
			this.__ref.leader = leaderName;
		},

		/**
		 * @param {String} userName
		 */
		addUser: function (userName) {
			this.getUsers().push({
				name: userName,
				state: userStates.waiting
			});
		},

		/**
		 * @return Boolean
		 */
		isLeaderJoined: function () {
			return this.getUsers().some(function (user) {
				this.isUserLeader(User(user).getName());
			}.bind(this));
		},

		/**
		 * @param {String} userName
		 * @return Boolean
		 */
		isUserLeader: function (userName) {
			return this.getLeader() === userName;
		},

		/**
		 * @return Boolean
		 */
		isAllUserGood: function () {
			return this.getUsers().map(User).every(function (u) {
				return u.isGood();
			});
		},

		resetUsers: function () {
			this.getUsers().map(User).forEach(function (user) {
				user.setState(userStates.waiting);
			});
		},

	};

	function Session(session) {
		var output = Object.create(sessionProto);

		output.leader = session.leader;
		output.state = session.state;
		output.message = session.message;
		output.users = session.users;
		output.holded = session.holded;
		output.holdMessage = session.holdMessage;

		output.__ref = session;

		return output;
	}

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
				return '✓' + user.getName();
			} else if (user.isHolding()) {
				return '✗' + user.getName();
			} else {
				return user.getName();
			}
		}).join(' + ');
	}

	function getStateStrForSession(session) {
		var sess = Session(session);
		var msg = [];

		if (sess.isHolded()) {
			msg.push('HOLD: ☂ ' + sess.getHoldMessage() + ' ☂');
		}

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

	/*
	function isUserParticipating(room, userName) {
		var roomSessions = Brain().getRoomSessions(room);

		return roomSessions.some(function (session) {
			return  Session(session).getUsers().some(function (sessionUser) {
				return User(sessionUser).getName() === userName;
			});
		});
	}
	*/

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
		var roomSessions = Brain().getRoomSessions(room);

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

		if (index > -1) {
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

		index = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			session = Brain().getRoomSessionAtIndex(room, index);

			sess = Session(session);

			if (sess.isHolded()) {
				return new SessionHoldedError();
			}

			if (!sess.isAllUserGood()) {
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

		var index = findSessionIndexWithUser(room, userName);

		if (index !== -1) {
			brain = Brain();
			session = brain.getRoomSessionAtIndex(room, index);
			sess = Session(session);

			if (sess.isHolded()) {
				return new SessionHoldedError();
			}

			/*
			if (!sess.isUserLeader(userName)) {
				return new NotLeadingError();
			}
			*/

			if (!sess.isAllUserGood()) {
				return new UsersNotReadyError(sess.getUsers().map(User).map(function (u) {
					return u.getName();
				}));
			}

			if (sess.getState() === state) {
				return new NotChangedError();
			}

			sess.setState(state);

			sess.resetUsers();

			brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new NotLeadingError();
		}
	}

	function unholdSession(room, userName) {
		var sess, brain;

		var index = findSessionIndexWithUser(room, userName);

		if (index !== -1) {
			brain = Brain();
			sess = Session(brain.getRoomSessionAtIndex(room, index));

			if (!sess.isHolded()) {
				return new NotChangedError();
			}

			sess.unhold();
			sess.setHoldMessage('');

			return null;
		} else {
			return new NotInSessionError();
		}
	}

	function holdSession(room, userName, message) {
		var sess, brain;

		var index = findSessionIndexWithUser(room, userName);

		if (index !== -1) {
			brain = Brain();
			sess = Session(brain.getRoomSessionAtIndex(room, index));

			sess.hold();
			sess.setHoldMessage(message);

			return null;
		} else {
			return new NotInSessionError();
		}
	}

	function getTopicString(room) {
		var roomSessions = Brain().getRoomSessions(room);

		var topic = roomSessions.map(getStateStrForSession);

		return topic.join(' | ');
	}

	function kickUser(room, leader, userName) {
		var index = findSessionIndexWithUser(room, leader);
		var session;

		if (index === -1) {
			return new NotInSessionError();
		}

		session = Brain().getRoomSessionAtIndex(room, index);
		if (Session(session).getLeader() !== leader) {
			return new NotLeadingError();
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

	function setTopic(msg) {
		var topic = getTopicString(msg.message.room);

		robot.logger.debug('Set topic:', topic, 'room:', msg.message.room);

		return msg.topic(topic);
	}

	// .join command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.join.join('|') + ')$' ), function (msg) {


		var room = msg.message.room;

		var leader = msg.message.user.name;

		var err = addSession(room, leader);

		if (err) {
			msg.reply(err);
			robot.logger.error(err);
		} else {
			setTopic(msg);
		}
	});

	// .nevermind command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.nevermind.join('|') + ')$' ), function (msg) {
		var room = msg.message.room;

		var userName = msg.message.user.name;

		var err = leaveSession(room, userName);

		if (err && !(err instanceof NotInSessionError)) {
			msg.reply(err.message);
			robot.logger.error('.nevermind:', err);
		} else {
			setTopic(msg);
		}
	});

	// .join with command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.joinWith.join('|') + ') (\\w+)$'), function (msg) {
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
	});

	// .join before command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.joinBefore.join('|') + ') (\\w+)$'), function (msg) {
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

	});

	// .done command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.done.join('|') + ')$'), function (msg) {
		var userName = msg.message.user.name;
		var room = msg.message.room;

		var err = finish(room, userName);
		var nextSession;

		if (err) {
			if (!(err instanceof NotInSessionError)) {
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
	});

	// at command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.at.join('|') + ') (' + validStates.join('|') + ')$'), function (msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;

		var err = setRoomState(room, userName, msg.match[1]);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.at:', err);
			}
		} else {
			setTopic(msg);
		}
	});

	// .good command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.good.join('|') + ')$'), function (msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;
		var session, sess;
		var sessionIndex;

		var err = setUserState(room, userName, userStates.good);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.good:', err);
			}
		} else {
			sessionIndex = findSessionIndexWithUser(room, userName);

			session = Brain().getRoomSessionAtIndex(room, sessionIndex);

			sess = Session(session);

			if (sess.isAllUserGood()) {
				msg.send(getUserListStr(getSortedSessionUsers(sess)) + ': Everyone is ready');
			}
			setTopic(msg);
		}
	});

	// .uhoh command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.uhoh.join('|') + ')$'), function (msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;

		var err = setUserState(room, userName, userStates.uhoh);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err);
				robot.logger.error('.uhoh:', err);
			}
		} else {
			setTopic(msg);
		}
	});

	// .hold command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.hold.join('|') + ') ' + messageRegexp + '$'), function (msg) {
		robot.logger.debug('COMMANBD HOLD');
		var room = msg.message.room;
		var userName = msg.message.user.name;
		var message = msg.match[1];

		var err = holdSession(room, userName, message);

		if (err) {
			msg.reply(err);
			robot.logger.error('.hold:', err);
		} else {
			setTopic(msg);
		}
	});

	// .unhold command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.unhold.join('|') + ')$'), function (msg) {
		var room = msg.message.room;
		var userName = msg.message.user.name;

		var err = unholdSession(room, userName);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err);
				robot.logger.error('.unhold:', err);
			}
		} else {
			setTopic(msg);
		}
	});

	// .sessions command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.sessions.join('|') + ')$'), function (msg) {
		var room = msg.message.room;

		var roomSessions = Brain().getRoomSessions(room);

		if (roomSessions.length) {
			msg.send(roomSessions.map(function (session) {
				var msg = [];
				var sess = Session(session);

				if (sess.isHolded()) {
					msg.push('HOLD: ☂ ' + sess.getHoldMessage() + ' ☂');
				}

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
	});

	// .kick command
	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.kick.join('|') + ') ([\\w#]+)$'), function (msg) {
		var room = msg.message.room;

		var user = msg.message.user.name;

		var err = kickUser(room, user, msg.match[1]);

		if (err && !(err instanceof NotInSessionError)) {
			msg.reply(err.message);
			robot.logger.error('.kick:', err);
		} else {
			setTopic(msg);
		}
	});

	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.message.join('|') + ') ' + messageRegexp + '$'), function (msg) {
		var room = msg.message.room;

		var userName = msg.message.user.name;

		var err = setMessage(room, userName, msg.match[1]);

		if (err ) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err.message);
			}
		} else {
			setTopic(msg);
		}
	});

	robot.hear(new RegExp('^\\' + bot + '(?:' + commands.clearplease.join('|') + ')$'), function (msg) {
		Brain().clearRoomSessions(msg.message.room);
		setTopic(msg);
	});
};
