export const DURATION = {
	fast: 0.15,
	base: 0.25,
	slow: 0.35
} as const;

export const DURATION_MS = {
	fast: 150,
	base: 250,
	slow: 350
} as const;

export const EASE = {
	standard: "power2.out",
	emphasized: "power3.inOut",
	decelerate: "expo.out"
} as const;

export const STAGGER = {
	tight: 0.04,
	base: 0.06,
	loose: 0.09
} as const;

export const DISTANCE = {
	sm: 8,
	md: 16
} as const;

export type DurationToken = keyof typeof DURATION;
export type EaseToken = keyof typeof EASE;
export type StaggerToken = keyof typeof STAGGER;
export type DistanceToken = keyof typeof DISTANCE;
