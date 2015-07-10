/// <reference path="Action.ts" />

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
