import { v4 as uuidv4 } from 'uuid';
import TabsView from './TabsView.vue';
import * as database from '../../../database';

import { stubElectron } from '../test_types';

describe('<TabsView />', () => {
    beforeEach(() => {
        // Stub the window.electron object
        window.electron = stubElectron();
        window.electron.showQuestion = cy.stub().resolves(true);

        window.electron.database.getConfig = async (key) => {
            return database.getConfig(key);
        };
        window.electron.database.setConfig = async (key, value) => {
            return database.setConfig(key, value);
        };
        window.electron.database.getAccounts = async () => {
            return database.getAccounts();
        };
        window.electron.database.createAccount = async () => {
            return database.createAccount();
        };
        window.electron.database.selectAccountType = async (accountID, type) => {
            return database.selectAccountType(accountID, type);
        };
        window.electron.database.saveAccount = async (accountJson) => {
            const account = JSON.parse(accountJson);
            return database.saveAccount(account);
        };
        window.electron.database.deleteAccount = async (accountID) => {
            return database.deleteAccount(accountID);
        };
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
