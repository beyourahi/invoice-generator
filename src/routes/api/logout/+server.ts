import { json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete("invoice-generator.session_token", { path: "/" });
	return json({ success: true });
};

export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete("invoice-generator.session_token", { path: "/" });
	redirect(303, "/login");
};
