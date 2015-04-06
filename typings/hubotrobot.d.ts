declare class PushbotBrainData {
	pushbot: Object
}

declare class HubotBrain {
	on(name: string, callback: Function): void;
	data: PushbotBrainData
}


declare class Logger {
	error(...args: any[]): void;
	debug(...args: any[]): void;
}

declare class Robot {
	brain: HubotBrain;
	logger: Logger;
	hear(command: RegExp, callback: Function): void;
	respond(command: RegExp, callback: Function): void;
}

declare class MsgUser {
	name: string;
}

declare class MsgMessage {
	room: string;
	user: MsgUser;
}

declare class Msg {
	message: MsgMessage;
	match: string[];
	reply(m: string);
	send(m: string);
	topic(m: string);
}
