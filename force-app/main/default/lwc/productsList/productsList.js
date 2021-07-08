/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

import { LightningElement, api, wire } from "lwc";
import { publish, MessageContext } from 'lightning/messageService';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import getPricebookEntries from '@salesforce/apex/ProductsListController.getPricebookEntries';

export default class ProductsList extends LightningElement {
  @api recordId;
  error;
  pricebookEntries;

  @wire(getPricebookEntries, { orderId: '$recordId' })
  wirePriceBookEntries({ error, data }) {
    if (data) {
      this.pricebookEntries = data.length ? data : undefined;
      this.error = undefined;
    } else if (error) {
      this.pricebookEntries = undefined;
      this.errorHandler(error);
    }
  }

  @wire(MessageContext)
  messageContext;

  errorHandler(error) {
    if (Array.isArray(error.body)) {
      this.error = error.body.map(e => e.message).join(', ');
    } else if (typeof error.body?.message === 'string') {
      this.error = error.body.message;
    } else {
      this.error = 'Unknown error';
    }
  }

  handleProductClick(event) {
    const pricebookEntryId = event.currentTarget.dataset.id;
    const productId = event.currentTarget.dataset.productId;
    const productName = event.currentTarget.dataset.name;
    const productPrice = event.currentTarget.dataset.price;
    const payload = {
      productId: productId,
      productName: productName,
      productPrice: productPrice,
      pricebookEntryId: pricebookEntryId
    };
    publish(this.messageContext, ORDER_PRODUCT_CHANNEL, payload);
  }
}