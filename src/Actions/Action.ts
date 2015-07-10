interface Action {
	requireLeader(): boolean;
	requireMembership(): boolean;
	requireAllUserGood(): boolean;
}
