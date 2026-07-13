export async function execute(command: string, alpine = true): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const terminal: { Executor: Executor } = acode.require('terminal') as any;
  try {
    return await terminal.Executor.execute(command, alpine);
  } catch (err: unknown) {
    const originalMessage = err instanceof Error ? err.message : String(err);
    const output = typeof (err as Record<string, unknown>)?.output === 'string'
      ? (err as Record<string, unknown>).output as string
      : '';
    if (output) {
      throw new Error(`Command failed: ${originalMessage}\nOutput: ${output}`);
    }
    throw new Error(`Command failed: ${originalMessage}`);
  }
}
