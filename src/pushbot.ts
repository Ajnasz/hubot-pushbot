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
/// <reference path="../typings/hubotrobot.d.ts" />

interface TesterFunc {
	<T>(param: T): boolean;
}

function findIndex<T>(array: T[], test: TesterFunc) {
	let index = -1;
	for (let i = 0, rl = array.length; i < rl; i++) {
		if (test(array[i])) {
			index = i;
			break;
		}
	}

	return index;
}

function sessionObj(session): Session {
	return new Session(session);
}

function findUserSessionIndex(session: SessionData, userName: string): number {
	let index = -1;
	let users = sessionObj(session).getUsers();

	index = findIndex(users, (user): boolean => {
		return createUser(user).getName() === userName;
	});

	return index;
}

function invoke(method) {
	return (obj) => {
		return obj[method]();
	}
}


class PushbotError implements Error {
	public name: string;
	public message: string;
	public stack: string;
	constructor() {
		this.stack = (<any>new Error()).stack;
	}
}

class NotInSessionError extends PushbotError {
	public name: string = 'NotInSessionError';
	public message: string = 'User not found in session';
}

class NotLeadingError extends PushbotError {
	public name: string = 'NotLeadingError';
	public message: string = 'You are not leading any session';
}

class UserNotKickableError extends PushbotError {
	public name: string = 'UserNotKickable';
	public message: string = 'You can not kick user';
}

class AlreadyInSessionError extends PushbotError {
	public name: string = 'AlreadyInSessionError';
	public message: string = 'User already participating in session';
}

class PermissionDeniedError extends PushbotError {
	public name: string = 'PermissionDeniedError';
	public message: string = 'You have no permission to perform the action';
}

class UsersNotReadyError extends PushbotError {
	public name: string = 'UsersNotReadyError';
	constructor(users?: string[]) {
		super()
		if (users && users.length) {
			this.message = 'Users are not ready: ' + users.join(', ');
		} else {
			this.message = 'Users are not ready';
		}
	}
}

class UserNotFoundError extends PushbotError {
	public name: string = 'UserNotFoundError';
	public message: string = 'User not found';
}

class LeaderCanNotLeaveError extends PushbotError {
	public name: string = 'LeaderCanNotLeaveError';
	public message: string = 'Leader can not leave the session';
}

class NotChangedError extends PushbotError {
	public name: string = 'NotChangedError';
	public message: string = 'Value not changed';
}

class RoomHoldedError extends PushbotError {
	public name: string = 'RoomHoldedError';
	public message: string = 'Room holded';
}

enum UserState { Good, Uhoh, Waiting }

interface UserData {
	name: string;
	state: UserState;
}

class User {
	private name: string;
	private state: UserState;
	private __ref: UserData;

	constructor(userData: UserData) {
		this.name = userData.name;
		this.state = userData.state;
		this.__ref = userData;
	}

	getName(): string {
		return this.name;
	}

	getState (): UserState {
		return this.state;
	}

	setState(state): void {
		this.__ref.state = state;
		this.state = state;
	}

	isGood(): boolean {
		return this.getState() === UserState.Good;
	}

	isHolding(): boolean {
		return this.getState() === UserState.Uhoh;
	}
}

function createUser(userData: UserData) {
	return new User(userData);
}

interface Action {
	name: string;
	requireLeader(): boolean;
	requireMembership(): boolean;
}

class KickAction implements Action {
	name: string = 'kick';
	requireLeader(): boolean {
		return false;
	}

	requireMembership(): boolean {
		return false;
	}
}

function createAction(name: string): Action {
	switch (name) {
		case 'kick':
			return new KickAction();
			break;
	}

	return null;
}

class Brain {
	private data: Object;
	constructor(robot: Robot) {
		if (!robot.brain.data.pushbot) {
			robot.brain.data.pushbot = Object.create(null);
		}
		this.data = robot.brain.data.pushbot;
	}

	getRooms(): Object {
		return this.data;
	}

	getRoom (room: string): Room {
		let roomObj = this.getRooms()[room];

		if (roomObj) {
			return new Room(roomObj);
		}

		return null;
	}

	getRoomSessions (room: string): SessionData[] {
		let roomData = this.getRoom(room);
		return roomData && roomData.getSessions();
	}

