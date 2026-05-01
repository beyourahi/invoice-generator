import { zipSync } from "fflate";
import type { GeneratedInvoice } from "$lib/types";

export const buildClientZip = async (
	invoices: GeneratedInvoice[],
	folderName: string
): Promise<Blob> => {
	const files: Record<string, Uint8Array> = {};

	await Promise.all(
		invoices.map(async (invoice) => {
			const path = `${folderName}/${invoice.fileName}`;
			const arrayBuffer = await invoice.pdfBlob.arrayBuffer();
			files[path] = new Uint8Array(arrayBuffer);
		})
	);

	const zipped = zipSync(files, { level: 0 });
	return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" });
};
