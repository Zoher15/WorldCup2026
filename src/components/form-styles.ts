/** Shared Tailwind classes for the app's text inputs and their labels.
 *  (Tailwind v4 scans source for class names, so every class stays a complete
 *  static string inside these constants.) */

const inputBase =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-medium outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

/** Auth / group text inputs: pitch (green) focus accent. */
export const inputClasses = `${inputBase} text-base focus:border-pitch focus:ring-2 focus:ring-pitch/30`;

/** Admin inputs: same field, grape (purple) focus accent. */
export const inputClassesGrape = `${inputBase} focus:border-grape focus:ring-2 focus:ring-grape/30`;

export const labelClasses =
  "mb-1 block text-sm font-bold text-stone-600 dark:text-stone-200";