	hasSessions (room: string): boolean {
		let roomSessions = this.getRoomSessions(room);

		return roomSessions && roomSessions.length > 0;
	}

	setRoomData (room: string): void {
		this.getRooms()[room] = {
			holded: false,
			sessions: []
		};
	}

	setRoomSessions (room: string, sessions: SessionData[]): void {
		let roomData = this.getRoom(room);

		if (!roomData) {
			this.setRoomData(room);
		}
		this.getRoom(room).setSessions(sessions);
	}

	clearRoomSessions (room: string): void {
		this.setRoomData(room);
	}

	setRoomSessionAtIndex (room: string, index: number, session: SessionData): void {
		this.getRoomSessions(room)[index] = session;
	}

	getRoomSessionAtIndex (room: string, index: number): SessionData {
		let rooms = this.getRoomSessions(room);

		if (rooms && rooms.length > index) {
			return rooms[index];
		}

		return null;
	}

}

interface SessionUser {
	name: string;
	state: UserState;
}

interface SessionData {
	state: string;
	message: string;
	leader: string;
	users: SessionUser[];
}

class Session {
	private leader: string;
	private users: SessionUser[];
	private state: string;
	private message: string;
	private holdMessage: string;
	private __ref: SessionData;

	constructor(session: SessionData) {
		this.leader = session.leader;
		this.state = session.state;
		this.message = session.message;
		this.users = session.users;

		this.__ref = session;

	}

	getLeader(): string {
		return this.leader;
	}

	getUsers(): SessionUser[] {
		return this.users;
	}

	getState(): string {
		return this.state;
	}

	getMessage(): string {
		return this.message;
	}

	getHoldMessage(): string {
		return this.holdMessage;
	}

	setState(state: string): void {
		this.state = state;
		this.__ref.state = state;
	}

	setMessage(message: string): void {
		this.message = message;
		this.__ref.message = message;
	}

	setLeader (leaderName: string): void {
		this.leader = leaderName;
		this.__ref.leader = leaderName;
	}

	addUser(userName: string): void {
		this.getUsers().push({
			name: userName,
			state: UserState.Waiting
		});
	}

	isLeaderJoined(): boolean {
		return this.getUsers().some((user): boolean => {
			return this.isUserLeader(createUser(user).getName());
		});
	}

	isUserLeader(userName: string): boolean {
		return this.getLeader() === userName;
	}

	isAllUserGood(): boolean {
		return this.getUsers().map(createUser).every(invoke('isGood'));
	}

	isAnyUserBad(): boolean {
		return this.getUsers().map(createUser).some(invoke('isHolding'));
	}

	resetUsers(): void {
		this.getUsers().map(createUser).forEach((user) => {
			user.setState(UserState.Waiting);
		});
	}
}

const defaultMessage = '-';

function createSession(leader: string): SessionData {
	return {
		leader: leader,
		state: '',
		holded: false,
		holdMessage: '',
		message: defaultMessage,
		users: [{
			name: leader,
			state: UserState.Waiting
		}]
	};
}

interface RoomData {
	sessions: SessionData[];
	holdMessage: string;
	holded: boolean;
}

class Room {
	private sessions: SessionData[];
	private holded: boolean;
	private holdMessage: string;
	private __ref: RoomData;

	constructor(room: RoomData) {

		this.sessions = room.sessions;
		this.holdMessage = room.holdMessage;
		this.holded = room.holded;

		this.__ref = room;
	}

	getSessions() {
		return this.sessions;
	}

	setSessions(sessions: SessionData[]): void {
		this.sessions = sessions;
		this.__ref.sessions = sessions;
	}

	isHolded(): boolean {
		return this.holded;
	}

	hold(): void {
		this.holded = true;
		this.__ref.holded = true;
	}

	unhold(): void {
		this.holded = false;
		this.__ref.holded = false;
	}

	setHoldMessage(message: string): void {
		this.holdMessage = message;
		this.__ref.holdMessage = message;
	}

	getHoldMessage(): string {
		return this.holdMessage;
	}

	isUserInSession(userName: string): boolean {
		let roomSessions = this.getSessions();

		if (!roomSessions) {
			return false;
		}

		let index = findIndex(roomSessions, (session) => {
			return findUserSessionIndex(session, userName) > -1;
		});

		return index > -1;
	}
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

