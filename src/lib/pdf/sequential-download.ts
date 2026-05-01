import type { GeneratedInvoice } from "$lib/types";
import { downloadBlob } from "$lib/utils";

export interface DownloadGroup {
	folderName: string;
	invoices: GeneratedInvoice[];
}

export interface DownloadResult {
	usedDirectoryPicker: boolean;
	fileCount: number;
}

interface DirectoryPickerWindow {
	showDirectoryPicker: (options?: {
		mode?: "read" | "readwrite";
	}) => Promise<FileSystemDirectoryHandle>;
}

const DOWNLOAD_DELAY_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const supportsDirectoryPicker = (): boolean =>
	typeof window !== "undefined" &&
	typeof (window as unknown as Partial<DirectoryPickerWindow>).showDirectoryPicker === "function";

const writeFile = async (
	dirHandle: FileSystemDirectoryHandle,
	fileName: string,
	blob: Blob
): Promise<void> => {
	const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(blob);
	await writable.close();
};

const writeViaDirectoryPicker = async (groups: DownloadGroup[]): Promise<void> => {
	const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker;
	const root = await picker({ mode: "readwrite" });

	for (const group of groups) {
		if (group.invoices.length === 0) continue;

		if (group.invoices.length === 1) {
			const [invoice] = group.invoices;
			await writeFile(root, invoice.fileName, invoice.pdfBlob);
			continue;
		}

		const folder = await root.getDirectoryHandle(group.folderName, { create: true });
		for (const invoice of group.invoices) {
			await writeFile(folder, invoice.fileName, invoice.pdfBlob);
		}
	}
};

const triggerSequentialDownloads = async (groups: DownloadGroup[]): Promise<void> => {
	const queue: GeneratedInvoice[] = [];
	for (const group of groups) {
		queue.push(...group.invoices);
	}

	for (let i = 0; i < queue.length; i++) {
		const invoice = queue[i];
		downloadBlob(invoice.pdfBlob, invoice.fileName);
		if (i < queue.length - 1) await sleep(DOWNLOAD_DELAY_MS);
	}
};

const countFiles = (groups: DownloadGroup[]): number =>
	groups.reduce((total, group) => total + group.invoices.length, 0);

export const downloadGroups = async (groups: DownloadGroup[]): Promise<DownloadResult> => {
	const fileCount = countFiles(groups);
	if (fileCount === 0) return { usedDirectoryPicker: false, fileCount: 0 };

	if (supportsDirectoryPicker()) {
		await writeViaDirectoryPicker(groups);
		return { usedDirectoryPicker: true, fileCount };
	}

	await triggerSequentialDownloads(groups);
	return { usedDirectoryPicker: false, fileCount };
};

export const isUserAbort = (err: unknown): boolean =>
	err instanceof DOMException && (err.name === "AbortError" || err.name === "NotAllowedError");
