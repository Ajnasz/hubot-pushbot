module User {

	export enum UserState { Good, Uhoh, Waiting }

	export interface UserData {
		name: string;
		state: UserState;
	}

	export class User {
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

	export function createUser(userData: UserData) {
		return new User(userData);
	}

}
