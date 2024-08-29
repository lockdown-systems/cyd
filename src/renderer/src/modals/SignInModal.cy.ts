import { ref } from 'vue';

import SignInModal from './SignInModal.vue'
import ServerAPI from '../ServerAPI';

const stubElectron = () => {
  return {
    getAPIURL: async (): Promise<string> => { return 'https://mock/api' },
    isDevMode: cy.stub(),
    showError: cy.stub(),
    showQuestion: cy.stub(),
    database: {
      getConfig: cy.stub(),
      setConfig: cy.stub(),
      getAccounts: cy.stub(),
      createAccount: cy.stub(),
      selectAccountType: cy.stub(),
      saveAccount: cy.stub(),
      deleteAccount: cy.stub(),
    },
    X: {
      fetchStart: cy.stub(),
      fetchStop: cy.stub(),
      fetchParse: cy.stub(),
    }
  };
}

describe('<Login />', () => {
  it('starts with the email field visible and the value blank', () => {
    cy.mount(SignInModal);

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', '');
  })

  it('prepopulates the email field if it is saved', () => {
    const testEmail = 'test@lockdown.systems';

    cy.mount(SignInModal, {
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
    window.electron = stubElectron();

    cy.mount(SignInModal, {
      global: {
        plugins: [(app) => {
          app.provide('userEmail', '');
        }]
      }
    });

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', '');
    cy.vueRef('startContinueButtonEl').click();
    cy.wrap(window.electron.showError).should('be.calledWith', 'Please enter your email address.');
  })

  it('shows an error message if the server is unreachable', () => {
    window.electron = stubElectron();

    const testEmail = 'test@lockdown.systems';

    cy.mount(SignInModal, {
      global: {
        plugins: [(app) => {
          app.provide('serverApi', ref(new ServerAPI()));
          app.provide('userEmail', ref(testEmail));
        }]
      }
    });

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', testEmail);
    cy.vueRef('startContinueButtonEl').click();

    // An error should be shown
    cy.wrap(window.electron.showError).should('be.called');
  })

  it('moves to verification code page after entering an email', () => {
    const testEmail = 'test@lockdown.systems';

    cy.window().then(async (win) => {
      win.electron = stubElectron();

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(SignInModal, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
          }]
        }
      });

      cy.intercept('POST', 'https://mock/api/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('emailInputEl').should('be.visible');
      cy.vueRef('emailInputEl').should('have.value', testEmail);

      cy.vueRef('startContinueButtonEl').click();
      cy.wait(500);

      cy.wrap(window.electron.showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');
    });
  })

  it('should only allow digits in the verification code field', () => {
    window.electron = stubElectron();

    const testEmail = 'test@lockdown.systems';

    cy.window().then(async (win) => {
      win.electron = stubElectron();

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(SignInModal, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(window.electron.showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      // Clear the field
      cy.vueRef('verificationCodeInputEl').clear();
      cy.vueRef('verificationCodeInputEl').should('have.value', '');

      // Type 3 digits
      cy.vueRef('verificationCodeInputEl').type('123');

      // Try typing letters
      cy.vueRef('verificationCodeInputEl').type('abc');
      cy.vueRef('verificationCodeInputEl').should('have.value', '123');
    });
  })

  it('should auto-submit verification code after 6 digits', () => {
    window.electron = stubElectron();
    const testEmail = 'test@lockdown.systems';

    cy.window().then(async (win) => {
      win.electron = stubElectron();

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(SignInModal, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('deviceInfo', ref({
              userEmail: testEmail,
              deviceDescription: "test device",
              deviceToken: "",
              apiToken: "",
              valid: false
            }));
            app.provide('refreshDeviceInfo', async () => { return });
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/authenticate', {
        statusCode: 200,
        body: {
          message: 'verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(window.electron.showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      cy.intercept('POST', 'https://mock/api/device', {
        statusCode: 200,
        body: {
          device_token: 'this-is-a-device-token'
        }
      });
      cy.intercept('GET', 'https://mock/api/ping', {
        statusCode: 200
      });

      // Type 6 digits, should auto-submit
      cy.vueRef('verificationCodeInputEl').type('123456');

      // Check that we're logging in by searching the html for the string "Signing in..."
      cy.contains('Signing in...').should('exist');
    });
  })

  it('should show an error on wrong verification code guess but let you keep guessing', () => {
    window.electron = stubElectron();

    const testEmail = 'test@lockdown.systems';

    cy.window().then(async (win) => {
      win.electron = stubElectron();

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(SignInModal, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('deviceInfo', ref({
              userEmail: testEmail,
              deviceDescription: "test device",
              deviceToken: "",
              apiToken: "",
              valid: false
            }));
            app.provide('refreshDeviceInfo', async () => { return });
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(window.electron.showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      cy.intercept('POST', 'https://mock/api/device', {
        statusCode: 401,
        body: {
          message: 'Authentication failed'
        }
      });

      // Type 6 digits, should auto-submit
      cy.vueRef('verificationCodeInputEl').type('123456');

      // Error should be shown
      cy.wrap(window.electron.showError).should('be.calledWith', 'Invalid verification code.');

      // Expect the field to be cleared
      cy.vueRef('verificationCodeInputEl').should('have.value', '');
    });
  })

  it('verification code back button should go back to start', () => {
    window.electron = stubElectron();

    const testEmail = 'test@lockdown.systems';

    cy.window().then(async (win) => {
      win.electron = stubElectron();

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(SignInModal, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(window.electron.showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      // Click back
      cy.vueRef('backButtonEl').click();

      // Should be back to start
      cy.vueRef('emailInputEl').should('be.visible');
      cy.wrap(window.electron.showError).should('not.be.called');
    });
  })
});