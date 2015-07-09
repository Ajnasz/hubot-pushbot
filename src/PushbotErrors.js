var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var PushbotErrors;
(function (PushbotErrors) {
    var PushbotError = (function () {
        function PushbotError() {
            this.stack = (new Error()).stack;
        }
        return PushbotError;
    })();
    PushbotErrors.PushbotError = PushbotError;
    var NotInSessionError = (function (_super) {
        __extends(NotInSessionError, _super);
        function NotInSessionError() {
            _super.apply(this, arguments);
            this.name = 'NotInSessionError';
            this.message = 'User not found in session';
        }
        return NotInSessionError;
    })(PushbotError);
    PushbotErrors.NotInSessionError = NotInSessionError;
    var NotLeadingError = (function (_super) {
        __extends(NotLeadingError, _super);
        function NotLeadingError() {
            _super.apply(this, arguments);
            this.name = 'NotLeadingError';
            this.message = 'You are not leading any session';
        }
        return NotLeadingError;
    })(PushbotError);
    PushbotErrors.NotLeadingError = NotLeadingError;
    var UserNotKickableError = (function (_super) {
        __extends(UserNotKickableError, _super);
        function UserNotKickableError() {
            _super.apply(this, arguments);
            this.name = 'UserNotKickable';
            this.message = 'You can not kick user';
        }
        return UserNotKickableError;
    })(PushbotError);
    PushbotErrors.UserNotKickableError = UserNotKickableError;
    var AlreadyInSessionError = (function (_super) {
        __extends(AlreadyInSessionError, _super);
        function AlreadyInSessionError() {
            _super.apply(this, arguments);
            this.name = 'AlreadyInSessionError';
            this.message = 'User already participating in session';
        }
        return AlreadyInSessionError;
    })(PushbotError);
    PushbotErrors.AlreadyInSessionError = AlreadyInSessionError;
    var PermissionDeniedError = (function (_super) {
        __extends(PermissionDeniedError, _super);
        function PermissionDeniedError() {
            _super.apply(this, arguments);
            this.name = 'PermissionDeniedError';
            this.message = 'You have no permission to perform the action';
        }
        return PermissionDeniedError;
    })(PushbotError);
    PushbotErrors.PermissionDeniedError = PermissionDeniedError;
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
    PushbotErrors.UsersNotReadyError = UsersNotReadyError;
    var UserNotFoundError = (function (_super) {
        __extends(UserNotFoundError, _super);
        function UserNotFoundError() {
            _super.apply(this, arguments);
            this.name = 'UserNotFoundError';
            this.message = 'User not found';
        }
        return UserNotFoundError;
    })(PushbotError);
    PushbotErrors.UserNotFoundError = UserNotFoundError;
    var LeaderCanNotLeaveError = (function (_super) {
        __extends(LeaderCanNotLeaveError, _super);
        function LeaderCanNotLeaveError() {
            _super.apply(this, arguments);
            this.name = 'LeaderCanNotLeaveError';
            this.message = 'Leader can not leave the session';
        }
        return LeaderCanNotLeaveError;
    })(PushbotError);
    PushbotErrors.LeaderCanNotLeaveError = LeaderCanNotLeaveError;
    var NotChangedError = (function (_super) {
        __extends(NotChangedError, _super);
        function NotChangedError() {
            _super.apply(this, arguments);
            this.name = 'NotChangedError';
            this.message = 'Value not changed';
        }
        return NotChangedError;
    })(PushbotError);
    PushbotErrors.NotChangedError = NotChangedError;
    var RoomHoldedError = (function (_super) {
        __extends(RoomHoldedError, _super);
        function RoomHoldedError() {
            _super.apply(this, arguments);
            this.name = 'RoomHoldedError';
            this.message = 'Room holded';
        }
        return RoomHoldedError;
    })(PushbotError);
    PushbotErrors.RoomHoldedError = RoomHoldedError;
})(PushbotErrors || (PushbotErrors = {}));
