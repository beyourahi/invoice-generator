export interface MdText {
	type: "text";
	value: string;
}

export interface MdBold {
	type: "bold";
	value: string;
}

export interface MdItalic {
	type: "italic";
	value: string;
}

export interface MdCode {
	type: "code";
	value: string;
}

export interface MdLink {
	type: "link";
	href: string;
	label: string;
}

export type MdInline = MdText | MdBold | MdItalic | MdCode | MdLink;

export interface MdParagraph {
	type: "paragraph";
	lines: MdInline[][];
}

export interface MdHeading {
	type: "heading";
	nodes: MdInline[];
}

export interface MdList {
	type: "list";
	ordered: boolean;
	items: MdInline[][];
}

export interface MdCodeBlock {
	type: "codeblock";
	value: string;
}

export type MdBlock = MdParagraph | MdHeading | MdList | MdCodeBlock;

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;

const pushText = (nodes: MdInline[], text: string): void => {
	if (!text) return;
	let last = 0;
	for (const match of text.matchAll(URL_RE)) {
		const start = match.index ?? 0;
		if (start > last) nodes.push({ type: "text", value: text.slice(last, start) });
		nodes.push({ type: "link", href: match[0], label: match[0] });
		last = start + match[0].length;
	}
	if (last < text.length) nodes.push({ type: "text", value: text.slice(last) });
};

const parseInline = (raw: string): MdInline[] => {
	const nodes: MdInline[] = [];
	let buffer = "";
	let i = 0;

	const flush = () => {
		pushText(nodes, buffer);
		buffer = "";
	};

	while (i < raw.length) {
		if (raw[i] === "`") {
			const end = raw.indexOf("`", i + 1);
			if (end > i) {
				flush();
				nodes.push({ type: "code", value: raw.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}

		if (raw[i] === "*" && raw[i + 1] === "*") {
			const end = raw.indexOf("**", i + 2);
			if (end > i + 1) {
				flush();
				nodes.push({ type: "bold", value: raw.slice(i + 2, end) });
				i = end + 2;
				continue;
			}
		}

		if (raw[i] === "*" && raw[i + 1] !== "*" && raw[i + 1] !== " " && raw[i + 1] !== undefined) {
			const end = raw.indexOf("*", i + 1);
			if (end > i + 1 && raw[end - 1] !== " ") {
				flush();
				nodes.push({ type: "italic", value: raw.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}

		if (raw[i] === "[") {
			const close = raw.indexOf("]", i + 1);
			if (close > i && raw[close + 1] === "(") {
				const hrefEnd = raw.indexOf(")", close + 2);
				if (hrefEnd > close) {
					flush();
					nodes.push({
						type: "link",
						label: raw.slice(i + 1, close),
						href: raw.slice(close + 2, hrefEnd)
					});
					i = hrefEnd + 1;
					continue;
				}
			}
		}

		buffer += raw[i];
		i++;
	}

	flush();
	return nodes;
};

const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const ORDERED_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^\s*#{1,6}\s+(.*)$/;
const FENCE_RE = /^\s*```/;

export const parseMarkdown = (raw: string): MdBlock[] => {
	const blocks: MdBlock[] = [];
	const lines = raw.replace(/\r\n/g, "\n").split("\n");
	let para: MdInline[][] = [];
	let i = 0;

	const flushPara = () => {
		if (para.length) {
			blocks.push({ type: "paragraph", lines: para });
			para = [];
		}
	};

	while (i < lines.length) {
		const line = lines[i];

		if (FENCE_RE.test(line)) {
			flushPara();
			const body: string[] = [];
			i++;
			while (i < lines.length && !FENCE_RE.test(lines[i])) {
				body.push(lines[i]);
				i++;
			}
			i++;
			blocks.push({ type: "codeblock", value: body.join("\n") });
			continue;
		}

		if (line.trim() === "") {
			flushPara();
			i++;
			continue;
		}

		const heading = line.match(HEADING_RE);
		if (heading) {
			flushPara();
			blocks.push({ type: "heading", nodes: parseInline(heading[1]) });
			i++;
			continue;
		}

		if (BULLET_RE.test(line)) {
			flushPara();
			const items: MdInline[][] = [];
			while (i < lines.length) {
				const match = lines[i].match(BULLET_RE);
				if (!match) break;
				items.push(parseInline(match[1]));
				i++;
			}
			blocks.push({ type: "list", ordered: false, items });
			continue;
		}

		if (ORDERED_RE.test(line)) {
			flushPara();
			const items: MdInline[][] = [];
			while (i < lines.length) {
				const match = lines[i].match(ORDERED_RE);
				if (!match) break;
				items.push(parseInline(match[1]));
				i++;
			}
			blocks.push({ type: "list", ordered: true, items });
			continue;
		}

		para.push(parseInline(line));
		i++;
	}

	flushPara();
	return blocks;
};
