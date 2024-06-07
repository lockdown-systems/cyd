import { mount } from '@cypress/vue';
import ErrorMessage from './ErrorMessage.vue'

describe('<ErrorMessage />', () => {
  const message = 'Test error message';

  beforeEach(() => {
    mount(ErrorMessage, {
      propsData: {
        message: message
      }
    });
  });

  it('displays the error message in the modal', () => {
    cy.get('.modal-body').should('contain', message);
    cy.get('.modal').should('be.visible');
  });

  it('hides the modal when the close button is clicked', () => {
    cy.get('.btn-close').click();
    cy.get('.modal').should('not.be.visible');
  });

  it('hides the modal when the dismiss button is clicked', () => {
    cy.get('.btn.btn-secondary').click();
    cy.get('.modal').should('not.be.visible');
  });
});