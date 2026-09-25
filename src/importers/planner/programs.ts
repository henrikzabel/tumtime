/** Degree programs supported by the planner. Add a program here and re-run `npm run import:planner`. */
export type ProgramConfig = {
  studyId: string; // TUMonline study id (see NAT API /programs/search)
  slug: string;
  nameDe: string;
  nameEn: string;
  degree: string;
  schoolCode: string;
  studyPlanUrl: string;
};

export const PROGRAMS: ProgramConfig[] = [
  {
    studyId: "163017030",
    slug: "bsc-informatics",
    nameDe: "Informatik",
    nameEn: "Informatics",
    degree: "B.Sc.",
    schoolCode: "CIT",
    studyPlanUrl: "https://www.cit.tum.de/cit/studium/studiengaenge/bachelor-informatik/studienplan/",
  },
  {
    studyId: "163017043",
    slug: "bsc-information-systems",
    nameDe: "Wirtschaftsinformatik",
    nameEn: "Information Systems",
    degree: "B.Sc.",
    schoolCode: "CIT",
    studyPlanUrl: "https://www.cit.tum.de/cit/studium/studiengaenge/bachelor-wirtschaftsinformatik/studienplaene/",
  },
];
