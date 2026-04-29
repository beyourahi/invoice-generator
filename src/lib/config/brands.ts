export interface Brand {
	name: string;
	emails: string[];
}

export const BRANDS: Brand[] = [{ name: "Rahi Khan", emails: ["beyourahi@gmail.com"] }];

export const allowedEmails: string[] = BRANDS.flatMap((b) => b.emails);

export const findBrandByEmail = (email: string): Brand | undefined =>
	BRANDS.find((b) => b.emails.includes(email));
