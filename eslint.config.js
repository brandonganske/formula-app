// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/*"],
    rules: {
      // Literal quotes/apostrophes in JSX text render fine in React Native;
      // this rule is web-HTML hygiene, not a real bug for us.
      "react/no-unescaped-entities": "off",
    },
  }
]);
