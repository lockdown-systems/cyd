import { ref } from 'vue';
import { mount } from '@cypress/vue';

import LoginView from './LoginView.vue'
import ServerAPI from '../ServerAPI';

describe('<LoginView />', () => {
  it('starts with the email field visible and the value blank', () => {
    mount(LoginView);

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', '');
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

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', testEmail);
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

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', '');
    cy.vueRef('startContinueButtonEl').click();
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

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', testEmail);
    cy.vueRef('startContinueButtonEl').click();

    // An error should be shown
    cy.wrap(showError).should('be.called');
  })

  it('moves to verification code page after entering an email', () => {
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

    cy.window().then((win) => {
      (win as any).electron = {
        getApiUrl: () => 'https://mock/api/v1'
      }
    });

    cy.intercept('POST', 'https://mock/api/v1/authenticate', {
      statusCode: 200,
      body: {
        message: 'Verification code sent to email'
      }
    });

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', testEmail);
    cy.vueRef('startContinueButtonEl').click();

    cy.wrap(showError).should('not.be.called');
  })

  // it('should only allow 6 digits in the verification code field', () => {

  // it('should show an error on wrong verification code guess but let you keep guessing', () => {

  // it('verification code back button should go back to start', () => {

  // it('should redirect to dashboard on successful verification code', () => {

  // it('should automatically redirect to dashboard when a device is saved', () => {
});