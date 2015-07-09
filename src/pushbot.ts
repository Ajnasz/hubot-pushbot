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

/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/xregexp.d.ts" />
/// <reference path="PushbotErrors.ts" />
/// <reference path="Session.ts" />
/// <reference path="Room.ts" />
/// <reference path="Brain.ts" />
/// <reference path="util.ts" />

var XRegExp = require('xregexp').XRegExp;

interface Action {
	requireLeader(): boolean;
	requireMembership(): boolean;
	requireAllUserGood(): boolean;
}

class KickAction implements Action {
	requireLeader() {
		return false;
	}

	requireMembership() {
		return false;
	}

	requireAllUserGood() {
		return false;
	}
}

class DoneAction implements Action {
	requireLeader() {
		return false;
	}

	requireMembership() {
		return true;
	}

	requireAllUserGood() {
		return false;
	}
}

function createAction(name: string): Action {
	switch (name) {
		case 'kick':
			return new KickAction();
			break;

		case 'done':
			return new DoneAction();
			break;
	}

	return null;
}

const defaultMessage = '-';

function createSession(leader: string): Session.SessionData {
	return {
		leader: leader,
		state: '',
		holded: false,
		holdMessage: '',
		message: defaultMessage,
		users: [{
			name: leader,
			state: User.UserState.Waiting
		}]
	};
}

interface MsgDetails {
	room: string;
	userName: string;
}

interface CommandAlias {
	[index: number]: string;
	join(s: string);
}

