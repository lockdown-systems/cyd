/// <reference types="cypress" />

declare namespace Cypress {
    interface Chainable<Subject> {
        vueRef: (refName: string) => Chainable<JQuery<HTMLElement>>;
    }
}