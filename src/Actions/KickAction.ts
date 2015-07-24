/// <reference path="Action.ts" />

class KickAction implements Action {
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
