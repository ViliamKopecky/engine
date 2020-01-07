import { DataBindingError } from '../dao'

export function assertNever(_: never): never {
	throw new DataBindingError(
		`FATAL ERROR. This should absolutely never have happened. Yet, despite all efforts, here we are.` +
			`Please find solace in having a good laugh about the whole situation. ` +
			`You have just witnessed true harshness of software development. ` +
			`Please report this bug.`,
	)
}
