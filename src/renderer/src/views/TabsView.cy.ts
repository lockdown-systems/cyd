import { v4 as uuidv4 } from 'uuid';
import TabsView from './TabsView.vue';
import SemiphemeralAPIClient from '../semiphemeral-api-client';

import { ref } from 'vue';

import { stubElectron } from '../test_util';
import { Account } from '../../../shared_types';

let accountID = 1;
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
                id: accountID,
                type: 'unknown',
                sortOrder: 0,
                xAccount: null,
                uuid: accountUUID,
            };
            testDatabase.accounts.push(newAccount);
            // autoincrement the id for the next account    
            accountID += 1;
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

        cy.mount(TabsView, {
            global: {
                plugins: [(app) => {
                    app.provide('apiClient', ref(new SemiphemeralAPIClient()));
                    app.provide('deviceInfo', ref({
                        userEmail: "test@lockdown.systems",
                        deviceDescription: "Test Device",
                        deviceToken: "",
                        deviceUUID: "",
                        apiToken: "",
                        valid: false
                    }));
                }]
            }
        });

        cy.get('.add-account-btn').trigger('mouseover');
        cy.get('.add-account-btn').trigger('mouseleave');
    });

    afterEach(() => {
        testDatabase.accounts = [];
        testDatabase.config = {};
        accountID = 1;
    });

    it('starts with one unknown accounts and signed out', () => {
        // Move the mouse over userMenuBtnEl, .info-popup should appear and say you're not signed in
        cy.get('.user-btn').trigger('mouseover');
        cy.get('.info-popup').should('be.visible').contains("You are not signed in");

        // Click it and the menu should appear
        cy.get('.user-btn').click();
        cy.get('.menu-popup').should('be.visible');

        // Click to disappear
        cy.get('.user-btn').click();

        // Check that there is exactly 1 AccountButton component (a new unknown one)
        cy.get('.accounts-list .account-button').should('have.length', 1);

        // Make sure that .account-button-1 exists
        cy.get('.account-button-1').should('exist');
    })

    it('if you add another unknown account, it uses the existing one', () => {
        // Add a new account
        cy.get('.add-account-btn').click();

        // Check that there is still only 1 AccountButton component
        cy.get('.accounts-list .account-button').should('have.length', 1);

        // Make sure that .account-button-1 exists
        cy.get('.account-button-1').should('exist');
    });

    it('if you select X, you can then add another unknown account', () => {
        // Select X
        cy.get('.select-account-x').click();

        // Add a new account
        cy.get('.add-account-btn').click();

        // Check that there are now 2 AccountButton components
        cy.get('.accounts-list .account-button').should('have.length', 2);

        // Make sure that .account-button-1 and .account-button-2 exists
        cy.get('.account-button-1').should('exist');
        cy.get('.account-button-2').should('exist');
    });

    it('add 3 accounts, delete the 2nd, add a 4th, and make sure the IDs are correct', () => {
        // Add 3 accounts
        cy.get('.select-account-x').click();
        cy.get('.add-account-btn').click();
        cy.get('.select-account-x').click();
        cy.get('.add-account-btn').click();
        cy.get('.select-account-x').click();

        cy.get('.account-button-1').should('exist');
        cy.get('.account-button-2').should('exist');
        cy.get('.account-button-3').should('exist');
        cy.get('.account-button-4').should('not.exist');

        // Delete the second account
        cy.get('.account-button-2 .account-btn').click();
        cy.get('.account-2 .remove-btn').click();

        cy.get('.account-button-1').should('exist');
        cy.get('.account-button-2').should('not.exist');
        cy.get('.account-button-3').should('exist');
        cy.get('.account-button-4').should('not.exist');
        cy.get('.account-button-5').should('not.exist');

        // Add a new account
        cy.get('.add-account-btn').click();

        // Check that the IDs are correct
        cy.get('.account-button-1').should('exist');
        cy.get('.account-button-2').should('not.exist');
        cy.get('.account-button-3').should('exist');
        cy.get('.account-button-4').should('exist');
        cy.get('.account-button-5').should('not.exist');
    });
});
