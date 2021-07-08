import { createElement } from 'lwc';
import ProductsList from 'c/productsList';
import { MessageContext, publish } from 'lightning/messageService';
import { registerApexTestWireAdapter, registerTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import getPricebookEntries from '@salesforce/apex/ProductsListController.getPricebookEntries';

const mockGetPricebookEntries = require('./data/getPricebookEntries.json');
const mockGetPricebookEntriesEmpty = require('./data/getPricebookEntries_Empty.json');

const getPricebookEntriesAdapter = registerApexTestWireAdapter(getPricebookEntries);
registerTestWireAdapter(MessageContext);

describe('c-products-list', () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        jest.clearAllMocks();
    });

    async function flushPromises() {
        return Promise.resolve();
    }

    it('getPricebookEntries with records', async () => {
        const element = createElement('c-products-list', { is: ProductsList });
        document.body.appendChild(element);

        getPricebookEntriesAdapter.emit(mockGetPricebookEntries);
        await flushPromises();

        const tableRows = element.shadowRoot.querySelectorAll('tr');
        expect(tableRows.length).toBe(mockGetPricebookEntries.length + 1);

        const firstRow = tableRows[1].querySelectorAll('td');  // Row 0 is header
        expect(firstRow[0].textContent).toBe('GenWatt Diesel 10kW');
        expect(firstRow[1].textContent).toBe('5000');
    });

    it('getPricebookEntries with no records', async () => {
        const element = createElement('c-products-list', { is: ProductsList });
        document.body.appendChild(element);

        getPricebookEntriesAdapter.emit(mockGetPricebookEntriesEmpty);
        await flushPromises();

        const tableRows = element.shadowRoot.querySelectorAll('tr');
        expect(tableRows.length).toBe(0);

        const message = element.shadowRoot.querySelector('p');
        expect(message.textContent).toBe('No products available');
    });

    it('getPricebookEntries with error', async () => {
        const element = createElement('c-products-list', { is: ProductsList });
        document.body.appendChild(element);

        getPricebookEntriesAdapter.error('Test error');
        await flushPromises();

        const tableRows = element.shadowRoot.querySelectorAll('tr');
        expect(tableRows.length).toBe(0);

        const errorMessage = element.shadowRoot.querySelector('div');
        expect(errorMessage.textContent).toBe('An error occurred: Test error');
    });

    it('product clicked', async () => {
        const element = createElement('c-products-list', { is: ProductsList });
        document.body.appendChild(element);

        getPricebookEntriesAdapter.emit(mockGetPricebookEntries);
        await flushPromises();

        const tableRows = element.shadowRoot.querySelectorAll('tr');
        tableRows[1].dispatchEvent(new CustomEvent('click'));

        const payload = {
            productId: '01t09000002oQjmAAE',
            productName: 'GenWatt Diesel 10kW',
            productPrice: "5000",
            pricebookEntryId: '01u09000000rBSxAAM'
        };
        expect(publish).toHaveBeenCalledWith(undefined, ORDER_PRODUCT_CHANNEL, payload);
    });
});