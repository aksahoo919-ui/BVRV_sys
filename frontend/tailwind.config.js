/** @type {import('tailwindcss').Config} */

// ── ISKCON Abids — Sri Sri Radha Madanmohan Mandir ────────────────────────
// Colours sampled from the temple itself: the deep green embroidered altar
// backdrop behind Sri Sri Radha Madanmohan, the gold of the carved altar
// canopy, Their Lordships' golden-yellow silk, and the pale marble of the
// mandir hall and its cusped-arch stonework.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Altar green. `primary` is aliased to this so every existing
        // primary-* utility in the app picks up the temple colour at once.
        temple: {
          50:  '#F1F7F4',
          100: '#DCEBE4',
          200: '#B6D4C6',
          300: '#83B6A0',
          400: '#4E9277',
          500: '#2A7458',
          600: '#1B5C45',
          700: '#124A36',
          800: '#0B3B2E',
          900: '#06332A',
          950: '#042019',
        },
        primary: { 50:"#F1F7F4",100:"#DCEBE4",200:"#B6D4C6",300:"#83B6A0",400:"#4E9277",500:"#2A7458",600:"#1B5C45",700:"#124A36",800:"#0B3B2E",900:"#06332A",950:"#042019" },

        // Carved altar canopy + Their Lordships' silk.
        gold: {
          50:  '#FDF9EF',
          100: '#FAF0D7',
          200: '#F3DFA8',
          300: '#E9C86F',
          400: '#E0B750',
          500: '#C8992E',
          600: '#A87B22',
          700: '#855E1C',
          800: '#6A4A1A',
          900: '#573D19',
        },
        // Mandir marble.
        ivory: {
          50:  '#FDFBF6',
          100: '#FAF7F0',
          200: '#F3EDE1',
          300: '#E7DECB',
          400: '#D6C9AE',
        },
        // Jagannath altar red — reserved for alerts/absent, used sparingly.
        kumkum: '#C1272D',
      },
      fontFamily: {
        // Display face for the temple lockup only; UI stays on the system stack.
        temple: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        altar: '0 1px 2px rgba(6,51,42,0.06), 0 8px 24px -12px rgba(6,51,42,0.18)',
      },
    },
  },
  plugins: [],
};

// `primary` is kept as an alias so the ~600 existing primary-* class usages
// across the app re-tint to the temple green without touching every page.
