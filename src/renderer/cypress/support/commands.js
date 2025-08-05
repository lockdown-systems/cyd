Cypress.Commands.add("vueRef", (refName) => {
  cy.get(`[data-vue-ref="${refName}"]`);
});
