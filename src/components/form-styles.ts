/** Shared Tailwind classes for the app's text inputs and their labels.
 *  (Tailwind v4 scans source for class names, so every class stays a complete
 *  static string inside these constants.)
 *
 *  The app is dark-mode only (`@custom-variant dark (&)` in globals.css), so
 *  the fields are styled dark directly — no light/`dark:` pairs that could
 *  flash a white field if the variant ever failed to apply. */

const inputBase =
  "w-full rounded-xl border border-stone-600 bg-stone-800 px-4 py-3 font-medium text-stone-100 outline-none placeholder:text-stone-500";

/** Auth / group text inputs: pitch (green) focus accent. */
export const inputClasses = `${inputBase} text-base focus:border-pitch focus:ring-2 focus:ring-pitch/50`;

/** Admin inputs: same field, grape (purple) focus accent. */
export const inputClassesGrape = `${inputBase} focus:border-grape focus:ring-2 focus:ring-grape/50`;

export const labelClasses = "mb-1 block text-sm font-bold text-stone-200";
