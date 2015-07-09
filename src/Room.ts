/// <reference path="Session.ts" />
/// <reference path="util.ts" />
module Room {

	interface RoomData {
		sessions: Session.SessionData[];
		holdMessage: string;
		holded: boolean;
	}

	export class Room {
		private sessions: Session.SessionData[];
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

		setSessions(sessions: Session.SessionData[]): void {
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

			let index = util.findIndex(roomSessions, (session) => {
				return Session.sessionObj(session).isUserMember(userName);
			});

			return index > -1;
		}
	}

}
