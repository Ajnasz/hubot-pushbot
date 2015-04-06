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
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
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
function sessionObj(session) {
    return new Session(session);
}
function findUserSessionIndex(session, userName) {
    var index = -1;
    var users = sessionObj(session).getUsers();
    index = findIndex(users, function (user) {
        return createUser(user).getName() === userName;
    });
    return index;
}
var PushbotError = (function () {
    function PushbotError() {
        this.stack = (new Error()).stack;
    }
    return PushbotError;
})();
var NotInSessionError = (function (_super) {
    __extends(NotInSessionError, _super);
    function NotInSessionError() {
        _super.apply(this, arguments);
        this.name = 'NotInSessionError';
        this.message = 'User not found in session';
    }
    return NotInSessionError;
})(PushbotError);
var NotLeadingError = (function (_super) {
    __extends(NotLeadingError, _super);
    function NotLeadingError() {
        _super.apply(this, arguments);
        this.name = 'NotLeadingError';
        this.message = 'You are not leading any session';
    }
    return NotLeadingError;
})(PushbotError);
var UserNotKickableError = (function (_super) {
    __extends(UserNotKickableError, _super);
    function UserNotKickableError() {
        _super.apply(this, arguments);
        this.name = 'UserNotKickable';
        this.message = 'You can not kick user';
    }
    return UserNotKickableError;
})(PushbotError);
var AlreadyInSessionError = (function (_super) {
    __extends(AlreadyInSessionError, _super);
    function AlreadyInSessionError() {
        _super.apply(this, arguments);
        this.name = 'AlreadyInSessionError';
        this.message = 'User already participating in session';
    }
    return AlreadyInSessionError;
})(PushbotError);
var PermissionDeniedError = (function (_super) {
    __extends(PermissionDeniedError, _super);
    function PermissionDeniedError() {
        _super.apply(this, arguments);
        this.name = 'PermissionDeniedError';
        this.message = 'You have no permission to perform the action';
    }
    return PermissionDeniedError;
})(PushbotError);
var UsersNotReadyError = (function (_super) {
    __extends(UsersNotReadyError, _super);
    function UsersNotReadyError(users) {
        _super.call(this);
        this.name = 'UsersNotReadyError';
        if (users && users.length) {
            this.message = 'Users are not ready: ' + users.join(', ');
        }
        else {
            this.message = 'Users are not ready';
        }
    }
    return UsersNotReadyError;
})(PushbotError);
var UserNotFoundError = (function (_super) {
    __extends(UserNotFoundError, _super);
    function UserNotFoundError() {
        _super.apply(this, arguments);
        this.name = 'UserNotFoundError';
        this.message = 'User not found';
    }
    return UserNotFoundError;
})(PushbotError);
var LeaderCanNotLeaveError = (function (_super) {
    __extends(LeaderCanNotLeaveError, _super);
    function LeaderCanNotLeaveError() {
        _super.apply(this, arguments);
        this.name = 'LeaderCanNotLeaveError';
        this.message = 'Leader can not leave the session';
    }
    return LeaderCanNotLeaveError;
})(PushbotError);
var NotChangedError = (function (_super) {
    __extends(NotChangedError, _super);
    function NotChangedError() {
        _super.apply(this, arguments);
        this.name = 'NotChangedError';
        this.message = 'Value not changed';
    }
    return NotChangedError;
})(PushbotError);
var RoomHoldedError = (function (_super) {
    __extends(RoomHoldedError, _super);
    function RoomHoldedError() {
        _super.apply(this, arguments);
        this.name = 'RoomHoldedError';
        this.message = 'Room holded';
    }
    return RoomHoldedError;
})(PushbotError);
var UserState;
(function (UserState) {
    UserState[UserState["Good"] = 0] = "Good";
    UserState[UserState["Uhoh"] = 1] = "Uhoh";
    UserState[UserState["Waiting"] = 2] = "Waiting";
})(UserState || (UserState = {}));
var User = (function () {
    function User(userData) {
        this.name = userData.name;
        this.state = userData.state;
        this.__ref = userData;
    }
    User.prototype.getName = function () {
        return this.name;
    };
    User.prototype.getState = function () {
        return this.state;
    };
    User.prototype.setState = function (state) {
        this.__ref.state = state;
        this.state = state;
    };
    User.prototype.isGood = function () {
        return this.getState() === 0 /* Good */;
    };
    User.prototype.isHolding = function () {
        return this.getState() === 1 /* Uhoh */;
    };
    return User;
})();
function createUser(userData) {
    return new User(userData);
}
var Action = (function () {
    function Action(name) {
        this.name = name;
    }
    Action.prototype.requireLeader = function () {
        return false;
    };
    Action.prototype.requireMembership = function () {
        return false;
    };
    return Action;
})();
function createAction(name) {
    return new Action(name);
}
var Brain = (function () {
    function Brain(robot) {
        if (!robot.brain.data.pushbot) {
            robot.brain.data.pushbot = Object.create(null);
        }
        this.data = robot.brain.data.pushbot;
    }
    Brain.prototype.getRooms = function () {
        return this.data;
    };
    Brain.prototype.getRoom = function (room) {
        var roomObj = this.getRooms()[room];
        if (roomObj) {
            return new Room(roomObj);
        }
        return null;
    };
    Brain.prototype.getRoomSessions = function (room) {
        var roomData = this.getRoom(room);
        return roomData && roomData.getSessions();
    };
    Brain.prototype.hasSessions = function (room) {
        var roomSessions = this.getRoomSessions(room);
        return roomSessions && roomSessions.length > 0;
    };
    Brain.prototype.setRoomData = function (room) {
        this.getRooms()[room] = {
            holded: false,
            sessions: []
        };
    };
    Brain.prototype.setRoomSessions = function (room, sessions) {
        var roomData = this.getRoom(room);
        if (!roomData) {
            this.setRoomData(room);
        }
        this.getRoom(room).setSessions(sessions);
    };
    Brain.prototype.clearRoomSessions = function (room) {
        this.setRoomData(room);
    };
    Brain.prototype.setRoomSessionAtIndex = function (room, index, session) {
        this.getRoomSessions(room)[index] = session;
    };
    Brain.prototype.getRoomSessionAtIndex = function (room, index) {
        var rooms = this.getRoomSessions(room);
        if (rooms && rooms.length > index) {
            return rooms[index];
        }
        return null;
    };
    return Brain;
})();
var Session = (function () {
    function Session(session) {
        this.leader = session.leader;
        this.state = session.state;
        this.message = session.message;
        this.users = session.users;
        this.__ref = session;
    }
    Session.prototype.getLeader = function () {
        return this.leader;
    };
    Session.prototype.getUsers = function () {
        return this.users;
    };
    Session.prototype.getState = function () {
        return this.state;
    };
    Session.prototype.getMessage = function () {
        return this.message;
    };
    Session.prototype.getHoldMessage = function () {
        return this.holdMessage;
    };
    Session.prototype.setState = function (state) {
        this.state = state;
        this.__ref.state = state;
    };
    Session.prototype.setMessage = function (message) {
        this.message = message;
        this.__ref.message = message;
    };
    Session.prototype.setLeader = function (leaderName) {
        this.leader = leaderName;
        this.__ref.leader = leaderName;
    };
    Session.prototype.addUser = function (userName) {
        this.getUsers().push({
            name: userName,
            state: 2 /* Waiting */
        });
    };
    Session.prototype.isLeaderJoined = function () {
        return this.getUsers().some(function (user) {
            this.isUserLeader(createUser(user).getName());
        }.bind(this));
    };
    Session.prototype.isUserLeader = function (userName) {
        return this.getLeader() === userName;
    };
    Session.prototype.isAllUserGood = function () {
        return this.getUsers().map(createUser).every(function (u) {
            return u.isGood();
        });
    };
    Session.prototype.isAnyUserBad = function () {
        return this.getUsers().map(createUser).some(function (u) {
            return u.isHolding();
        });
    };
    Session.prototype.resetUsers = function () {
        this.getUsers().map(createUser).forEach(function (user) {
            user.setState(2 /* Waiting */);
        });
    };
    return Session;
})();
var defaultMessage = '-';
function createSession(leader) {
    return {
        leader: leader,
        state: '',
        holded: false,
        holdMessage: '',
        message: defaultMessage,
        users: [{
            name: leader,
            state: 2 /* Waiting */
        }]
    };
}
var Room = (function () {
    function Room(room) {
        this.sessions = room.sessions;
        this.holdMessage = room.holdMessage;
        this.holded = room.holded;
        this.__ref = room;
    }
    Room.prototype.getSessions = function () {
        return this.sessions;
    };
    Room.prototype.setSessions = function (sessions) {
        this.sessions = sessions;
        this.__ref.sessions = sessions;
    };
    Room.prototype.isHolded = function () {
        return this.holded;
    };
    Room.prototype.hold = function () {
        this.holded = true;
        this.__ref.holded = true;
    };
    Room.prototype.unhold = function () {
        this.holded = false;
        this.__ref.holded = false;
    };
    Room.prototype.setHoldMessage = function (message) {
        this.holdMessage = message;
        this.__ref.holdMessage = message;
    };
    Room.prototype.getHoldMessage = function () {
        return this.holdMessage;
    };
    Room.prototype.isUserInSession = function (userName) {
        var roomSessions = this.getSessions();
        if (!roomSessions) {
            return false;
        }
        var index = findIndex(roomSessions, function (session) {
            return findUserSessionIndex(session, userName) > -1;
        });
        return index > -1;
    };
    return Room;
})();
module.exports = function (robot) {
    'use strict';
    function createBrain() {
        return new Brain(robot);
    }
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
    var emptyMessage = '-';
    var stateNameRegexp = userNameRegexp;
    var goodUserMarker = '✓', holdingUserMarker = '✗';
    robot.brain.on('loaded', function () {
        if (!robot.brain.data.pushbot) {
            robot.brain.data.pushbot = {};
        }
    });
    // ERRORS END
    // has permission a <user> to do <action> in <session>
    function hasPermission(user, action, session) {
        if (action.requireLeader() && user !== session.getLeader()) {
            return false;
        }
        return true;
    }
    // TYPES END
    // HELPERS
    function getSortedSessionUsers(sess) {
        // var sess = createSession(session);
        var users = sess.getUsers().map(createUser);
        var leader = sess.getLeader();
        users.sort(function (a, b) {
            if (a.getName() === leader) {
                return -1;
            }
            else if (b.getName() === leader) {
                return 1;
            }
            else {
                return 0;
            }
        });
        return users;
    }
    function getUserListStr(users) {
        return users.map(function (user) {
            if (user.isGood()) {
                return goodUserMarker + user.getName();
            }
            else if (user.isHolding()) {
                return holdingUserMarker + user.getName();
            }
            else {
                return user.getName();
            }
        }).join(' + ');
    }
    function getStateStrForSession(session) {
        var sess = sessionObj(session);
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
        var brain = createBrain();
        if (!brain.getRoomSessions(room)) {
            brain.setRoomSessions(room, []);
        }
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
        roomSessions = createBrain().getRoomSessions(room);
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
        roomSessions = createBrain().getRoomSessions(room);
        roomSessions.splice(beforeIndex, 0, createSession(leader));
        return null;
    }
    function removeSession(room, leader) {
        var brain = createBrain();
        var roomSessions = brain.getRoomSessions(room);
        var index = -1;
        index = findIndex(roomSessions, function (session) {
            return sessionObj(session).isUserLeader(leader);
        });
        if (index > -1) {
            roomSessions.splice(index, 1);
            brain.setRoomSessions(room, roomSessions);
        }
    }
    function findSessionIndexWithUser(room, userName) {
        var brain = createBrain(), roomSessions;
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
        var brain = createBrain();
        var roomSessions = brain.getRoomSessions(room);
        var index = findIndex(roomSessions, function (session) {
            return findUserSessionIndex(session, userName) > -1;
        });
        var users;
        if (brain.getRoom(room).isUserInSession(userName)) {
            var session = brain.getRoomSessionAtIndex(room, index), userIndex;
            var sess = sessionObj(session);
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
            }
            else {
                if (!sess.isLeaderJoined()) {
                    sess.setLeader(users[0].name);
                }
                brain.setRoomSessionAtIndex(room, index, session);
            }
            return null;
        }
        else {
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
        session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
        if (findUserSessionIndex(session, user) > -1) {
            return new AlreadyInSessionError();
        }
        else {
            sessionObj(session).addUser(user);
            return null;
        }
    }
    function setUserState(room, userName, state) {
        var index = findSessionIndexWithUser(room, userName);
        var session, userIndex, sess, brain;
        if (index > -1) {
            brain = createBrain();
            session = brain.getRoomSessionAtIndex(room, index);
            userIndex = findUserSessionIndex(session, userName);
            sess = sessionObj(session);
            if (createUser(sess.getUsers()[userIndex]).getState() === state) {
                return new NotChangedError();
            }
            sess.getUsers()[userIndex].state = state;
            brain.setRoomSessionAtIndex(room, index, session);
            return null;
        }
        else {
            return new NotInSessionError();
        }
    }
    function finish(room, userName) {
        var index, session, sess;
        var holdingUsers;
        var brain = createBrain();
        if (brain.getRoom(room).isHolded()) {
            return new RoomHoldedError();
        }
        index = findSessionIndexWithUser(room, userName);
        if (index > -1) {
            session = createBrain().getRoomSessionAtIndex(room, index);
            sess = sessionObj(session);
            if (sess.getState() && !sess.isAllUserGood()) {
                holdingUsers = sess.getUsers().map(createUser).filter(function (user) {
                    return !user.isGood();
                });
                return new UsersNotReadyError(holdingUsers.map(function (u) {
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
        brain = createBrain();
        if (brain.getRoom(room).isHolded()) {
            return new RoomHoldedError();
        }
        var index = findSessionIndexWithUser(room, userName);
        robot.logger.debug('set room state call', index, room, userName, state);
        if (index !== -1) {
            session = brain.getRoomSessionAtIndex(room, index);
            sess = sessionObj(session);
            /*
            if (!sess.isUserLeader(userName)) {
                return new NotLeadingError();
            }
            */
            if (sess.isAnyUserBad()) {
                return new UsersNotReadyError(sess.getUsers().map(createUser).map(function (u) {
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
        }
        else {
            return new NotLeadingError();
        }
    }
    function unholdRoom(room) {
        var brain = createBrain();
        var roomObj = brain.getRoom(room);
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
    function holdRoom(room, message) {
        var brain = createBrain();
        var roomObj = brain.getRoom(room);
        if (!roomObj) {
            createRoom(room);
            roomObj = brain.getRoom(room);
        }
        roomObj.hold();
        roomObj.setHoldMessage(message);
        return null;
    }
    function getTopicString(room) {
        var brain = createBrain();
        var roomObj = brain.getRoom(room);
        var roomSessions = createBrain().getRoomSessions(room);
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
        session = createBrain().getRoomSessionAtIndex(room, index);
        if (!hasPermission(leader, createAction('kick'), sessionObj(session))) {
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
        var session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
        var sess = sessionObj(session);
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
            msg.reply(err.message);
            robot.logger.error(err);
        }
        else {
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
        }
        else {
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
        }
        else {
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
        }
        else {
            err = insertSession(room, leader, sessionIndex);
        }
        if (err) {
            msg.reply(err.message);
            robot.logger.error('.join before:', err);
        }
        else {
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
        }
        else {
            nextSession = createBrain().getRoomSessionAtIndex(room, 0);
            if (nextSession) {
                msg.send(nextSession.users.map(createUser).map(function (u) {
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
        }
        else {
            setTopic(msg);
        }
    }
    function onGoodCommand(msg) {
        var room = msg.message.room;
        var userName = msg.message.user.name;
        var session, sess;
        var sessionIndex;
        var err = setUserState(room, userName, 0 /* Good */);
        if (err) {
            if (err.name !== 'NotChangedError') {
                msg.reply(err.message);
                robot.logger.error('.good:', err);
            }
        }
        else {
            sessionIndex = findSessionIndexWithUser(room, userName);
            session = createBrain().getRoomSessionAtIndex(room, sessionIndex);
            sess = sessionObj(session);
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
        var err = setUserState(room, userName, 1 /* Uhoh */);
        if (err) {
            if (err.name !== 'NotChangedError') {
                msg.reply(err.message);
                robot.logger.error('.uhoh:', err);
            }
        }
        else {
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
        }
        else {
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
        }
        else {
            setTopic(msg);
        }
    }
    function onSessionsCommand(msg) {
        var room = msg.message.room;
        var brain = createBrain();
        var roomSessions = brain.getRoomSessions(room);
        if (roomSessions.length) {
            msg.send(roomSessions.map(function (session) {
                var msg = [];
                var sess = sessionObj(session);
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
        }
        else {
            setTopic(msg);
        }
    }
    function onMessageCommand(msg) {
        var room = msg.message.room;
        var userName = msg.message.user.name;
        var err = setMessage(room, userName, msg.match[1]);
        if (err) {
            if (err.name !== 'NotChangedError') {
                msg.reply(err.message);
            }
        }
        else {
            setTopic(msg);
        }
    }
    function onClearPleaseCommand(msg) {
        createBrain().clearRoomSessions(msg.message.room);
        setTopic(msg);
    }
    function createCommandRegexp(commands, args) {
        if (args) {
            return new RegExp('^\\' + bot + '(?:' + commands.join('|') + ') (' + args + ')$');
        }
        else {
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
