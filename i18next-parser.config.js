export default {
  locales: ['en', 'de'], // The languages we want
  output: 'src/locales/$LOCALE.json', // Where to save the files
  input: ['src/**/*.{js,jsx}'], // Where to look for t() functions
  createOldCatalogs: false,
  keySeparator: false, // Allows us to use full English sentences as keys
  namespaceSeparator: false,
  useKeysAsDefaultValue: true, // Makes the English file use the exact words you typed
};