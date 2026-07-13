export async function execute(command: string, alpine = true): Promise<string> {
  try {
    return await Executor.execute(command, alpine);
  } catch (err: unknown) {
    console.log(err);
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
