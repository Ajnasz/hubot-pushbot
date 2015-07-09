module PushbotErrors {
	class PushbotError implements Error {
		public name: string;
		public message: string;
		public stack: string;
		constructor() {
			this.stack = (<any>new Error()).stack;
		}
	}

	export class NotInSessionError extends PushbotError {
		public name: string = 'NotInSessionError';
		public message: string = 'User not found in session';
	}

	export class NotLeadingError extends PushbotError {
		public name: string = 'NotLeadingError';
		public message: string = 'You are not leading any session';
	}

	export class UserNotKickableError extends PushbotError {
		public name: string = 'UserNotKickable';
		public message: string = 'You can not kick user';
	}

	export class AlreadyInSessionError extends PushbotError {
		public name: string = 'AlreadyInSessionError';
		public message: string = 'User already participating in session';
	}

	export class PermissionDeniedError extends PushbotError {
		public name: string = 'PermissionDeniedError';
		public message: string = 'You have no permission to perform the action';
	}

	export class UsersNotReadyError extends PushbotError {
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

	export class UserNotFoundError extends PushbotError {
		public name: string = 'UserNotFoundError';
		public message: string = 'User not found';
	}

	export class LeaderCanNotLeaveError extends PushbotError {
		public name: string = 'LeaderCanNotLeaveError';
		public message: string = 'Leader can not leave the session';
	}

	export class NotChangedError extends PushbotError {
		public name: string = 'NotChangedError';
		public message: string = 'Value not changed';
	}

	export class RoomHoldedError extends PushbotError {
		public name: string = 'RoomHoldedError';
		public message: string = 'Room holded';
	}
}
