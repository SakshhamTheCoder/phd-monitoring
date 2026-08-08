/** @type {import('tailwindcss').Config} */
module.exports = {
	prefix: "tw-",
	content: ["./src/**/*.{js,jsx,ts,tsx}"],
	theme: {
		// Named so Tailwind classes read the same tokens as the stylesheets.
		// Use tw-bg-brand, not tw-bg-[#932f2f].
		extend: {
			colors: {
				brand: {
					DEFAULT: "var(--primary-color)",
					hover: "var(--hover-color)",
				},
			},
		},
	},
	plugins: [],
};
