import { ref } from 'vue';

import Header from './Header.vue'

describe('<Header />', () => {
  it('should be hidden without userEmail and valid deviceInfo', () => {
    cy.mount(Header);
    cy.vueRef('headerEl').should('not.exist');
  })

  it('should be shown with userEmail and valid deviceInfo', () => {
    const testEmail = 'test@lockdown.systems';

    cy.mount(Header, {
      global: {
        plugins: [(app) => {
          app.provide('userEmail', ref(testEmail));
          app.provide('deviceInfo', {
            userEmail: testEmail,
            deviceDescription: "test device",
            deviceToken: "blah blah blah",
            apiToken: "bleh bleh bleh",
            valid: true
          });
        }]
      }
    });

    cy.vueRef('headerEl').should('be.visible');
  })
})