export async function execute(command: string, alpine = true): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const terminal: { Executor: Executor } = acode.require('terminal') as any;
  return terminal.Executor.execute(command, alpine);
}
