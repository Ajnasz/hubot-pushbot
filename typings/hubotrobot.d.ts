declare type Callback = (msg: Msg) => void;

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

declare class Adapter {
	send(envelope: Object, ...string);
	emote(envelope: Object, ...string);
	reply(envelope: Object, ...string);
	topic(envelope: Object, ...string);
	play(envelope: Object, ...string);
}

declare class Robot {
	brain: HubotBrain;
	logger: Logger;
	hear(command: RegExp, callback: Callback): void;
	respond(command: RegExp, callback: Callback): void;
	adapter: Adapter;
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
	runWithMiddleware(m: string, options: Object, ...string);
	robot: Robot;
}
