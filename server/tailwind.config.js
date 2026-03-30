/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f1e8',
        shell: '#fffdf8',
        ink: '#2f2418',
        muted: '#73614f',
        line: '#ded4c7',
        lineStrong: '#cfc1af',
        sage: '#6ba77d',
        amber: '#d5a24d',
        plum: '#9a88b7'
      },
      boxShadow: {
        shell: '0 16px 40px rgba(97, 74, 45, 0.08)'
      },
      borderRadius: {
        panel: '26px'
      }
    }
  },
  plugins: []
};
