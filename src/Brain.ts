/// <reference path="Room.ts" />
/// <reference path="../typings/hubotrobot.d.ts" />

module Brain {
	export class Brain {
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

		getRoom (room: string): Room.Room {
			let roomObj = this.getRooms()[room];

			if (roomObj) {
				return new Room.Room(roomObj);
			}

			return null;
		}

		getRoomSessions (room: string): Session.SessionData[] {
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

		setRoomSessions (room: string, sessions: Session.SessionData[]): void {
			let roomData = this.getRoom(room);

			if (!roomData) {
				this.setRoomData(room);
			}
			this.getRoom(room).setSessions(sessions);
		}

		clearRoomSessions (room: string): void {
			this.setRoomData(room);
		}

		setRoomSessionAtIndex (room: string, index: number, session: Session.SessionData): void {
			this.getRoomSessions(room)[index] = session;
		}

		getRoomSessionAtIndex (room: string, index: number): Session.SessionData {
			let rooms = this.getRoomSessions(room);

			if (rooms && rooms.length > index) {
				return rooms[index];
			}

			return null;
		}

	}

}
