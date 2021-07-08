import { createElement } from 'lwc';
import OrderProducts from 'c/orderProducts';
import { MessageContext, publish, subscribe } from "lightning/messageService";
import { ShowToastEventName } from 'lightning/platformShowToastEvent';
import { registerTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import confirmOrder from '@salesforce/apex/OrderProductsController.confirmOrder';
import getOrder from '@salesforce/apex/OrderProductsController.getOrder';
import getSaveAsyncStatus from '@salesforce/apex/OrderProductsController.getSaveAsyncStatus';
import queueSaveOrderItems from '@salesforce/apex/OrderProductsController.queueSaveOrderItems';

const mockGetOrder = require('./data/getOrder.json');
const mockEmpty = require('./data/EmptyList.json');

const messageContextWireAdapter = registerTestWireAdapter(MessageContext);

jest.mock('@salesforce/apex/OrderProductsController.confirmOrder', () => { return { default: jest.fn() }; }, { virtual: true });
jest.mock('@salesforce/apex/OrderProductsController.getOrder', () => { return { default: jest.fn() }; }, { virtual: true });
jest.mock('@salesforce/apex/OrderProductsController.getSaveAsyncStatus', () => { return { default: jest.fn() }; }, { virtual: true });
jest.mock('@salesforce/apex/OrderProductsController.queueSaveOrderItems', () => { return { default: jest.fn() }; }, { virtual: true });

describe('c-order-products', () => {
  afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
  }

  function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  it('getOrder with records', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    const tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(mockGetOrder.OrderItems.length + 1);

    const firstRow = tableRows[1].querySelectorAll('td');
    expect(firstRow[0].textContent).toBe('GenWatt Diesel 1000kW');
    expect(firstRow[1].textContent).toBe('100000');
    expect(firstRow[2].textContent).toBe('5');
    expect(firstRow[3].textContent).toBe('500000');
  });

  it('getOrder with no records', async () => {
    getOrder.mockResolvedValue(mockEmpty);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    const tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(0);

    const message = element.shadowRoot.querySelector('p');
    expect(message.textContent).toBe('No products in this Order');
  });

  it('getOrder with error', async () => {
    getOrder.mockRejectedValue('Test error');

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    const tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(0);

    const errorMessage = element.shadowRoot.querySelector('div');
    expect(errorMessage.textContent).toBe('An error occurred: Unknown error');
  });

  it('product clicked', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    let tableRows = element.shadowRoot.querySelectorAll('tr');
    tableRows[1].dispatchEvent(new CustomEvent('click'));
    tableRows[2].dispatchEvent(new CustomEvent('click'));

    await flushPromises();

    tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(mockGetOrder.OrderItems.length);

    const firstRow = tableRows[1].querySelectorAll('td');
    expect(firstRow[0].textContent).toBe('GenWatt Diesel 1000kW');
    expect(firstRow[1].textContent).toBe('100000');
    expect(firstRow[2].textContent).toBe('4');
    expect(firstRow[3].textContent).toBe('400000');
  });

  it('add product', async () => {
    getOrder.mockResolvedValue(mockEmpty);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    expect(subscribe).toHaveBeenCalled();

    const payload = {
      productId: '01t09000002oQjmAAE',
      productName: 'GenWatt Diesel 10kW',
      productPrice: '5000',
      pricebookEntryId: '01u09000000rBSxAAM'
    };
    publish(messageContextWireAdapter, ORDER_PRODUCT_CHANNEL, payload);

    await flushPromises();

    let tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(2);

    let firstRow = tableRows[1].querySelectorAll('td');
    expect(firstRow[0].textContent).toBe('GenWatt Diesel 10kW');
    expect(firstRow[1].textContent).toBe('5000');
    expect(firstRow[2].textContent).toBe('1');
    expect(firstRow[3].textContent).toBe('5000');

    publish(messageContextWireAdapter, ORDER_PRODUCT_CHANNEL, payload);

    await flushPromises();

    tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(2);

    firstRow = tableRows[1].querySelectorAll('td');
    expect(firstRow[0].textContent).toBe('GenWatt Diesel 10kW');
    expect(firstRow[1].textContent).toBe('5000');
    expect(firstRow[2].textContent).toBe('2');
    expect(firstRow[3].textContent).toBe('10000');
  });

  it('Save button clicked', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    const handler = jest.fn();
    element.addEventListener(ShowToastEventName, handler);

    await flushPromises();

    queueSaveOrderItems.mockResolvedValue();
    getSaveAsyncStatus.mockResolvedValueOnce('Processing');
    getSaveAsyncStatus.mockResolvedValueOnce('Completed');

    await flushPromises();

    const buttons = element.shadowRoot.querySelectorAll('lightning-button');
    buttons[0].dispatchEvent(new CustomEvent('click'));

    await wait(1000);
    await flushPromises();
  });

  it('Save error', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    const handler = jest.fn();
    element.addEventListener(ShowToastEventName, handler);

    await flushPromises();

    queueSaveOrderItems.mockResolvedValue();
    getSaveAsyncStatus.mockRejectedValue('Test error');

    await flushPromises();

    const buttons = element.shadowRoot.querySelectorAll('lightning-button');
    buttons[0].dispatchEvent(new CustomEvent('click'));

    await wait(1000);
    await flushPromises();

    const errorMessage = element.shadowRoot.querySelector('div');
    expect(errorMessage.textContent).toBe('An error occurred: Unknown error');
  });

  it('Confirm button clicked', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    const handler = jest.fn();
    element.addEventListener(ShowToastEventName, handler);

    await flushPromises();

    confirmOrder.mockResolvedValue(true);
    queueSaveOrderItems.mockResolvedValue();
    getSaveAsyncStatus.mockResolvedValueOnce('Processing');
    getSaveAsyncStatus.mockResolvedValueOnce('Completed');

    await flushPromises();

    const buttons = element.shadowRoot.querySelectorAll('lightning-button');
    buttons[1].dispatchEvent(new CustomEvent('click'));

    await wait(1000);
    await flushPromises();
  });

  it('Undo button clicked', async () => {
    getOrder.mockResolvedValue(mockGetOrder);

    const element = createElement('c-order-products', { is: OrderProducts });
    document.body.appendChild(element);

    await flushPromises();

    let tableRows = element.shadowRoot.querySelectorAll('tr');
    tableRows[2].dispatchEvent(new CustomEvent('click'));

    await flushPromises();

    tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(mockGetOrder.OrderItems.length);

    const buttons = element.shadowRoot.querySelectorAll('lightning-button');
    buttons[2].dispatchEvent(new CustomEvent('click'));

    await flushPromises();

    tableRows = element.shadowRoot.querySelectorAll('tr');
    expect(tableRows.length).toBe(mockGetOrder.OrderItems.length + 1);
  });
});