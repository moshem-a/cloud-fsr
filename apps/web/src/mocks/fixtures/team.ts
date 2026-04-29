import type { TeamMember } from "@scoach/types";

export const TEAM: TeamMember[] = [
  { uid: "u-noa", name: "Noa Levi", role: "Sr. Cloud SE", initials: "NL", color: "#1A73E8", email: "noalevi@google.com" },
  { uid: "u-tomer", name: "Tomer Avraham", role: "Sales Manager", initials: "TA", color: "#EA4335", email: "tavraham@google.com" },
  { uid: "u-maya", name: "Maya Stern", role: "Customer Engineer", initials: "MS", color: "#34A853", email: "mstern@google.com" },
  { uid: "u-eitan", name: "Eitan Shapira", role: "AE — Fintech", initials: "ES", color: "#F9AB00", email: "eitans@google.com" },
  { uid: "u-lior", name: "Lior Aviv", role: "Solutions Architect", initials: "LA", color: "#1A73E8", email: "lioraviv@google.com" },
  { uid: "u-yoni", name: "Yoni Karmeli", role: "SE Manager", initials: "YK", color: "#EA4335", email: "ykarmeli@google.com" },
  { uid: "u-daria", name: "Daria Kogan", role: "AE — Enterprise", initials: "DK", color: "#9B59B6", email: "dkogan@google.com" },
  { uid: "u-roi", name: "Roi Halfon", role: "Cloud SE", initials: "RH", color: "#34A853", email: "rhalfon@google.com" },
  { uid: "u-shir", name: "Shir Ben-Ari", role: "AE — Mid-market", initials: "SB", color: "#F9AB00", email: "shirba@google.com" },
  { uid: "u-idan", name: "Idan Peretz", role: "Solutions Architect", initials: "IP", color: "#1A73E8", email: "ipperetz@google.com" },
  { uid: "u-galia", name: "Galia Mor", role: "AE — Strategic", initials: "GM", color: "#EA4335", email: "galiamor@google.com" },
  { uid: "u-avi", name: "Avi Bar", role: "Customer Engineer", initials: "AB", color: "#9B59B6", email: "avibar@google.com" },
];

export const ME = TEAM[0]!; // Noa Levi
