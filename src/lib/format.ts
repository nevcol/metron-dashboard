import type { Gender } from "../types";

const REFERENCE_DATE = new Date("2026-06-21");

export function ageOn(birthDate: string, on: Date = REFERENCE_DATE): number {
  const b = new Date(birthDate);
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export function yearsBetween(from: string, to: Date = REFERENCE_DATE): number {
  const f = new Date(from);
  return (to.getTime() - f.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/** Five-year age band label, e.g. "15-19". */
export function ageBand(age: number): string {
  const lo = Math.floor(age / 5) * 5;
  return `${lo}-${lo + 4}`;
}

export function genderLabel(g: Gender): string {
  return g === "M" ? "Men" : "Women";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