module.exports = (robot: Robot) => {
	'use strict';

	function createBrain(): Brain.Brain {
		return new Brain.Brain(robot);
	}

	let commands = {
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
		drive: ['drive', 'lead'],
		sessions: ['sessions'],
		clearplease: ['clearplease']
	};

	const messageRegexp: string = '[\\p{Latin}\\p{Common}\\w\'"(){}\\[\\]+*&%$#@~<>=/\\\\ .:;!?_-]+',
		userNameRegexp: string = '[\\w_-]+',
		stateNameRegexp: string = '[\\p{Latin}\\p{Common}\\w_-]+';

	const emptyMessage: string = '-';

	const bot: string = '.',
		goodUserMarker: string = '✓',
		holdingUserMarker: string = '✗';

	// has permission a <user> to do <action> in <session>
	function hasPermission(user: string, action: Action, session: Session.Session): boolean {
		if (action.requireLeader() && user !== session.getLeader()) {
			return false;
		}

		if (action.requireMembership() && !session.isUserMember(user)) {
			return false;
		}

		return true;
	}

	function isUsersStateOk(action: Action, session: Session.Session): boolean {
		return !action.requireAllUserGood() || !session.isAllUserGood();
	}

	// HELPERS
	function getSortedSessionUsers(sess: Session.Session): User.User[] {
		let users = sess.getUsers().map(User.createUser);
		let leader = sess.getLeader();

		users.sort((a, b) => {
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

	function getUserListStr(users: User.User[]): string {
		return users.map((user) => {
			let userName = user.getName();
			if (user.isGood()) {
				return `${goodUserMarker}${userName}`;
			} else if (user.isHolding()) {
				return `${holdingUserMarker}${userName}`;
			} else {
				return userName;
			}
		}).join(' + ');
	}

	function getStateStrForSession(session: Session.SessionData): string {
		let sess = Session.sessionObj(session);
		let msg: string[] = [];

		if (sess.getMessage() && sess.getMessage() !== emptyMessage) {
			msg.push(sess.getMessage());
		}

		if (sess.getState()) {
			msg.push('<' + sess.getState() + '>');
		}

		msg.push(getUserListStr(getSortedSessionUsers(sess)));

		return msg.join(' ');
	}

	function createRoom(room): void {
		let brain = createBrain();

		if (!brain.getRoomSessions(room)) {
			brain.setRoomSessions(room, []);
		}
	}

	function setTopic(msg: Msg): void {
		let topic = getTopicString(msg.message.room);

		robot.logger.debug('Set topic:', topic, 'room:', msg.message.room);

		return msg.topic(topic);
	}
	// HELPERS END

	// LOGICS
	function addSession(room: string, leader: string): Error {
		createRoom(room);

		// if leader is participating in any session in the room, don't allow to
		// start a new one
		// if (isUserParticipating(room, leader)) {
		// 	return new AlreadyInSessionError();
		// }

		let roomSessions = createBrain().getRoomSessions(room);
		roomSessions.push(createSession(leader));

		return null;
	}

	function insertSession(room: string, leader: string, beforeIndex: number): Error {
		// if leader is participating in any session in the room, don't allow to
		// start a new one
		// if (isUserParticipating(room, leader)) {
		// 	return new AlreadyInSessionError();
		// }

		let roomSessions = createBrain().getRoomSessions(room);

		roomSessions.splice(beforeIndex, 0, createSession(leader));
		return null;
	}

	function removeSession(room: string, leader: string): void {
		let brain = createBrain();
		let roomSessions = brain.getRoomSessions(room);
		let index = -1;

		index = util.findIndex(roomSessions, (session) => {
			return Session.sessionObj(session).isUserLeader(leader);
		});

		if (index > -1) {
			roomSessions.splice(index, 1);
			brain.setRoomSessions(room, roomSessions);
		}
	}

	function findSessionIndexWithUser(room: string, userName: string): number {
		let brain: Brain.Brain = createBrain(), roomSessions;

		if (!brain.hasSessions(room)) {
			return -1;
		}

		roomSessions = brain.getRoomSessions(room);

		return util.findIndex(roomSessions, (session): boolean => {
			return Session.sessionObj(session).getUserIndex(userName) > -1;
		});
	}

	function leaveSession(room: string, userName: string): Error {
		createRoom(room);

		let brain: Brain.Brain = createBrain();

		let roomSessions: Session.SessionData[] = brain.getRoomSessions(room);

		let index: number = util.findIndex(roomSessions, (session): boolean => {
			return Session.sessionObj(session).getUserIndex(userName) > -1;
		});

		if (brain.getRoom(room).isUserInSession(userName)) {
			let session: Session.SessionData = brain.getRoomSessionAtIndex(room, index);;
			let sess: Session.Session = Session.sessionObj(session);

			if (sess.isUserLeader(userName)) {
				return new PushbotErrors.LeaderCanNotLeaveError();
			}

			let userIndex = sess.getUserIndex(userName);

			if (userIndex === -1) {
				return new PushbotErrors.UserNotFoundError();
			}

			let users = sess.getUsers();
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
			return new PushbotErrors.NotInSessionError();
		}
	}

	function joinSession(room: string, refUser: string, user: string): Error {
		createRoom(room);

		let sessionIndex = findSessionIndexWithUser(room, refUser);

		if (sessionIndex === -1) {
			return new PushbotErrors.NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);

		if (Session.sessionObj(session).getUserIndex(user) > -1) {
			return new PushbotErrors.AlreadyInSessionError();
		} else {
			Session.sessionObj(session).addUser(user);
			return null;
		}
	}

	function setUserState(room: string, userName: string, state: User.UserState): Error {
		let index: number = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			let brain = createBrain();
			let session = brain.getRoomSessionAtIndex(room, index);

			let sess = Session.sessionObj(session);
			let userIndex = sess.getUserIndex(userName);

			if (User.createUser(sess.getUsers()[userIndex]).getState() === state) {
				return new PushbotErrors.NotChangedError();
			}

			sess.getUsers()[userIndex].state = state;

			brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new PushbotErrors.NotInSessionError();
		}
	}

	function finish(room: string, userName: string): Error {
		let brain: Brain.Brain = createBrain();

		if (brain.getRoom(room).isHolded()) {
			return new PushbotErrors.RoomHoldedError();
		}

		let index = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			let session = createBrain().getRoomSessionAtIndex(room, index);

			let sess = Session.sessionObj(session);

			let action = createAction('done')

			if (!hasPermission(userName, action, sess)) {
				return new PushbotErrors.PermissionDeniedError();
			}

			if (!isUsersStateOk(action, sess)) {
				let holdingUsers = sess.getUsers().map(User.createUser).filter((user) => {
					return user.isGood();
				});
				return new PushbotErrors.UsersNotReadyError(holdingUsers.map(util.invoke('getName')));
			}

			removeSession(room, sess.getLeader());

			return null;
		}

		return new PushbotErrors.NotInSessionError();
	}

	function setRoomState(room: string, userName: string, state: string): Error {
		let brain = createBrain();

		if (brain.getRoom(room).isHolded()) {
			return new PushbotErrors.RoomHoldedError();
		}

		let index: number = findSessionIndexWithUser(room, userName);

		robot.logger.debug('set room state call', index, room, userName, state);

		if (index !== -1) {
			let session = brain.getRoomSessionAtIndex(room, index);
			let sess = Session.sessionObj(session);

			/*
			if (!sess.isUserLeader(userName)) {
				return new NotLeadingError();
			}
			*/

			if (sess.isAnyUserBad()) {
				return new PushbotErrors.UsersNotReadyError(sess.getUsers().map(User.createUser).map(util.invoke('getName')));
			}

			if (sess.getState() === state) {
				return new PushbotErrors.NotChangedError();
			}

			sess.setState(state);

			sess.resetUsers();

			// brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new PushbotErrors.NotLeadingError();
		}
	}

	function unholdRoom(room: string): Error {
		let brain = createBrain();
		let roomObj = brain.getRoom(room);

		if (!roomObj) {
			createRoom(room);
			roomObj = brain.getRoom(room);
		}

		if (!roomObj.isHolded()) {
			return new PushbotErrors.NotChangedError();
		}

		roomObj.unhold();
		roomObj.setHoldMessage('');

		return null;
	}

	function holdRoom(room: string, message: string): Error {
		let brain = createBrain();
		let roomObj = brain.getRoom(room);

		if (!roomObj) {
			createRoom(room);
			roomObj = brain.getRoom(room);
		}

		roomObj.hold();
		roomObj.setHoldMessage(message);

		return null;
	}

	function driveSession(room: string, userName: string) {
		let sessionIndex = findSessionIndexWithUser(room, userName);

		if (sessionIndex === -1) {
			return new PushbotErrors.NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
		let sess = Session.sessionObj(session);

		if (sess.isUserLeader(userName)) {
			return new PushbotErrors.NotChangedError();
		}

		Session.sessionObj(session).setLeader(userName);

		return null;
	}

	function getTopicString(room: string): string {
		let brain = createBrain();
		let roomObj = brain.getRoom(room);
		let roomSessions = createBrain().getRoomSessions(room);

		let topic: string[] = [];

		if (roomObj.isHolded()) {
			let holdMessage = roomObj.getHoldMessage();
			topic.push(`HOLD: ☂ ${holdMessage}  ☂`);
		}

		topic = topic.concat(roomSessions.map(getStateStrForSession));

		return topic.join(' | ');
	}

	function kickUser(room: string, leader: string, userName: string): Error {
		let index = findSessionIndexWithUser(room, leader);

		if (index === -1) {
			return new PushbotErrors.NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, index);
		if (!hasPermission(leader, createAction('kick'), Session.sessionObj(session))) {
			return new PushbotErrors.PermissionDeniedError();
		}

		if (leader === userName) {
			return new PushbotErrors.UserNotKickableError();
		}

		return leaveSession(room, userName);
	}

	function setMessage(room: string, userName: string, message: string): Error {
		let sessionIndex = findSessionIndexWithUser(room, userName);

		if (sessionIndex === -1) {
			return new PushbotErrors.NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
		let sess = Session.sessionObj(session);

		if (sess.getMessage() === message) {
			return new PushbotErrors.NotChangedError();
		}

		sess.setMessage(message);

		return null;

	}

	// LOGICS END

	function extractMsgDetails(msg: Msg): MsgDetails {
		return {
			room: msg.message.room,
			userName: msg.message.user.name
		};
	}

	// COMMAND CALLBACKS
	function onJoinCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);
		let err = addSession(room, userName);

		if (err) {
			msg.reply(err.message);
			robot.logger.error(err);
		} else {
			setTopic(msg);
		}
	}

	function onNevermindCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = leaveSession(room, userName);

		if (err && !(err instanceof PushbotErrors.NotInSessionError)) {
			msg.reply(err.message);
			robot.logger.error('.nevermind:', err);
		} else {
			setTopic(msg);
		}
	}

	function onJoinWithCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);
		let leader = msg.match[1];

		let err = joinSession(room, leader, userName);

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.join with:', err);
		} else {
			setTopic(msg);
		}
	}

	function onJoinBeforeCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);
		let refUser = msg.match[1];

		let sessionIndex = findSessionIndexWithUser(room, refUser);
		let err: Error;

		if (sessionIndex === -1) {
			err = new PushbotErrors.NotInSessionError();
		} else {
			err = insertSession(room, userName, sessionIndex);
		}

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.join before:', err);
		} else {
			setTopic(msg);
		}

	}

	function onDoneCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = finish(room, userName);

		if (err) {
			if (!(err instanceof PushbotErrors.NotInSessionError)) {
				msg.reply(err.message);
			}
		} else {
			let nextSession = createBrain().getRoomSessionAtIndex(room, 0);

			if (nextSession) {
				msg.send(nextSession.users.map(User.createUser).map(util.invoke('getName')).join(', ') + ': You are up!');
			}

			setTopic(msg);
		}
	}

	function onAtCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setRoomState(room, userName, msg.match[1]);

		robot.logger.debug('set room state', err);

		if (err) {
			if (!(err instanceof PushbotErrors.NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.at:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onGoodCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setUserState(room, userName, User.UserState.Good);

		if (err) {
			if (!(err instanceof PushbotErrors.NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.good:', err);
			}
		} else {
			let sessionIndex = findSessionIndexWithUser(room, userName);

			let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);

			let sess = Session.sessionObj(session);

			if (sess.isAllUserGood()) {
				msg.send(getSortedSessionUsers(sess).map(util.invoke('getName')).join(', ') + ': Everyone is ready');
			}
			setTopic(msg);
		}
	}

	function onUhOhCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setUserState(room, userName, User.UserState.Uhoh);

		if (err) {
			if (!(err instanceof PushbotErrors.NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.uhoh:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onHoldCommand(msg: Msg): void {
		robot.logger.debug('COMMANBD HOLD');
		let room = msg.message.room;
		let message = msg.match[1];

		let err = holdRoom(room, message);

		if (err) {
			msg.reply(err.message);
			robot.logger.error('.hold:', err);
		} else {
			setTopic(msg);
		}
	}

	function onUnholdCommand(msg: Msg): void {
		let room = msg.message.room;

		let err = unholdRoom(room);

		if (err) {
			if (!(err instanceof PushbotErrors.NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.unhold:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onSessionsCommand(msg: Msg): void {
		let room = msg.message.room;
		let brain = createBrain();

		let roomSessions = brain.getRoomSessions(room);

		if (roomSessions.length) {
			msg.send(roomSessions.map((session): string => {
				let msg: string[] = [];
				let sess = Session.sessionObj(session);

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

	function onKickCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = kickUser(room, userName, msg.match[1]);

		if (err && !(err instanceof PushbotErrors.NotInSessionError)) {
			msg.reply(err.message);
			robot.logger.error('.kick:', err);
		} else {
			setTopic(msg);
		}
	}

	function onMessageCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setMessage(room, userName, msg.match[1]);

		if (err ) {
			if (!(err instanceof PushbotErrors.NotChangedError)) {
				msg.reply(err.message);
			}
		} else {
			setTopic(msg);
		}
	}

	function onClearPleaseCommand(msg: Msg): void {
		createBrain().clearRoomSessions(msg.message.room);
		setTopic(msg);
	}

	function onDriveCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = driveSession(room, userName);

		if (err) {
			if (err instanceof PushbotErrors.NotChangedError) {
				return;
			}

			msg.reply(err.message);
			return;
		}

		setTopic(msg);
	}

	function createCommandRegexp(commands: CommandAlias, args?: string): RegExp {
		if (args) {
			return new XRegExp('^\\' + bot + '(?:' + commands.join('|') + ') (' + args + ')\s*$');
		} else {
			return new XRegExp('^\\' + bot + '(?:' + commands.join('|') + ')\s*$');
		}
	}

	robot.brain.on('loaded', () => {
		if (!robot.brain.data.pushbot) {
			robot.brain.data.pushbot = {};
		}
	});

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

	// .drive command
	robot.hear(createCommandRegexp(commands.drive), onDriveCommand);
};
