/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

import { LightningElement, api, wire } from "lwc";
import { publish, MessageContext } from 'lightning/messageService';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import getPricebookEntries from '@salesforce/apex/ProductsListController.getPricebookEntries';

export default class ProductsList extends LightningElement {
  @api recordId;
  pricebookEntries;
  error;

  @wire(MessageContext)
  messageContext;

  connectedCallback() {
    this.loadRecords();
  }

  loadRecords() {
    getPricebookEntries({ orderId: this.recordId })
      .then(result => {
        this.pricebookEntries = result.length ? result : undefined;
        this.error = undefined;
      })
      .catch(error => {
        this.error = 'Unknown error';
        if (Array.isArray(error.body)) {
          this.error = error.body.map(e => e.message).join(', ');
        } else if (typeof error.body.message === 'string') {
          this.error = error.body.message;
        }

        this.pricebookEntries = undefined;
      });
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