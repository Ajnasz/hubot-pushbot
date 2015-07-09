/// <reference path="util.ts" />
/// <reference path="User.ts" />
module Session {

	export interface SessionUser {
		name: string;
		state: User.UserState;
	}

	export interface SessionData {
		state: string;
		message: string;
		leader: string;
		users: SessionUser[];
	}

	export class Session {
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
				state: User.UserState.Waiting
			});
		}

		isLeaderJoined(): boolean {
			return this.getUsers().some((user): boolean => {
				return this.isUserLeader(User.createUser(user).getName());
			});
		}

		isUserLeader(userName: string): boolean {
			return this.getLeader() === userName;
		}

		isUserMember(userName: string): boolean {
			return this.getUsers().some((user) => User.createUser(user).getName() === userName);
		}

		isAllUserGood(): boolean {
			return this.getUsers().map(User.createUser).every(util.invoke('isGood'));
		}

		isAnyUserBad(): boolean {
			return this.getUsers().map(User.createUser).some(util.invoke('isHolding'));
		}

		resetUsers(): void {
			this.getUsers().map(User.createUser).forEach((user) => {
				user.setState(User.UserState.Waiting);
			});
		}

		getUserIndex(userName: string): number {
			let index = -1;
			let users = this.getUsers();

			index = util.findIndex(users, (user): boolean => {
				return User.createUser(user).getName() === userName;
			});

			return index;
		}
	}

	export function sessionObj(session): Session.Session {
		return new Session(session);
	}

}
