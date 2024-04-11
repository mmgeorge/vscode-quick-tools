export function pad(str: string): string {
  // Simply calling pad does not seem to position correclty in the pick list...
  if (str.length === 1) {
    str += "        ";
  }

  if (str.length === 2) {
    str += "      ";
  }

  if (str.length === 3) {
    str += "    ";
  }

  if (str.length === 4) {
    str += "   ";
  }

  return str;
}