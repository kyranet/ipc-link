const hasKey = Object.prototype.hasOwnProperty;

class Util {

	static mergeDefault(defaults, given) {
		for (const key of Object.keys(defaults)) {
			if (!hasKey(given, key)) given[key] = Util.cloneValue(defaults[key]);
		}
	}

	static cloneValue(value) {
		if (typeof value !== 'object' || value === null) return value;
		if (Array.isArray(value)) return value.map(Util.cloneValue);
		if (value instanceof Set) return new value.constructor([...value].map(Util.cloneValue));
		if (value instanceof Map) return new value.constructor([...value].map(Util.cloneValue));
		if (value.constructor === Object) {
			const output = {};
			for (const key of Object.keys(value)) {
				output[key] = Util.cloneValue(value[key]);
			}
			return output;
		}
		return value;
	}

}

module.exports = Util;
