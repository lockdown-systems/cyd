import i18n from "./index";

export type TranslatorParams = Record<string, string | number>;
export type TranslatorFn = (key: string, params?: TranslatorParams) => string;

export const translate: TranslatorFn = (key, params = {}) => {
  return i18n.global.t(key, params) as string;
};

export const getTranslator = (): TranslatorFn => translate;
