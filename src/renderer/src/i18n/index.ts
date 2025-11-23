/**
 * Vue I18n configuration for Cyd
 */

import { createI18n } from "vue-i18n";
import en from "./locales/en.json";

export type SupportedLocale = "en";

const messages = {
    en,
};

const i18n = createI18n({
    locale: "en", // default locale
    fallbackLocale: "en",
    messages,
    legacy: false, // Use Composition API mode
    globalInjection: true, // Enable global $t function
});

export default i18n;