	function createBrain(): Brain {
		return new Brain(robot);
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
		drive: ['drive'],
		sessions: ['sessions'],
		clearplease: ['clearplease']
	};

	const messageRegexp: string = '[\\w\'"(){}\\[\\]+*&%$#@~<>=/\\\\ .:;!?_-]+',
		userNameRegexp: string = '[\\w_-]+',
		stateNameRegexp: string = userNameRegexp;

	const emptyMessage: string = '-';

	const bot: string = '.',
		goodUserMarker: string = '✓',
		holdingUserMarker: string = '✗';

	// has permission a <user> to do <action> in <session>
	function hasPermission(user: string, action: Action, session: Session): boolean {
		if (action.requireLeader() && user !== session.getLeader()) {
			return false;
		}

		return true;
	}

	// HELPERS
	function getSortedSessionUsers(sess: Session): User[] {
		let users = sess.getUsers().map(createUser);
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

	function getUserListStr(users: User[]): string {
		return users.map((user) => {
			if (user.isGood()) {
				return goodUserMarker + user.getName();
			} else if (user.isHolding()) {
				return holdingUserMarker + user.getName();
			} else {
				return user.getName();
			}
		}).join(' + ');
	}

	function getStateStrForSession(session: SessionData): string {
		let sess = sessionObj(session);
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

		index = findIndex(roomSessions, (session) => {
			return sessionObj(session).isUserLeader(leader);
		});

		if (index > -1) {
			roomSessions.splice(index, 1);
			brain.setRoomSessions(room, roomSessions);
		}
	}

	function findSessionIndexWithUser(room: string, userName: string): number {
		let brain: Brain = createBrain(), roomSessions;

		if (!brain.hasSessions(room)) {
			return -1;
		}

		roomSessions = brain.getRoomSessions(room);

		return findIndex(roomSessions, (session): boolean => {
			return findUserSessionIndex(session, userName) > -1;
		});
	}

	function leaveSession(room: string, userName: string): Error {
		createRoom(room);

		let brain: Brain = createBrain();

		let roomSessions: SessionData[] = brain.getRoomSessions(room);

		let index: number = findIndex(roomSessions, (session): boolean => {
			return findUserSessionIndex(session, userName) > -1;
		});

		if (brain.getRoom(room).isUserInSession(userName)) {
			let session: SessionData = brain.getRoomSessionAtIndex(room, index), userIndex;
			let sess: Session = sessionObj(session);

			if (sess.isUserLeader(userName) && findUserSessionIndex(session, userName) > 1) {
				return new LeaderCanNotLeaveError();
			}

			userIndex = findUserSessionIndex(session, userName);

			if (userIndex === -1) {
				return new UserNotFoundError();
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
			return new NotInSessionError();
		}
	}

	function joinSession(room: string, refUser: string, user: string): Error {
		createRoom(room);

		let sessionIndex = findSessionIndexWithUser(room, refUser);

		if (sessionIndex === -1) {
			return new NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);

		if (findUserSessionIndex(session, user) > -1) {
			return new AlreadyInSessionError();
		} else {
			sessionObj(session).addUser(user);
			return null;
		}
	}

	function setUserState(room: string, userName: string, state: UserState): Error {
		let index: number = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			let brain = createBrain();
			let session = brain.getRoomSessionAtIndex(room, index);
			let userIndex = findUserSessionIndex(session, userName);

			let sess = sessionObj(session);

			if (createUser(sess.getUsers()[userIndex]).getState() === state) {
				return new NotChangedError();
			}

			sess.getUsers()[userIndex].state = state;

			brain.setRoomSessionAtIndex(room, index, session);

			return null;
		} else {
			return new NotInSessionError();
		}
	}

	function finish(room: string, userName: string): Error {
		let brain: Brain = createBrain();

		if (brain.getRoom(room).isHolded()) {
			return new RoomHoldedError();
		}

		let index = findSessionIndexWithUser(room, userName);

		if (index > -1) {
			let session = createBrain().getRoomSessionAtIndex(room, index);

			let sess = sessionObj(session);

			if (sess.getState() && !sess.isAllUserGood()) {
				let holdingUsers = sess.getUsers().map(createUser).filter((user) => {
					return !user.isGood();
				});
				return new UsersNotReadyError(holdingUsers.map(invoke('getName')));
			}

			if (!sess.isUserLeader(userName)) {
				return new PermissionDeniedError();
			}
			removeSession(room, sess.getLeader());

			return null;
		}

		return new NotInSessionError();
	}

	function setRoomState(room: string, userName: string, state: string): Error {
		let brain = createBrain();

		if (brain.getRoom(room).isHolded()) {
			return new RoomHoldedError();
		}

		let index: number = findSessionIndexWithUser(room, userName);

		robot.logger.debug('set room state call', index, room, userName, state);

		if (index !== -1) {
			let session = brain.getRoomSessionAtIndex(room, index);
			let sess = sessionObj(session);

			/*
			if (!sess.isUserLeader(userName)) {
				return new NotLeadingError();
			}
			*/

			if (sess.isAnyUserBad()) {
				return new UsersNotReadyError(sess.getUsers().map(createUser).map(invoke('getName')));
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

	function unholdRoom(room: string): Error {
		let brain = createBrain();
		let roomObj = brain.getRoom(room);

		if (!roomObj) {
			createRoom(room);
			roomObj = brain.getRoom(room);
		}

		if (!roomObj.isHolded()) {
			return new NotChangedError();
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
			return new NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
		let sess = sessionObj(session);

		if (sess.isUserLeader(userName)) {
			return new NotChangedError();
		}

		sessionObj(session).setLeader(userName);

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
			return new NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, index);
		if (!hasPermission(leader, createAction('kick'), sessionObj(session))) {
			return new PermissionDeniedError();
		}

		if (leader === userName) {
			return new UserNotKickableError();
		}

		return leaveSession(room, userName);
	}

	function setMessage(room: string, userName: string, message: string): Error {
		let sessionIndex = findSessionIndexWithUser(room, userName);

		if (sessionIndex === -1) {
			return new NotInSessionError();
		}

		let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
		let sess = sessionObj(session);

		if (sess.getMessage() === message) {
			return new NotChangedError();
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

		if (err && !(err instanceof NotInSessionError)) {
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
			err = new NotInSessionError();
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
			if (!(err instanceof NotInSessionError)) {
				msg.reply(err.message);
			}
		} else {
			let nextSession = createBrain().getRoomSessionAtIndex(room, 0);

			if (nextSession) {
				msg.send(nextSession.users.map(createUser).map(invoke('getName')).join(', ') + ': You are up!');
			}

			setTopic(msg);
		}
	}

	function onAtCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setRoomState(room, userName, msg.match[1]);

		robot.logger.debug('set room state', err);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.at:', err);
			}
		} else {
			setTopic(msg);
		}
	}

	function onGoodCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setUserState(room, userName, UserState.Good);

		if (err) {
			if (!(err instanceof NotChangedError)) {
				msg.reply(err.message);
				robot.logger.error('.good:', err);
			}
		} else {
			let sessionIndex = findSessionIndexWithUser(room, userName);

			let session = createBrain().getRoomSessionAtIndex(room, sessionIndex);

			let sess = sessionObj(session);

			if (sess.isAllUserGood()) {
				msg.send(getSortedSessionUsers(sess).map(invoke('getName')).join(', ') + ': Everyone is ready');
			}
			setTopic(msg);
		}
	}

	function onUhOhCommand(msg: Msg): void {
		let {room, userName} = extractMsgDetails(msg);

		let err = setUserState(room, userName, UserState.Uhoh);

		if (err) {
			if (!(err instanceof NotChangedError)) {
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
			if (!(err instanceof NotChangedError)) {
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
				let sess = sessionObj(session);

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

		if (err && !(err instanceof NotInSessionError)) {
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
			if (!(err instanceof NotChangedError)) {
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
			if (err instanceof NotChangedError) {
				return;
			}

			msg.reply(err.message);
			return;
		}

		setTopic(msg);
	}

	function createCommandRegexp(commands: CommandAlias, args?: string): RegExp {
		if (args) {
			return new RegExp('^\\' + bot + '(?:' + commands.join('|') + ') (' + args + ')$');
		} else {
			return new RegExp('^\\' + bot + '(?:' + commands.join('|') + ')$');
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
