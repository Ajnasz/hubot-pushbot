module util {
	interface TesterFunc {
		<T>(param: T): boolean;
	}

	export function findIndex<T>(array: T[], test: TesterFunc) {
		let index = -1;
		for (let i = 0, rl = array.length; i < rl; i++) {
			if (test(array[i])) {
				index = i;
				break;
			}
		}

		return index;
	}

	export function invoke(method) {
		return (obj) => {
			return obj[method]();
		}
	}


}
