export function resolveProjectPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorManager = acode.require('editorManager') as any;
    const activeFile = editorManager?.activeFile;

    if (!activeFile?.uri) {
      return null;
    }

    const path = String(activeFile.uri);

    if (path.startsWith('content://')) {
      return null;
    }

    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) {
      return null;
    }

    return path.substring(0, lastSlash);
  } catch {
    return null;
  }
}
