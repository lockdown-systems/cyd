import { ref } from 'vue';
import { mount } from '@cypress/vue';

import LoginView from './LoginView.vue'
import ServerAPI from '../ServerAPI';

describe('<LoginView />', () => {
  // beforeEach(() => {
  //   cy.window().then((win) => {
  //     (win as any).electron = {
  //       getApiUrl: () => 'https://mock/api/v1'
  //     }
  //   });
  // });

  it('starts with the email field visible and the value blank', () => {
    mount(LoginView);

    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="email"]').should('have.value', '');
  })

  it('prepopulates the email field if it is saved', () => {
    const testEmail = 'test@lockdown.systems';

    mount(LoginView, {
      global: {
        plugins: [(app) => {
          app.provide('userEmail', ref(testEmail));
        }]
      }
    });

    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="email"]').should('have.value', testEmail);
  })

  it('shows an error message if the email field is blank', () => {
    const showError = cy.stub();

    mount(LoginView, {
      global: {
        plugins: [(app) => {
          app.provide('userEmail', '');
          app.provide('showError', showError);
        }]
      }
    });

    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="email"]').should('have.value', '');
    cy.get('button').click();
    cy.wrap(showError).should('be.calledWith', 'Please enter your email address.');
  })

  it('shows an error message if the server is unreachable', () => {
    const testEmail = 'test@lockdown.systems';
    const showError = cy.stub();

    mount(LoginView, {
      global: {
        plugins: [(app) => {
          app.provide('serverApi', ref(new ServerAPI()));
          app.provide('userEmail', ref(testEmail));
          app.provide('showError', showError);
        }]
      }
    });

    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="email"]').should('have.value', testEmail);
    cy.get('button').click();

    // Make sure the email field and start-continue button are disabled
    cy.get('input[type="email"]').should('be.disabled');
    cy.get('button').should('be.disabled');

    // An error should be shown
    cy.wrap(showError).should('be.called');
  })
});