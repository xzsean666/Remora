/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: "#1e1e1e",
          sidebar: "#252526",
          activityBar: "#333333",
          activityBarActive: "#007acc",
          editorGroupHeader: "#2d2d2d",
          tabActive: "#1e1e1e",
          tabInactive: "#2d2d2d",
          statusBar: "#007acc",
          statusBarOffline: "#6c1717",
          border: "#3c3c3c",
          hover: "#2a2d2e",
          selected: "#094771",
          terminal: "#181818",
          text: "#cccccc",
          textBright: "#ffffff",
          textMuted: "#858585"
        }
      }
    },
  },
  plugins: [],
}
