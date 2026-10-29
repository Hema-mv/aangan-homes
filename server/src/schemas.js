import { z } from "zod";

export const TYPES = ["Apartment", "Villa", "Independent House", "Plot"];
export const POSSESSION = ["Ready to move", "Under construction · Dec 2027", "Available now"];
export const VISITS = ["This weekend", "Weekday evening", "Video walkthrough"];

const blankToUndef = (s) => (s === "" ? undefined : s);
const opt = (schema) => z.preprocess(blankToUndef, schema.optional());
const csv = (item, max) => z.preprocess(
  (s) => (typeof s === "string" && s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined),
  z.array(item).max(max).optional(),
);

/** Indian mobile: 10 digits starting 6-9, optional +91 / 0 prefix. Normalised to "+91 98765 43210". */
export const phone = z.string().trim().transform((s, ctx) => {
  const d = s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(d)) {
    ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9." });
    return z.NEVER;
  }
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
});

export const listingQuery = z.object({
  deal: opt(z.enum(["buy", "rent"])),
  city: opt(z.string().max(40)),
  q: opt(z.string().trim().max(60)),
  type: opt(z.enum(TYPES)),
  maxPrice: opt(z.coerce.number().int().positive()),
  status: opt(z.enum(["ready", "uc"])),
  sort: opt(z.enum(["new", "lo", "hi", "psf", "deal"])),
  bhk: csv(z.enum(["1", "2", "3", "4+"]), 4),
  ids: csv(z.string().regex(/^[\w-]{1,40}$/), 50),
});

export const newListing = z.object({
  deal: z.enum(["buy", "rent"]),
  city: z.string().max(40),
  // Free text: an existing locality is matched case-insensitively, otherwise a new one is created.
  locality: z.string().trim().transform((s) => s.replace(/\s+/g, " "))
    .pipe(z.string()
      .min(2, "Enter a locality")
      .max(40, "Keep the locality under 40 characters")
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} .,'&()-]*$/u, "Use letters, numbers, spaces and . , ' & ( ) - only")),
  type: z.enum(TYPES, "Choose a property type"),
  bhk: z.coerce.number().int().min(0).max(10, "Up to 10 BHK"),
  area: z.coerce.number("Enter the area in sq ft").int("Use a whole number of sq ft")
    .min(100, "Area must be at least 100 sq ft").max(100_000, "Area must be under 1,00,000 sq ft"),
  price: z.coerce.number("Enter a price").int("Use a whole number of rupees")
    .min(1000, "Enter a price of at least ₹1,000").max(10_000_000_000, "That price looks too high"),
  title: z.string().trim().min(5, "Headline needs at least 5 characters").max(70, "Keep the headline under 70 characters"),
  possession: z.enum(POSSESSION, "Choose when it's available"),
  agent: z.string().trim().min(2, "Enter the agent's name").max(60, "Keep the name under 60 characters"),
  phone,
}).transform((l) => (l.type === "Plot" ? { ...l, bhk: 0 } : l));

export const newEnquiry = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60, "Keep the name under 60 characters"),
  phone,
  visit: z.enum(VISITS, "Choose a visit option"),
  message: z.string().trim().max(500, "Keep the message under 500 characters").default(""),
});

/** Turns a ZodError into { field: message } for the client to show next to inputs. */
export function fieldErrors(err) {
  const out = {};
  for (const i of err.issues) out[i.path.join(".") || "_"] ??= i.message;
  return out;
}
