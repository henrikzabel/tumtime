export type PrefixedDepartment = { id: number; schoolId: number; modulePrefixes: string[] };

/**
 * Find the department of a module by its number, using the longest matching prefix that is
 * directly followed by a digit (so "MA" does not swallow "MAxxxx"-like codes of other prefixes
 * and "CIT5230000" resolves to "CIT", not "C…").
 */
export function resolveDepartment<T extends PrefixedDepartment>(moduleCode: string, departments: T[]): T | undefined {
  const code = moduleCode.toUpperCase();
  let best: { dept: T; len: number } | undefined;
  for (const dept of departments) {
    for (const prefix of dept.modulePrefixes) {
      const p = prefix.toUpperCase();
      if (code.startsWith(p) && /\d/.test(code.charAt(p.length)) && (!best || p.length > best.len)) {
        best = { dept, len: p.length };
      }
    }
  }
  return best?.dept;
}
