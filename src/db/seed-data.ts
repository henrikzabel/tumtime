/**
 * Reference data: TUM schools and the module-number prefixes of their departments / subject areas.
 * Module → department assignment is derived from the module number prefix (see resolveDepartment).
 */
export type SeedDepartment = { code: string; nameEn: string; nameDe?: string; modulePrefixes: string[] };
export type SeedSchool = { code: string; nameEn: string; nameDe?: string; departments: SeedDepartment[] };

export const seedSchools: SeedSchool[] = [
  {
    code: "CIT",
    nameEn: "School of Computation, Information and Technology",
    departments: [
      { code: "IN", nameEn: "Computer Science", nameDe: "Informatik", modulePrefixes: ["IN"] },
      { code: "MA", nameEn: "Mathematics", nameDe: "Mathematik", modulePrefixes: ["MA"] },
      {
        code: "EI",
        nameEn: "Electrical and Computer Engineering",
        nameDe: "Elektrotechnik und Informationstechnik",
        modulePrefixes: ["EI"],
      },
      { code: "CIT", nameEn: "CIT school-wide", modulePrefixes: ["CIT"] },
    ],
  },
  {
    code: "ED",
    nameEn: "School of Engineering and Design",
    departments: [
      { code: "MW", nameEn: "Mechanical Engineering", nameDe: "Maschinenwesen", modulePrefixes: ["MW"] },
      {
        code: "BV",
        nameEn: "Civil and Environmental Engineering",
        nameDe: "Bau- und Umweltingenieurwesen",
        modulePrefixes: ["BV", "BGU"],
      },
      {
        code: "ASG",
        nameEn: "Aerospace and Geodesy",
        nameDe: "Luftfahrt, Raumfahrt und Geodäsie",
        modulePrefixes: ["ASG", "LRG", "LR"],
      },
    ],
  },
  {
    code: "LS",
    nameEn: "School of Life Sciences",
    departments: [{ code: "WZ", nameEn: "Life Sciences", modulePrefixes: ["WZ"] }],
  },
  {
    code: "MED",
    nameEn: "School of Medicine and Health",
    departments: [{ code: "ME", nameEn: "Medicine", nameDe: "Medizin", modulePrefixes: ["ME", "MH"] }],
  },
  {
    code: "MGT",
    nameEn: "School of Management",
    departments: [
      { code: "WI", nameEn: "Management", nameDe: "Wirtschaftswissenschaften", modulePrefixes: ["WI"] },
      { code: "MGT", nameEn: "MGT school-wide", modulePrefixes: ["MGT"] },
    ],
  },
  {
    code: "NAT",
    nameEn: "School of Natural Sciences",
    departments: [
      { code: "PH", nameEn: "Physics", nameDe: "Physik", modulePrefixes: ["PH"] },
      { code: "CH", nameEn: "Chemistry", nameDe: "Chemie", modulePrefixes: ["CH"] },
    ],
  },
  {
    code: "SOT",
    nameEn: "School of Social Sciences and Technology",
    departments: [
      { code: "ED", nameEn: "Educational Sciences", nameDe: "Bildungswissenschaften", modulePrefixes: ["ED"] },
      { code: "POL", nameEn: "Science, Technology and Society", modulePrefixes: ["POL", "MCTS"] },
      { code: "CLA", nameEn: "Carl von Linde Academy", modulePrefixes: ["CLA"] },
      { code: "SOT", nameEn: "SOT school-wide", modulePrefixes: ["SOT"] },
    ],
  },
  {
    code: "SZ",
    nameEn: "Language Center",
    nameDe: "Sprachenzentrum",
    departments: [{ code: "SZ", nameEn: "Language Center", nameDe: "Sprachenzentrum", modulePrefixes: ["SZ"] }],
  },
];
