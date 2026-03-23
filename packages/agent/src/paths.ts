import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root: works from both src/ (tsx) and dist/src/ (compiled)
const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = __dir.includes(path.sep + 'dist' + path.sep)
  ? path.resolve(__dir, '..', '..')
  : path.resolve(__dir, '..');
