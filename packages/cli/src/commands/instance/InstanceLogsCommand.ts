import { Command, CommandConfiguration, Input } from '../../cli'
import { resolveInstanceDockerConfig, resolveInstanceEnvironmentFromInput } from '../../utils/instance'
import { DockerCompose } from '../../utils/dockerCompose'

type Args = {
	instanceName: string
}

type Options = {}

export class InstanceLogsCommand extends Command<Args, Options> {
	protected configure(configuration: CommandConfiguration<Args, Options>): void {
		configuration.description('Show Contember instance logs')
		configuration.argument('instanceName').optional()
	}

	protected async execute(input: Input<Args, Options>): Promise<void> {
		const workspaceDirectory = process.cwd()
		const { instanceDirectory } = await resolveInstanceEnvironmentFromInput({ input, workspaceDirectory })
		const { composeConfig } = await resolveInstanceDockerConfig({ instanceDirectory })
		const dockerCompose = new DockerCompose(instanceDirectory, composeConfig)

		await dockerCompose.run(['logs', '-f']).output
	}
}
