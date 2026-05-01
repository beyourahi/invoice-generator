import type { GeneratedInvoice } from "$lib/types";
import { downloadBlob } from "$lib/utils";

export interface DownloadGroup {
	folderName: string;
	invoices: GeneratedInvoice[];
}

export interface DownloadResult {
	usedDirectoryPicker: boolean;
	fellBackToSequential: boolean;
	cancelled: boolean;
	fileCount: number;
}

type DirectoryPickerStartIn =
	| "desktop"
	| "documents"
	| "downloads"
	| "music"
	| "pictures"
	| "videos";

interface DirectoryPickerOptions {
	mode?: "read" | "readwrite";
	id?: string;
	startIn?: DirectoryPickerStartIn;
}

interface DirectoryPickerWindow {
	showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

const DOWNLOAD_DELAY_MS = 150;
const DIRECTORY_PICKER_ID = "invoice-generator-downloads";
const INVOICES_ROOT_FOLDER = "invoices";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const supportsDirectoryPicker = (): boolean =>
	typeof window !== "undefined" &&
	typeof (window as unknown as Partial<DirectoryPickerWindow>).showDirectoryPicker === "function";

const isAbortError = (err: unknown): boolean =>
	err instanceof DOMException && err.name === "AbortError";

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

const requestDirectory = async (): Promise<FileSystemDirectoryHandle> => {
	const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker;
	return picker({
		mode: "readwrite",
		id: DIRECTORY_PICKER_ID,
		startIn: "downloads"
	});
};

const writeGroupsToDirectory = async (
	root: FileSystemDirectoryHandle,
	groups: DownloadGroup[]
): Promise<void> => {
	const invoicesRoot = await root.getDirectoryHandle(INVOICES_ROOT_FOLDER, { create: true });

	for (const group of groups) {
		if (group.invoices.length === 0) continue;

		if (group.invoices.length === 1) {
			const [invoice] = group.invoices;
			await writeFile(invoicesRoot, invoice.fileName, invoice.pdfBlob);
			continue;
		}

		const folder = await invoicesRoot.getDirectoryHandle(group.folderName, { create: true });
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

const emptyResult = (fileCount: number): DownloadResult => ({
	usedDirectoryPicker: false,
	fellBackToSequential: false,
	cancelled: false,
	fileCount
});

export const downloadGroups = async (groups: DownloadGroup[]): Promise<DownloadResult> => {
	const fileCount = countFiles(groups);
	if (fileCount === 0) return emptyResult(0);

	if (!supportsDirectoryPicker()) {
		await triggerSequentialDownloads(groups);
		return { ...emptyResult(fileCount), fellBackToSequential: false };
	}

	let root: FileSystemDirectoryHandle;
	try {
		root = await requestDirectory();
	} catch (err) {
		if (isAbortError(err)) {
			return { ...emptyResult(fileCount), cancelled: true };
		}
		console.warn("Directory picker unavailable, falling back to sequential download.", err);
		await triggerSequentialDownloads(groups);
		return { ...emptyResult(fileCount), fellBackToSequential: true };
	}

	await writeGroupsToDirectory(root, groups);
	return { ...emptyResult(fileCount), usedDirectoryPicker: true };
};

export const isUserAbort = (err: unknown): boolean => isAbortError(err);
