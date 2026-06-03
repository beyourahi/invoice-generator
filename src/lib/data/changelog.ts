/**
 * Changelog data — hand-curated, customer-facing product update entries.
 *
 * Single source of truth for the public `/changelog` route. Each entry is
 * derived from real shipped work but rewritten in plain language for the person
 * who generates client invoices — no commit hashes, branch names, file paths,
 * or engineering jargon. Related commits are consolidated into one coherent
 * entry per theme.
 *
 * Ordering contract: this array IS the render order — newest first. The page
 * groups entries by `date` at render time and does not re-sort. When shipping a
 * new change, prepend its entry here in the same change.
 */

export type ChangelogCategory = "New feature" | "Improvement" | "Fix" | "Performance" | "Design";

export type ChangelogEntry = {
	/** ISO calendar date (YYYY-MM-DD) the change shipped. */
	date: string;
	/** Short, benefit-led, plain-language headline. */
	title: string;
	/** One to three plain-language sentences describing the change. */
	summary: string;
	category: ChangelogCategory;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
	{
		date: "2026-06-03",
		title: "More reliable invoice cards",
		summary:
			"Fixed a rare glitch where a client or payment card could briefly render twice. Cards now stay stable no matter how much detail you add.",
		category: "Fix"
	},
	{
		date: "2026-06-02",
		title: "The Copilot can now read images you share",
		summary:
			"Attach a screenshot or photo to your message and the AI Copilot can understand it — handy for copying client details straight from an image instead of retyping them.",
		category: "New feature"
	},
	{
		date: "2026-06-02",
		title: "Smarter, better-informed Copilot answers",
		summary:
			"The AI Copilot now draws on built-in knowledge of how the app works, so its answers and the actions it takes on your behalf are more accurate and consistent.",
		category: "Improvement"
	},
	{
		date: "2026-05-25",
		title: "A cleaner, calmer Copilot chat",
		summary:
			"The AI Copilot got a full visual refresh — a tidier history sidebar, clearer message bubbles, and more readable confirmation dialogs and settings, so managing your work by chat feels effortless.",
		category: "Design"
	},
	{
		date: "2026-05-24",
		title: "Tidier spacing on every screen size",
		summary:
			"Spacing and alignment were polished from phone to widescreen, so the app stays balanced and easy to scan whether you are on mobile or desktop. Client cards no longer overflow on small screens.",
		category: "Design"
	},
	{
		date: "2026-05-23",
		title: "Two-column sender details",
		summary:
			"Your own details now lay out in two neat columns, making the form quicker to fill in and easier to read at a glance.",
		category: "Improvement"
	},
	{
		date: "2026-05-23",
		title: "Preview width presets now resize the preview",
		summary:
			"Choosing a width preset above the invoice preview now actually resizes what you see, so you can check exactly how an invoice looks at different sizes.",
		category: "Fix"
	},
	{
		date: "2026-05-23",
		title: "Sensible default for new invoice dates",
		summary:
			"New invoice entries now start on a more useful default day of the month, so you spend less time adjusting dates by hand.",
		category: "Fix"
	},
	{
		date: "2026-05-22",
		title: "The whole app now moves with you",
		summary:
			"Sections gently reveal as they appear, tabs fade between views, and adding or removing clients and invoices animates smoothly. Everything still appears instantly if you prefer reduced motion.",
		category: "Design"
	},
	{
		date: "2026-05-21",
		title: "Manage everything by chat with the AI Copilot",
		summary:
			"A new AI Copilot lets you add clients, set up invoices, and configure payment methods just by typing what you want in plain language — no clicking through forms required.",
		category: "New feature"
	},
	{
		date: "2026-05-21",
		title: "Live invoice preview with a tabbed layout",
		summary:
			"The app now splits into Details and Preview tabs, with a live preview that updates as you type. Switch between preset widths or expand to fullscreen to inspect an invoice closely — and your choice is remembered next time.",
		category: "New feature"
	},
	{
		date: "2026-05-21",
		title: "A refreshed look and feel",
		summary:
			"The interface adopted a refreshed design system with more consistent colors, type, and spacing across every screen.",
		category: "Design"
	},
	{
		date: "2026-04-29",
		title: "A more polished, accessible interface",
		summary:
			"The app gained a consistent design system, clearer focus outlines for keyboard users, and toast notifications that confirm when things succeed or need your attention.",
		category: "Improvement"
	},
	{
		date: "2026-04-28",
		title: "Generate batches of invoices at once",
		summary:
			"The first release. Set your sender identity and payment methods once, add as many clients as you like — each with its own list of invoice months — and generate every PDF in one go. Built-in checks catch missing details before you generate.",
		category: "New feature"
	}
];
