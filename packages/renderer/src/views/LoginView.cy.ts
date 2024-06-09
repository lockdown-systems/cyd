import { ref } from 'vue';

import LoginView from './LoginView.vue'
import ServerAPI from '../ServerAPI';

describe('<LoginView />', () => {
  it('starts with the email field visible and the value blank', () => {
    cy.mount(LoginView);

    cy.vueRef('emailInputEl').should('be.visible');
    cy.vueRef('emailInputEl').should('have.value', '');
  })

  it('prepopulates the email field if it is saved', () => {
    const testEmail = 'test@lockdown.systems';

    cy.mount(LoginView, {
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

    cy.mount(LoginView, {
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

    cy.mount(LoginView, {
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

    cy.window().then(async (win) => {
      (win as any).electron = {
        getApiUrl: async (): Promise<string> => { return 'https://mock/api/v1' },
        setConfig: async (_key: string, _value: string): Promise<void> => { return },
      }

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(LoginView, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('showError', showError);
          }]
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
      cy.wait(500);

      cy.wrap(showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');
    });
  })

  it('should only allow digits in the verification code field', () => {
    const testEmail = 'test@lockdown.systems';
    const showError = cy.stub();

    cy.window().then(async (win) => {
      (win as any).electron = {
        getApiUrl: async (): Promise<string> => { return 'https://mock/api/v1' },
        setConfig: async (_key: string, _value: string): Promise<void> => { return },
      }

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(LoginView, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('showError', showError);
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/v1/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(showError).should('not.be.called');

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
    const testEmail = 'test@lockdown.systems';
    const showError = cy.stub();
    const navigate = cy.spy();

    cy.window().then(async (win) => {
      (win as any).electron = {
        getApiUrl: async (): Promise<string> => { return 'https://mock/api/v1' },
        setConfig: async (_key: string, _value: string): Promise<void> => { return },
      }

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(LoginView, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('showError', showError);
            app.provide('navigate', navigate);
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
      cy.intercept('POST', 'https://mock/api/v1/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      cy.intercept('POST', 'https://mock/api/v1/device', {
        statusCode: 200,
        body: {
          deviceToken: 'this-is-a-device-token'
        }
      });
      cy.intercept('GET', 'https://mock/api/v1/ping', {
        statusCode: 200
      });

      // Type 6 digits, should auto-submit
      cy.vueRef('verificationCodeInputEl').type('123456');
      cy.wrap(navigate).should('be.calledWith', '/dashboard');
    });
  })

  it('should show an error on wrong verification code guess but let you keep guessing', () => {
    const testEmail = 'test@lockdown.systems';
    const showError = cy.stub();

    cy.window().then(async (win) => {
      (win as any).electron = {
        getApiUrl: async (): Promise<string> => { return 'https://mock/api/v1' },
        setConfig: async (_key: string, _value: string): Promise<void> => { return },
      }

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(LoginView, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('showError', showError);
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
      cy.intercept('POST', 'https://mock/api/v1/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      cy.intercept('POST', 'https://mock/api/v1/device', {
        statusCode: 401,
        body: {
          message: 'Authentication failed'
        }
      });

      // Type 6 digits, should auto-submit
      cy.vueRef('verificationCodeInputEl').type('123456');

      // Error should be shown
      cy.wrap(showError).should('be.calledWith', 'Invalid verification code.');

      // Expect the field to be cleared
      cy.vueRef('verificationCodeInputEl').should('have.value', '');
    });
  })

  it('verification code back button should go back to start', () => {
    const testEmail = 'test@lockdown.systems';
    const showError = cy.stub();

    cy.window().then(async (win) => {
      (win as any).electron = {
        getApiUrl: async (): Promise<string> => { return 'https://mock/api/v1' },
        setConfig: async (_key: string, _value: string): Promise<void> => { return },
      }

      const serverApi = new ServerAPI();
      await serverApi.initialize();

      cy.mount(LoginView, {
        global: {
          plugins: [(app) => {
            app.provide('serverApi', ref(serverApi));
            app.provide('userEmail', ref(testEmail));
            app.provide('showError', showError);
          }]
        }
      });

      // Click through to the verification code page
      cy.intercept('POST', 'https://mock/api/v1/authenticate', {
        statusCode: 200,
        body: {
          message: 'Verification code sent to email'
        }
      });

      cy.vueRef('startContinueButtonEl').click();
      cy.wrap(showError).should('not.be.called');

      cy.vueRef('verificationCodeInputEl').should('be.visible');

      // Click back
      cy.vueRef('backButtonEl').click();

      // Should be back to start
      cy.vueRef('emailInputEl').should('be.visible');
      cy.wrap(showError).should('not.be.called');
    });
  })
});