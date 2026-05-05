import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

interface LinkAnnotation {
	x: number;
	y: number;
	w: number;
	h: number;
	url: string;
}

const extractLinks = (doc: Document): LinkAnnotation[] =>
	Array.from(doc.querySelectorAll("[data-href]")).flatMap((el) => {
		const url = (el as HTMLElement).dataset.href?.trim() ?? "";
		if (!url) return [];
		const rect = el.getBoundingClientRect();
		return [
			{
				x: (rect.left / A4_WIDTH_PX) * A4_WIDTH_MM,
				y: (rect.top / A4_HEIGHT_PX) * A4_HEIGHT_MM,
				w: (rect.width / A4_WIDTH_PX) * A4_WIDTH_MM,
				h: (rect.height / A4_HEIGHT_PX) * A4_HEIGHT_MM,
				url
			}
		];
	});

export const generatePdf = async (html: string): Promise<Blob> => {
	const iframe = document.createElement("iframe");
	iframe.style.cssText = [
		"position: fixed",
		"top: -9999px",
		"left: -9999px",
		`width: ${A4_WIDTH_PX}px`,
		`height: ${A4_HEIGHT_PX}px`,
		"border: none",
		"z-index: -1",
		"visibility: hidden"
	].join("; ");

	document.body.appendChild(iframe);

	await new Promise<void>((resolve, reject) => {
		iframe.addEventListener("load", () => resolve(), { once: true });
		iframe.addEventListener("error", () => reject(new Error("iframe load failed")), {
			once: true
		});
		iframe.setAttribute("srcdoc", html);
	});

	const iframeDoc = iframe.contentDocument;
	if (!iframeDoc) throw new Error("iframe document unavailable");

	await iframeDoc.fonts.ready;
	await waitForFrame();

	const linkAnnotations = extractLinks(iframeDoc);

	const canvas = await html2canvas(iframeDoc.body, {
		scale: 2,
		useCORS: true,
		allowTaint: false,
		logging: false,
		width: A4_WIDTH_PX,
		height: A4_HEIGHT_PX,
		windowWidth: A4_WIDTH_PX,
		windowHeight: A4_HEIGHT_PX
	});

	document.body.removeChild(iframe);

	const pdf = new jsPDF({
		orientation: "portrait",
		unit: "mm",
		format: "a4"
	});

	pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, 210, 297);

	for (const { x, y, w, h, url } of linkAnnotations) {
		pdf.link(x, y, w, h, { url });
	}

	return pdf.output("blob");
};
