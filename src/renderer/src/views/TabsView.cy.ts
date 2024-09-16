import { v4 as uuidv4 } from 'uuid';
import TabsView from './TabsView.vue';

import { stubElectron } from '../test_util';
import { Account } from '../../../shared_types';

const testDatabase = {
    accounts: [] as Account[],
    config: {} as Record<string, string>,
};

describe('<TabsView />', () => {
    beforeEach(() => {
        testDatabase.accounts = [];
        testDatabase.config = {};

        // Stub the window.electron object
        window.electron = stubElectron();
        window.electron.showQuestion = cy.stub().resolves(true);

        window.electron.database.getConfig = async (key: string) => {
            return testDatabase.config[key];
        };
        window.electron.database.setConfig = async (key: string, value: string) => {
            testDatabase.config[key] = value;
        };
        window.electron.database.getAccounts = async () => {
            return testDatabase.accounts;
        };
        window.electron.database.createAccount = async () => {
            const accountUUID = uuidv4();
            const newAccount: Account = {
                id: testDatabase.accounts.length + 1,
                type: 'unknown',
                sortOrder: testDatabase.accounts.length,
                xAccount: null,
                uuid: accountUUID,
            };
            testDatabase.accounts.push(newAccount);
            return newAccount;
        };
        window.electron.database.selectAccountType = async (accountID, type) => {
            const index = testDatabase.accounts.findIndex(acc => acc.id === accountID);
            if (index !== -1) {
                testDatabase.accounts[index].type = type;
            }
            return testDatabase.accounts[index];
        };
        window.electron.database.saveAccount = async (accountJson) => {
            const account = JSON.parse(accountJson);
            const index = testDatabase.accounts.findIndex(acc => acc.id === account.id);
            if (index !== -1) {
                testDatabase.accounts[index] = account;
            }
        };
        window.electron.database.deleteAccount = async (accountID) => {
            testDatabase.accounts = testDatabase.accounts.filter(acc => acc.id !== accountID);
        };
    });

    afterEach(() => {
        testDatabase.accounts = [];
        testDatabase.config = {};
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
