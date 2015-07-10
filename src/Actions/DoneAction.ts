/// <reference path="Action.ts" />
class DoneAction implements Action {
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
