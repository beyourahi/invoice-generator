import { zipSync, type Zippable } from "fflate";
import { countFiles, INVOICES_ROOT_FOLDER, type DownloadGroup } from "$lib/pdf/sequential-download";
import { downloadBlob } from "$lib/utils";

const ZIP_FILE_NAME = "invoices.zip";

const blobToBytes = async (blob: Blob): Promise<Uint8Array> =>
	new Uint8Array(await blob.arrayBuffer());

const buildZippable = async (groups: DownloadGroup[]): Promise<Zippable> => {
	const root: Zippable = {};

	for (const group of groups) {
		if (group.invoices.length === 0) continue;

		if (group.invoices.length === 1) {
			const [invoice] = group.invoices;
			root[invoice.fileName] = await blobToBytes(invoice.pdfBlob);
			continue;
		}

		const folder: Zippable = {};
		for (const invoice of group.invoices) {
			folder[invoice.fileName] = await blobToBytes(invoice.pdfBlob);
		}
		root[group.folderName] = folder;
	}

	return { [INVOICES_ROOT_FOLDER]: root };
};

export interface ZipDownloadResult {
	fileCount: number;
	zipFileName: string;
}

export const downloadInvoicesZip = async (groups: DownloadGroup[]): Promise<ZipDownloadResult> => {
	const fileCount = countFiles(groups);
	if (fileCount === 0) return { fileCount: 0, zipFileName: ZIP_FILE_NAME };

	const zippable = await buildZippable(groups);
	const zipped = zipSync(zippable, { level: 0 });
	const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
	downloadBlob(blob, ZIP_FILE_NAME);

	return { fileCount, zipFileName: ZIP_FILE_NAME };
};
