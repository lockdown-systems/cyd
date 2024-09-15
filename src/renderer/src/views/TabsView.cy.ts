import { v4 as uuidv4 } from 'uuid';
import TabsView from './TabsView.vue'

import { stubElectron } from '../test_types';

describe('<TabsView />', () => {
    beforeEach(() => {
        // Stub the window.electron object
        window.electron = stubElectron();
    });

    it('starts with no accounts and signed out', () => {
        // Stub responses
        window.electron.database.getAccounts = cy.stub().resolves([]);
        window.electron.database.createAccount = cy.stub().resolves({
            id: 1,
            type: 'unknown',
            sortOrder: 0,
            xAccount: null,
            uuid: uuidv4(),
        });

        cy.mount(TabsView);

        // Check that no AccountButton components are displayed
        cy.get('.accounts-list .account-button').should('not.exist');

        // Move the mouse over userMenuBtnEl, .info-popup should appear and say you're not signed in
        cy.get('.user-menu-btn').trigger('mouseover');
        cy.get('.info-popup').should('be.visible').contains("You are not signed in");
    })
});
